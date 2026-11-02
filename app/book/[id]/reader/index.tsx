import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/lib/notifications/toast';
import { Book } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';
import { markdownToHtml, markdownHtmlStyles, markdownHtmlStylesDark } from '@/lib/markdown/renderer';
import PdfReader from '@/components/PdfReader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { updateReadingProgress, addBookmark, addHighlight, addNote, bookmarks, highlights } = useLibraryStore();
  const { readingSettings, setReadingSettings } = useSettingsStore();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [localDocumentUri, setLocalDocumentUri] = useState<string | null>(null);
  
  // Note/Highlight modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFC928');
  
  const scrollViewRef = useRef<ScrollView>(null);
  const bookIdRef = useRef<string>('');

  useEffect(() => {
    fetchBook();
    return () => {
      // Cleanup on unmount
    };
  }, [id]);

  // Check for locally downloaded document
  const checkLocalDocument = async (bookId: string): Promise<string | null> => {
    const docUri = `${FileSystem.documentDirectory}eodh/books/${bookId}/document`;
    const info = await FileSystem.getInfoAsync(docUri);
    if (info.exists) {
      return docUri;
    }
    return null;
  };

  const fetchBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const bookId = Array.isArray(id) ? id[0] : id;
      bookIdRef.current = bookId;
      
      const { data, error: fetchError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setBook(data);
        
        // Check for locally downloaded document first
        const localUri = await checkLocalDocument(bookId);
        if (localUri) {
          setLocalDocumentUri(localUri);
        }
        
        // Use local URI if available, otherwise fall back to remote URL
        const documentUri = localUri || data.document_url;
        
        // Fetch document content
        if (documentUri) {
          try {
            let text: string;
            if (localUri && documentUri.startsWith('file://') || documentUri.startsWith('/')) {
              // Read local file
              text = await FileSystem.readAsStringAsync(documentUri);
            } else {
              // Fetch remote file
              const response = await fetch(documentUri);
              if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
              text = await response.text();
            }
            
            setRawContent(text);
            
            if (data.document_type === 'markdown') {
              const html = markdownToHtml(text);
              setHtmlContent(html);
              const lines = text.split('\n').length;
              setTotalPages(Math.max(1, Math.ceil(lines / 40)));
            }
            // For PDF, the PdfReader component handles rendering directly
          } catch (err: any) {
            setError(err?.message || 'Failed to load document content.');
            setHtmlContent(`
              <div style="padding: 20px; text-align: center; color: red;">
                <h2>Error Loading Document</h2>
                <p>${err?.message || 'Failed to load document content. Please check the file URL.'}</p>
              </div>
            `);
          }
        } else {
          setError('No document URL available for this book.');
          setHtmlContent(`
            <div style="padding: 20px; text-align: center;">
              <h2>No Document</h2>
              <p>This book does not have an associated document file.</p>
            </div>
          `);
        }
      } else {
        setError('Book not found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load book.');
      setHtmlContent(`
        <div style="padding: 20px; text-align: center; color: red;">
          <h2>Error</h2>
          <p>${err?.message || 'Book not found.'}</p>
        </div>
      `);
    }
    setLoading(false);
  };

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;
    
    const scrollPercent = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    const page = Math.max(1, Math.ceil(scrollPercent * totalPages));
    setCurrentPage(page);

    // Auto-save reading progress (throttled)
    if (book) {
      updateReadingProgress({
        book_id: bookIdRef.current,
        page_number: page,
        progress_percent: Math.min(100, scrollPercent * 100),
      });
    }
  }, [book, totalPages, updateReadingProgress]);

  const toggleHeader = () => {
    setShowHeader(!showHeader);
  };

  const toggleActions = () => {
    setShowActions(!showActions);
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, readingSettings.fontSize + delta));
    setReadingSettings({ fontSize: newSize });
  };

  const changeTheme = () => {
    const themes: Array<'light' | 'dark' | 'sepia'> = ['light', 'dark', 'sepia'];
    const currentIndex = themes.indexOf(readingSettings.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setReadingSettings({ theme: nextTheme });
  };

  // Check if current page is bookmarked
  const isPageBookmarked = (() => {
    if (!book || !user) return false;
    return bookmarks.some(b => b.book_id === book.id && b.page_number === currentPage);
  })();

  // Bookmark actions
  const handleBookmark = async () => {
    if (!book || !user) {
      showWarning('Please sign in to bookmark pages.');
      return;
    }

    // Check if already bookmarked
    if (isPageBookmarked) {
      showInfo('This page is already bookmarked.');
      return;
    }

    try {
      await addBookmark({
        book_id: book.id,
        page_number: currentPage,
        text_excerpt: rawContent.substring(0, 200),
        note: null,
      });
      showSuccess('Page bookmarked.');
    } catch (err) {
      showError('Failed to bookmark page.');
    }
  };

  // Highlight actions
  const handleHighlight = () => {
    if (!user) {
      showWarning('Please sign in to highlight text.');
      return;
    }
    // For Markdown, use a simple excerpt from current page area
    const excerpt = rawContent.substring(0, 300);
    handleSaveHighlight(excerpt);
  };

  const handleSaveHighlight = async (text: string) => {
    if (!book || !user) return;

    try {
      await addHighlight({
        book_id: book.id,
        page_number: currentPage,
        text: text.substring(0, 500),
        color: highlightColor,
        note: null,
      });
      setShowNoteModal(false);
      setNoteText('');
      showSuccess('Text highlighted.');
    } catch (err) {
      showError('Failed to save highlight.');
    }
  };

  // Note actions
  const handleSaveNote = async () => {
    if (!book || !user) {
      showWarning('Please sign in to add notes.');
      return;
    }

    if (!noteText.trim()) {
      showWarning('Please enter some text for your note.');
      return;
    }

    try {
      await addNote({
        book_id: book.id,
        page_number: currentPage,
        content: noteText.trim(),
      });
      setShowNoteModal(false);
      setNoteText('');
      showSuccess('Note saved.');
    } catch (err) {
      showError('Failed to save note.');
    }
  };

  const openNoteModal = () => {
    setNoteText('');
    setShowNoteModal(true);
  };

  const getThemeColors = () => {
    switch (readingSettings.theme) {
      case 'dark':
        return {
          background: '#1a1a1a',
          text: '#e0e0e0',
          secondaryText: '#888888',
        };
      case 'sepia':
        return {
          background: '#f4ecd8',
          text: '#5b4636',
          secondaryText: '#8b7355',
        };
      default:
        return {
          background: '#FFFFFF',
          text: '#1a1a1a',
          secondaryText: '#666666',
        };
    }
  };

  const getHtmlStyles = () => {
    const baseFontSize = readingSettings.fontSize;
    
    if (readingSettings.theme === 'dark') {
      return {
        ...markdownHtmlStylesDark,
        document: {
          ...markdownHtmlStylesDark.document,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
        },
        p: {
          ...markdownHtmlStylesDark.p,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
        },
        li: {
          ...markdownHtmlStylesDark.li,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
        },
      };
    }
    
    return {
      ...markdownHtmlStyles,
      document: {
        ...markdownHtmlStyles.document,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
      },
      p: {
        ...markdownHtmlStyles.p,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
      },
      li: {
        ...markdownHtmlStyles.li,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
      },
    };
  };

  const themeColors = getThemeColors();
  const htmlStyles = getHtmlStyles();
  const contentWidth = SCREEN_WIDTH - readingSettings.margins * 2;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.royalPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={readingSettings.theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      
      {/* Header */}
      {showHeader && (
        <View style={[styles.header, { backgroundColor: themeColors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {book?.title || 'Reader'}
          </Text>
          <View style={styles.headerRight}>
            <Text style={[styles.pageIndicator, { color: themeColors.secondaryText }]}>
              {currentPage} / {totalPages}
            </Text>
            <TouchableOpacity onPress={toggleActions} accessibilityLabel="Reader actions">
              <Ionicons name="ellipsis-horizontal" size={22} color={themeColors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(true)} accessibilityLabel="Reading settings">
              <Ionicons name="settings-outline" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content — PDF or Markdown */}
      <TouchableOpacity
        style={styles.tapArea}
        onPress={toggleHeader}
        activeOpacity={1}
      >
        {book?.document_type === 'pdf' && (localDocumentUri || book.document_url) ? (
          // PDF Reader with native rendering (uses local file if available)
          <View style={{ flex: 1 }}>
            <PdfReader
              sourceUri={localDocumentUri || book.document_url}
              onPageChange={(page, total) => {
                setCurrentPage(page);
                setTotalPages(total);
                if (book) {
                  updateReadingProgress({
                    book_id: bookIdRef.current,
                    page_number: page,
                    progress_percent: Math.min(100, (page / total) * 100),
                  });
                }
              }}
              onLoadComplete={(total) => {
                setTotalPages(total);
              }}
              onError={(err) => {
                console.error('PDF error:', err);
              }}
            />
          </View>
        ) : (
          // Markdown Reader with HTML rendering
          <ScrollView
            ref={scrollViewRef}
            style={[styles.content, { backgroundColor: themeColors.background }]}
            contentContainerStyle={[
              styles.contentContainer,
              {
                paddingHorizontal: readingSettings.margins,
              },
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            showsVerticalScrollIndicator={false}
          >
            {htmlContent ? (
              <RenderHTML
                source={{ html: htmlContent }}
                contentWidth={contentWidth}
                tagsStyles={htmlStyles}
                systemFonts={['systemFont', 'HelveticaNeue', 'Arial']}
              />
            ) : (
              <Text
                style={[
                  styles.text,
                  {
                    color: themeColors.text,
                    fontSize: readingSettings.fontSize,
                    lineHeight: readingSettings.fontSize * readingSettings.lineSpacing,
                    textAlign: readingSettings.textAlign,
                  },
                ]}
              >
                {rawContent || 'No content available.'}
              </Text>
            )}
          </ScrollView>
        )}
      </TouchableOpacity>

      {/* Action Bar */}
      {showActions && (
        <View style={[styles.actionBar, { backgroundColor: themeColors.background }]}>
          <TouchableOpacity
            style={[styles.actionButton, isPageBookmarked && styles.actionButtonActive]}
            onPress={handleBookmark}
            accessibilityLabel={isPageBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          >
            <Ionicons
              name={isPageBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isPageBookmarked ? COLORS.gold : themeColors.text}
            />
            <Text style={[styles.actionButtonText, { color: isPageBookmarked ? COLORS.gold : themeColors.text }]}>
              {isPageBookmarked ? 'Bookmarked' : 'Bookmark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHighlight}
            accessibilityLabel="Highlight text"
          >
            <Ionicons name="pencil" size={22} color={COLORS.gold} />
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Highlight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={openNoteModal}
            accessibilityLabel="Add note"
          >
            <Ionicons name="create-outline" size={22} color={COLORS.royalPurple} />
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleActions}
            accessibilityLabel="Close actions"
          >
            <Ionicons name="close" size={22} color={themeColors.secondaryText} />
            <Text style={[styles.actionButtonText, { color: themeColors.secondaryText }]}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add Note</Text>
              <TouchableOpacity onPress={() => { setShowNoteModal(false); setNoteText(''); }}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.noteInput, { color: themeColors.text, backgroundColor: themeColors.background }]}
              placeholder="Write your note..."
              placeholderTextColor={themeColors.secondaryText}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              accessibilityLabel="Note text input"
            />

            {/* Highlight Color Picker */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Highlight Color</Text>
              <View style={styles.colorRow}>
                {['#FFC928', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      highlightColor === color && styles.colorCircleActive,
                    ]}
                    onPress={() => setHighlightColor(color)}
                    accessibilityLabel={`Select highlight color ${color}`}
                  />
                ))}
              </View>
            </View>

            <View style={styles.noteActions}>
              <TouchableOpacity
                style={[styles.noteActionButton, { backgroundColor: COLORS.royalPurple }]}
                onPress={handleSaveNote}
                accessibilityLabel="Save note"
              >
                <Text style={styles.noteActionText}>Save Note</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteActionButton, { backgroundColor: COLORS.gold }]}
                onPress={handleSaveHighlight}
                accessibilityLabel="Save highlight"
              >
                <Text style={styles.noteActionText}>Save Highlight</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Reading Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            {/* Theme */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Theme</Text>
              <View style={styles.themeButtons}>
                {(['light', 'dark', 'sepia'] as const).map((theme) => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeButton,
                      readingSettings.theme === theme && styles.themeButtonActive,
                    ]}
                    onPress={() => setReadingSettings({ theme })}
                  >
                    <Text
                      style={[
                        styles.themeButtonText,
                        { color: theme === 'light' ? '#333' : theme === 'dark' ? '#fff' : '#5b4636' },
                        readingSettings.theme === theme && styles.themeButtonTextActive,
                      ]}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Size</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity onPress={() => changeFontSize(-2)}>
                  <Ionicons name="remove-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.fontSize}
                </Text>
                <TouchableOpacity onPress={() => changeFontSize(2)}>
                  <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Line Spacing */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Line Spacing</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity
                  onPress={() =>
                    setReadingSettings({
                      lineSpacing: Math.max(1.0, readingSettings.lineSpacing - 0.25),
                    })
                  }
                >
                  <Ionicons name="remove-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.lineSpacing.toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setReadingSettings({
                      lineSpacing: Math.min(2.5, readingSettings.lineSpacing + 0.25),
                    })
                  }
                >
                  <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Text Alignment */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Alignment</Text>
              <View style={styles.alignmentRow}>
                {(['left', 'center', 'justify'] as const).map((align) => (
                  <TouchableOpacity
                    key={align}
                    style={[
                      styles.alignButton,
                      readingSettings.textAlign === align && styles.alignButtonActive,
                    ]}
                    onPress={() => setReadingSettings({ textAlign: align })}
                  >
                    <Ionicons
                      name={
                        align === 'left'
                          ? 'align'
                          : align === 'center'
                          ? 'align-center'
                          : 'align-items'
                      }
                      size={20}
                      color={
                        readingSettings.textAlign === align
                          ? COLORS.white
                          : COLORS.royalPurple
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Margins */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Margins</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity
                  onPress={() =>
                    setReadingSettings({ margins: Math.max(8, readingSettings.margins - 4) })
                  }
                >
                  <Ionicons name="remove-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.margins}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setReadingSettings({ margins: Math.min(40, readingSettings.margins + 4) })
                  }
                >
                  <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: SPACING.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '500',
  },
  tapArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: SPACING.lg,
    minHeight: '100%',
  },
  text: {
    marginBottom: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  settingRow: {
    marginBottom: SPACING.lg,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  themeButtonActive: {
    borderColor: COLORS.royalPurple,
    borderWidth: 2,
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  themeButtonTextActive: {
    color: COLORS.royalPurple,
    fontWeight: '600',
  },
  fontSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  fontSizeValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  alignmentRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  alignButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  alignButtonActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  // Action bar styles
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255, 201, 40, 0.1)',
    borderRadius: BORDER_RADIUS.md,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Note modal styles
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    minHeight: 120,
    marginBottom: SPACING.md,
  },
  colorRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: COLORS.deepNavy,
  },
  noteActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  noteActionButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  noteActionText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});

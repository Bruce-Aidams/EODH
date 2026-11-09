import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/lib/notifications/toast';
import { Book, BookChapter } from '@/types';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { markdownToHtml, markdownHtmlStyles, markdownHtmlStylesDark, extractChapters } from '@/lib/markdown/renderer';
import PdfReader from '@/components/PdfReader';
import { useTheme } from '@/lib/theme/ThemeContext';
import { ThemeSelector } from '@/components/ThemeSelector';
import { AnimatedView } from '@/components/AnimatedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { processDocument } from '@/lib/admin/textProcessing';
import { AudioMiniPlayer } from '@/components/AudioMiniPlayer';
import { useAudioStore } from '@/stores/audioStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { updateReadingProgress, addBookmark, addHighlight, addNote, bookmarks, highlights } = useLibraryStore();
  const { readingSettings, setReadingSettings } = useSettingsStore();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
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
  
  // Reflow mode state
  const [viewMode, setViewMode] = useState<'reflow' | 'original'>('reflow');
  const [chaptersWithContent, setChaptersWithContent] = useState<BookChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [processingDocument, setProcessingDocument] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // In-memory cache for chapter content to avoid refetching
  const chapterContentCache = useRef<Map<string, string>>(new Map());
  
  // Note/Highlight modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFC928');
  
  // Table of Contents state
  const [showToc, setShowToc] = useState(false);
  const [chapters, setChapters] = useState<{ id: string; title: string; level: number }[]>([]);
  
  // Progress bar state
  const [progressPercent, setProgressPercent] = useState(0);
  
  // Auto-hide header timer
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerAutoHidden, setHeaderAutoHidden] = useState(false);
  
  // In-book search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterId: string; chapterTitle: string; matchIndex: number; snippet: string }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const bookIdRef = useRef<string>('');

  // Auto-process document if no chapters exist (converts PDF to reflow format)
  const autoProcessDocument = async (book: Book) => {
    setProcessingDocument(true);
    setProcessingMessage('Extracting text and creating chapters...');
    
    try {
      const result = await processDocument(book, (progress) => {
        setProcessingMessage(progress.message);
      });
      
      if (result.success) {
        showSuccess(`Document processed! ${result.chaptersCreated} chapters created.`);
        // Re-fetch chapters after processing
        const bookId = bookIdRef.current;
        if (bookId) {
          await fetchChapters(bookId);
          // Switch to reflow mode now that content is ready
          setViewMode('reflow');
        }
      } else {
        // If edge function fails, create a fallback chapter from available text
        console.warn('Document processing failed, creating fallback:', result.error);
        await createFallbackChapter(book);
      }
    } catch (err: any) {
      console.error('Auto-process error:', err);
      await createFallbackChapter(book);
    } finally {
      setProcessingDocument(false);
      setProcessingMessage('');
    }
  };

  // Create a fallback chapter if processing fails
  const createFallbackChapter = async (book: Book) => {
    try {
      // Try to get at least some content from the document URL
      if (book.document_url) {
        const { data, error } = await supabase
          .from('book_chapters')
          .insert({
            book_id: book.id,
            title: book.title || 'Document',
            order_index: 0,
            content: `<p><em>Document loaded. Use "Original PDF" mode to view the full document, or contact the admin to process this document for reflow reading.</em></p>`,
          })
          .select();
        
        if (!error && data && data.length > 0) {
          setChaptersWithContent(data);
          setChapters([{ id: data[0].id, title: data[0].title, level: 1 }]);
          loadChapterContent(data[0]);
          showWarning('Document could not be fully processed. Showing original PDF mode.');
          setViewMode('original');
        }
      }
    } catch (err) {
      console.error('Fallback chapter creation failed:', err);
    }
  };

  useEffect(() => {
    fetchBook();
    return () => {
      // Cleanup on unmount
    };
  }, [id]);

  // Check for locally downloaded document
  const checkLocalDocument = async (bookId: string): Promise<string | null> => {
    const docUri = `${FileSystem.documentDirectory}eodh/books/${bookId}/document`;
    const info = await getInfoAsync(docUri);
    if (info.exists) {
      return docUri;
    }
    return null;
  };

  // Fetch chapter list (metadata only, no content) for TOC
  const fetchChapterList = async (bookId: string): Promise<BookChapter[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('book_chapters')
        .select('id, book_id, title, content, order_index, page_start, page_end, created_at')
        .eq('book_id', bookId)
        .order('order_index', { ascending: true });

      if (!fetchError && data) {
        setChaptersWithContent(data);
        
        // Build table of contents from chapters
        setChapters(data.map((ch) => ({
          id: ch.id,
          title: ch.title,
          level: 1,
        })));
        
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    }
    return [];
  };

  // Load all chapters content for continuous scrolling
  const loadAllChaptersContent = async (chapters: BookChapter[]) => {
    setLoadingChapters(true);
    try {
      let combinedHtml = '';
      let combinedRaw = '';
      let totalLines = 0;
      
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        let content = chapter.content || '';
        
        // If content is empty, fetch it
        if (!content || content.trim() === '') {
          const cached = chapterContentCache.current.get(chapter.id);
          if (cached) {
            content = cached;
          } else {
            const { data: chapterData } = await supabase
              .from('book_chapters')
              .select('content')
              .eq('id', chapter.id)
              .single();
            content = chapterData?.content || '';
            chapterContentCache.current.set(chapter.id, content);
          }
        }
        
        // Add chapter header with separator
        if (i > 0) {
          combinedHtml += `<hr class="chapter-separator" />`;
        }
        combinedHtml += `<div id="chapter-${chapter.id}" data-chapter-index="${i}">`;
        combinedHtml += `<h2 class="chapter-title">${chapter.title}</h2>`;
        combinedHtml += content;
        combinedHtml += '</div>';
        
        // Track raw text and lines
        const rawText = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
        combinedRaw += rawText + ' ';
        totalLines += content.split('\n').length;
      }
      
      setHtmlContent(combinedHtml);
      setRawContent(combinedRaw.trim());
      setTotalPages(Math.max(1, Math.ceil(totalLines / 40)));
    } finally {
      setLoadingChapters(false);
    }
  };

  // Fetch a single chapter's full content (lazy loading with cache)
  const fetchChapterContent = async (chapterId: string) => {
    // Check cache first
    const cached = chapterContentCache.current.get(chapterId);
    if (cached) {
      setHtmlContent(cached);
      const rawText = cached.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
      setRawContent(rawText);
      const lines = cached.split('\n').length;
      setTotalPages(Math.max(1, Math.ceil(lines / 40)));
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('book_chapters')
        .select('content')
        .eq('id', chapterId)
        .single();

      if (!fetchError && data && data.content) {
        // Cache the content
        chapterContentCache.current.set(chapterId, data.content);
        setHtmlContent(data.content);
        const rawText = data.content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
        setRawContent(rawText);
        const lines = data.content.split('\n').length;
        setTotalPages(Math.max(1, Math.ceil(lines / 40)));
      }
    } catch (err) {
      console.error('Failed to fetch chapter content:', err);
    }
  };

  // Fetch processed chapters from database (returns metadata only)
  const fetchChapters = async (bookId: string): Promise<BookChapter[]> => {
    setLoadingChapters(true);
    try {
      const data = await fetchChapterList(bookId);
      
      // For continuous scrolling, load all chapters content
      if (data.length > 0) {
        await loadAllChaptersContent(data);
      }
      
      return data;
    } finally {
      setLoadingChapters(false);
    }
  };

  // Load a specific chapter's content (legacy, for fallback)
  const loadChapterContent = (chapter: BookChapter) => {
    if (chapter.content) {
      setHtmlContent(chapter.content);
      // Strip HTML tags for raw text
      const rawText = chapter.content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
      setRawContent(rawText);
    } else {
      setHtmlContent('<p>No content available for this chapter.</p>');
      setRawContent('');
    }
    
    // Update total pages based on content length
    const lines = (chapter.content || '').split('\n').length;
    setTotalPages(Math.max(1, Math.ceil(lines / 40)));
  };

  // Navigate to a specific chapter (lazy loads content)
  const navigateToChapterIndex = async (index: number) => {
    if (chaptersWithContent[index]) {
      setCurrentChapterIndex(index);
      setLoadingChapters(true);
      setShowToc(false);
      // Scroll to top immediately for responsive UX
      if (scrollViewRef.current) {
        (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
      }
      // Fetch chapter content asynchronously
      await fetchChapterContent(chaptersWithContent[index].id);
      setLoadingChapters(false);
    } else {
      setShowToc(false);
    }
  };

  const fetchBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const bookId = (Array.isArray(id) ? id[0] : id)!;
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
        const localUri = await checkLocalDocument(bookId!);
        if (localUri) {
          setLocalDocumentUri(localUri);
        }
        
        // For reflow-capable formats, fetch processed chapters
        if (data.document_type === 'pdf' || data.document_type === 'epub' || data.document_type === 'docx') {
          const chaptersResult = await fetchChapters(bookId);
          
          // If no chapters found, show original PDF immediately and process in background
          if (!chaptersResult || chaptersResult.length === 0) {
            if (data.document_type === 'pdf') {
              // For PDFs, show original view immediately, process in background
              setViewMode('original');
              setLoading(false);
              // Process in background without blocking the UI
              showInfo('Processing document for reflow reading...');
              autoProcessDocument(data);
              return; // Exit early - don't wait for processing
            } else {
              // For EPUB/DOCX, need processing - show processing UI
              await autoProcessDocument(data);
            }
          } else {
            // Chapters exist - default to reflow mode
            setViewMode('reflow');
          }
        }
        
        // For Markdown, use existing flow
        if (data.document_type === 'markdown') {
          const documentUri = localUri || data.document_url;
          if (documentUri) {
            try {
              let text: string;
              if (localUri && documentUri.startsWith('file://') || documentUri.startsWith('/')) {
                text = await readAsStringAsync(documentUri);
              } else {
                const response = await fetch(documentUri);
                if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
                text = await response.text();
              }
              
              setRawContent(text);
              const html = markdownToHtml(text);
              setHtmlContent(html);
              const lines = text.split('\n').length;
              setTotalPages(Math.max(1, Math.ceil(lines / 40)));
              
              // Extract chapters for table of contents
              const extractedChapters = extractChapters(text);
              setChapters(extractedChapters.map((ch, i) => ({
                id: `chapter-${i}`,
                title: ch.title,
                level: ch.level,
              })));
            } catch (err: any) {
              setError(err?.message || 'Failed to load document content.');
            }
          }
        }
      } else {
        setError('Book not found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load book.');
    }
    setLoading(false);
  };

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;
    
    const scrollPercent = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    const page = Math.max(1, Math.ceil(scrollPercent * totalPages));
    const pct = Math.min(100, scrollPercent * 100);
    
    setCurrentPage(page);
    setProgressPercent(pct);

    // Auto-save reading progress (throttled)
    if (book) {
      updateReadingProgress({
        book_id: bookIdRef.current,
        page_number: page,
        progress_percent: pct,
      });
    }
    
    // Auto-hide header on scroll
    if (!headerAutoHidden) {
      setHeaderAutoHidden(true);
      setShowHeader(false);
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      headerTimerRef.current = setTimeout(() => {
        setHeaderAutoHidden(false);
        setShowHeader(true);
      }, 3000);
    }
  }, [book, totalPages, updateReadingProgress, headerAutoHidden]);

  const toggleHeader = () => {
    if (headerAutoHidden) {
      // Show header and reset auto-hide timer
      setShowHeader(true);
      setHeaderAutoHidden(false);
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      headerTimerRef.current = setTimeout(() => {
        setHeaderAutoHidden(true);
        setShowHeader(false);
      }, 3000);
    } else {
      setShowHeader(!showHeader);
    }
  };

  const toggleActions = () => {
    setShowActions(!showActions);
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, readingSettings.fontSize + delta));
    setReadingSettings({ fontSize: newSize });
  };

  const changeTheme = () => {
    const themes: Array<'light' | 'dark' | 'system' | 'blue'> = ['light', 'dark', 'system', 'blue'];
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
        user_id: user.id,
        chapter_id: null,
      } as any);
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
        user_id: user.id,
        chapter_id: null,
        text_offset_start: null,
        text_offset_end: null,
      } as any);
      setShowNoteModal(false);
      setNoteText('');
      showSuccess('Text highlighted.');
    } catch (err) {
      showError('Failed to save highlight.');
    }
  };

  // In-book search
  const searchInBook = async (query: string) => {
    if (!book || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchQuery = query.trim().toLowerCase();
      const results: { chapterId: string; chapterTitle: string; matchIndex: number; snippet: string }[] = [];
      let matchIndex = 0;

      // Search through all chapters
      for (const chapter of chaptersWithContent) {
        const content = chapter.content || '';
        const lowerContent = content.toLowerCase();
        
        // Find all matches in this chapter
        let index = 0;
        while (true) {
          const foundIndex = lowerContent.indexOf(searchQuery, index);
          if (foundIndex === -1) break;
          
          // Extract snippet around the match
          const snippetStart = Math.max(0, foundIndex - 50);
          const snippetEnd = Math.min(content.length, foundIndex + query.length + 50);
          let snippet = content.substring(snippetStart, snippetEnd);
          
          // Highlight the match in the snippet
          const lowerSnippet = snippet.toLowerCase();
          const matchPos = lowerSnippet.indexOf(searchQuery);
          if (matchPos !== -1) {
            const before = snippet.substring(0, matchPos);
            const match = snippet.substring(matchPos, matchPos + query.length);
            const after = snippet.substring(matchPos + query.length);
            snippet = `${before}<mark style="background-color: #FFC928; color: inherit;">${match}</mark>${after}`;
          }
          
          results.push({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            matchIndex,
            snippet,
          });
          
          matchIndex++;
          index = foundIndex + query.length;
          
          // Limit results to prevent performance issues
          if (results.length >= 100) break;
        }
        
        if (results.length >= 100) break;
      }

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIndex(0);
      }
    } catch (err) {
      console.error('Search error:', err);
      showError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      searchInBook(searchQuery);
    }
  };

  const navigateToSearchResult = (index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    setCurrentSearchIndex(index);
    const result = searchResults[index];
    
    // Find the chapter in the combined HTML and scroll to it
    // The chapter ID is used as an anchor in the HTML
    // For now, just show the snippet
    showInfo(`Match ${index + 1} of ${searchResults.length}: ${result.chapterTitle}`);
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
        user_id: user.id,
        chapter_id: null,
      } as any);
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
      case 'system':
        return {
          background: isDark ? '#1a1a1a' : '#FFFFFF',
          text: isDark ? '#e0e0e0' : '#1a1a1a',
          secondaryText: isDark ? '#888888' : '#666666',
        };
      case 'blue':
        return {
          background: '#1a2744',
          text: '#D6E4F0',
          secondaryText: '#8BA4C0',
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
    
    if (readingSettings.theme === 'dark' || readingSettings.theme === 'blue') {
      return {
        ...markdownHtmlStylesDark,
        document: {
          ...markdownHtmlStylesDark.document,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
        p: {
          ...markdownHtmlStylesDark.p,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
        li: {
          ...markdownHtmlStylesDark.li,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
      };
    }

    return {
      ...markdownHtmlStyles,
      document: {
        ...markdownHtmlStyles.document,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
      p: {
        ...markdownHtmlStyles.p,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
      li: {
        ...markdownHtmlStyles.li,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
    };
  };

  const themeColors = getThemeColors();
  const htmlStyles = getHtmlStyles();
  const contentWidth = SCREEN_WIDTH - readingSettings.margins * 2;

  // Calculate estimated reading time (average 200 words per minute)
  const estimatedReadingTime = useMemo(() => {
    const words = rawContent.split(/\s+/).filter(w => w.length > 0).length;
    const minutes = Math.ceil(words / 200);
    if (minutes < 60) return `${minutes} min read`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m read`;
  }, [rawContent]);

  // Calculate word count
  const wordCount = useMemo(() => {
    return rawContent.split(/\s+/).filter(w => w.length > 0).length;
  }, [rawContent]);

  // Navigate to a chapter (for markdown)
  const navigateToChapter = useCallback((index: number) => {
    if (chaptersWithContent.length > 0) {
      navigateToChapterIndex(index);
    } else if (scrollViewRef.current && htmlContent) {
      (scrollViewRef.current as any).scrollTo({ y: 0, animated: true });
      setShowToc(false);
    }
  }, [chaptersWithContent.length, htmlContent]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
        {processingDocument ? (
          <View style={styles.loadingProcessing}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingProcessingText, { color: themeColors.text }]}>
              {processingMessage || 'Processing document...'}
            </Text>
            <Text style={[styles.loadingProcessingSubText, { color: themeColors.secondaryText }]}>
              Converting to reflow format for smooth reading
            </Text>
            <Text style={[styles.loadingProcessingHint, { color: themeColors.secondaryText }]}>
              This may take a moment for larger files
            </Text>
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
      <StatusBar
        barStyle={(readingSettings.theme === 'dark' || readingSettings.theme === 'blue') ? 'light-content' : 'dark-content'}
      />
      
      {/* Header */}
      {showHeader && (
        <AnimatedView fadeDelay={50} fadeDuration={300} slideDirection="down" slideDistance={20}>
          <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: colors.border, paddingTop: insets.top + SPACING.sm }]}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
                {book?.title || 'Reader'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: themeColors.secondaryText }]}>
                {currentPage} / {totalPages} · {estimatedReadingTime}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowSearch(true)} accessibilityLabel="Search in book">
                <Ionicons name="search" size={22} color={themeColors.text} />
              </TouchableOpacity>
              {chapters.length > 1 && (
                <TouchableOpacity onPress={() => setShowToc(true)} accessibilityLabel="Table of contents">
                  <Ionicons name="list" size={22} color={themeColors.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleActions} accessibilityLabel="Reader actions">
                <Ionicons name="ellipsis-horizontal" size={22} color={themeColors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSettings(true)} accessibilityLabel="Reading settings">
                <Ionicons name="settings-outline" size={22} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedView>
      )}

      {/* Progress Bar */}
      {book?.document_type !== 'pdf' && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarTrack, { backgroundColor: themeColors.secondaryText + '20' }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Content — Reflow Mode or Original PDF */}
      <AnimatedView style={{ flex: 1 }} fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <TouchableOpacity
          style={styles.tapArea}
          onPress={toggleHeader}
          activeOpacity={1}
        >
        {book?.document_type === 'pdf' && viewMode === 'original' && (localDocumentUri || book.document_url) ? (
          // Original PDF Reader (native rendering)
          <View style={{ flex: 1 }}>
            <PdfReader
              sourceUri={localDocumentUri || book.document_url || ''}
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
          // Reflow Mode — HTML rendering for all formats (PDF, EPUB, DOCX, Markdown)
          <ScrollView
            ref={scrollViewRef as any}
            style={[styles.content, { backgroundColor: themeColors.background }]}
            contentContainerStyle={[
              styles.contentContainer,
              {
                paddingHorizontal: readingSettings.margins,
                paddingBottom: insets.bottom + SPACING.xxl + 20,
              },
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            showsVerticalScrollIndicator={false}
          >
            {processingDocument ? (
              <View style={styles.loadingChapters}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>
                  {processingMessage || 'Processing document...'}
                </Text>
                <Text style={[styles.loadingChaptersSubText, { color: themeColors.secondaryText }]}>
                  This may take a moment for larger files.
                </Text>
              </View>
            ) : loadingChapters ? (
              <View style={styles.loadingChapters}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>
                  Loading content...
                </Text>
              </View>
            ) : htmlContent ? (
              <RenderHtml
                source={{ html: htmlContent }}
                contentWidth={contentWidth}
                tagsStyles={htmlStyles}
                systemFonts={[readingSettings.fontFamily, 'systemFont', 'HelveticaNeue', 'Arial']}
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
      </AnimatedView>
      
      {/* View Mode Toggle for PDF Books */}
      {book?.document_type === 'pdf' && (
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              viewMode === 'reflow' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('reflow')}
          >
            <Ionicons
              name="text"
              size={16}
              color={viewMode === 'reflow' ? '#FFFFFF' : colors.primary}
            />
            <Text style={[
              styles.viewModeButtonText,
              { color: viewMode === 'reflow' ? '#FFFFFF' : colors.primary }
            ]}>
              Reflow
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              viewMode === 'original' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('original')}
          >
            <Ionicons
              name="document-text"
              size={16}
              color={viewMode === 'original' ? '#FFFFFF' : colors.primary}
            />
            <Text style={[
              styles.viewModeButtonText,
              { color: viewMode === 'original' ? '#FFFFFF' : colors.primary }
            ]}>
              Original PDF
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Chapter Navigation for Reflow Mode - Hidden for continuous scrolling */}
      {/* {chaptersWithContent.length > 1 && viewMode === 'reflow' && (
        <View style={[styles.chapterNav, { backgroundColor: themeColors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.chapterNavButton, { opacity: currentChapterIndex === 0 ? 0.3 : 1 }]}
            onPress={() => navigateToChapterIndex(currentChapterIndex - 1)}
            disabled={currentChapterIndex === 0}
          >
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
            <Text style={[styles.chapterNavText, { color: themeColors.text }]}>Prev</Text>
          </TouchableOpacity>
          <View style={styles.chapterNavCenter}>
            <Text style={[styles.chapterNavTitle, { color: themeColors.text }]} numberOfLines={1}>
              {chaptersWithContent[currentChapterIndex]?.title || 'Chapter'}
            </Text>
            <Text style={[styles.chapterNavSub, { color: themeColors.secondaryText }]}>
              {currentChapterIndex + 1} / {chaptersWithContent.length}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chapterNavButton, { opacity: currentChapterIndex >= chaptersWithContent.length - 1 ? 0.3 : 1 }]}
            onPress={() => navigateToChapterIndex(currentChapterIndex + 1)}
            disabled={currentChapterIndex >= chaptersWithContent.length - 1}
          >
            <Text style={[styles.chapterNavText, { color: themeColors.text }]}>Next</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.text} />
          </TouchableOpacity>
        </View>
      )} */}

      {/* Action Bar */}
      {showActions && (
        <View style={[styles.actionBar, { backgroundColor: themeColors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionButton, isPageBookmarked && styles.actionButtonActive]}
            onPress={handleBookmark}
            accessibilityLabel={isPageBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          >
            <Ionicons
              name={isPageBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isPageBookmarked ? colors.primary : themeColors.text}
            />
            <Text style={[styles.actionButtonText, { color: isPageBookmarked ? colors.primary : themeColors.text }]}>
              {isPageBookmarked ? 'Bookmarked' : 'Bookmark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHighlight}
            accessibilityLabel="Highlight text"
          >
            <Ionicons name="pencil" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Highlight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={openNoteModal}
            accessibilityLabel="Add note"
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
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
                style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveNote}
                accessibilityLabel="Save note"
              >
                <Text style={styles.noteActionText}>Save Note</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                onPress={() => handleSaveHighlight(noteText || rawContent.substring(0, 300))}
                accessibilityLabel="Save highlight"
              >
                <Text style={styles.noteActionText}>Save Highlight</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table of Contents Modal */}
      <Modal visible={showToc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Table of Contents</Text>
              <TouchableOpacity onPress={() => setShowToc(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {chapters.map((chapter, index) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={[
                    styles.tocItem,
                    { paddingLeft: chapter.level === 1 ? 0 : chapter.level === 2 ? SPACING.md : SPACING.lg },
                  ]}
                  onPress={() => navigateToChapter(index)}
                >
                  <Text
                    style={[
                      styles.tocItemText,
                      {
                        color: themeColors.text,
                        fontSize: chapter.level === 1 ? 16 : chapter.level === 2 ? 14 : 13,
                        fontWeight: chapter.level === 1 ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {chapter.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Search in Book</Text>
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              <TextInput
                style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: colors.border }]}
                placeholder="Search..."
                placeholderTextColor={themeColors.secondaryText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoFocus={true}
                accessibilityLabel="Search text input"
              />
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: colors.primary }]}
                onPress={handleSearch}
                disabled={isSearching || searchQuery.trim().length < 2}
              >
                <Ionicons name="search" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {isSearching ? (
              <View style={styles.loadingChapters}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>
                  Searching...
                </Text>
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <Text style={[styles.searchResultCount, { color: themeColors.secondaryText }]}>
                  {searchResults.length} matches found
                </Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {searchResults.map((result, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.searchResultItem,
                        { borderBottomColor: colors.border },
                        index === currentSearchIndex && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => navigateToSearchResult(index)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
                        <Ionicons name="bookmark" size={16} color={colors.primary} />
                        <Text style={[styles.searchResultChapter, { color: themeColors.text }]}>
                          {result.chapterTitle}
                        </Text>
                      </View>
                      <Text style={[styles.searchResultSnippet, { color: themeColors.secondaryText }]}>
                        {result.snippet.replace(/<[^>]+>/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md }}>
                  <TouchableOpacity
                    style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                    onPress={() => navigateToSearchResult(currentSearchIndex - 1)}
                    disabled={currentSearchIndex === 0}
                  >
                    <Ionicons name="arrow-up" size={20} color={currentSearchIndex === 0 ? themeColors.secondaryText : colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.searchNavText, { color: themeColors.text }]}>
                    {currentSearchIndex + 1} / {searchResults.length}
                  </Text>
                  <TouchableOpacity
                    style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                    onPress={() => navigateToSearchResult(currentSearchIndex + 1)}
                    disabled={currentSearchIndex >= searchResults.length - 1}
                  >
                    <Ionicons name="arrow-down" size={20} color={currentSearchIndex >= searchResults.length - 1 ? themeColors.secondaryText : colors.primary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : searchQuery.trim().length >= 2 ? (
              <View style={styles.emptySearch}>
                <Ionicons name="search" size={48} color={themeColors.secondaryText} />
                <Text style={[styles.emptySearchText, { color: themeColors.secondaryText }]}>
                  No matches found
                </Text>
                <Text style={[styles.emptySearchSubText, { color: themeColors.secondaryText }]}>
                  Try a different search term
                </Text>
              </View>
            ) : null}
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
            <ThemeSelector
              selectedTheme={readingSettings.theme}
              onThemeChange={(theme) => setReadingSettings({ theme })}
              label="Theme"
            />

            {/* Font Family */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Family</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  {['System', 'Georgia', 'Merriweather', 'Lora', 'Literata', 'Open Sans', 'Roboto'].map((font) => (
                    <TouchableOpacity
                      key={font}
                      style={[
                        styles.fontFamilyButton,
                        { backgroundColor: themeColors.background, borderColor: colors.border },
                        readingSettings.fontFamily === font && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setReadingSettings({ fontFamily: font })}
                    >
                      <Text style={[
                        styles.fontFamilyButtonText,
                        { color: readingSettings.fontFamily === font ? '#FFFFFF' : themeColors.text },
                        { fontFamily: font === 'System' ? 'System' : font }
                      ]}>
                        {font}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Font Size */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Size</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity onPress={() => changeFontSize(-2)}>
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.fontSize}
                </Text>
                <TouchableOpacity onPress={() => changeFontSize(2)}>
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
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
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
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
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
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
                          ? 'remove'
                          : align === 'center'
                          ? 'aperture'
                          : 'resize'
                      }
                      size={20}
                      color={
                        readingSettings.textAlign === align
                          ? '#FFFFFF'
                          : colors.primary
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
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.margins}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setReadingSettings({ margins: Math.min(40, readingSettings.margins + 4) })
                  }
                >
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Audio Mini Player */}
      {book && (
        <AudioMiniPlayer bookId={book.id} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    textAlign: 'center',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pageIndicator: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.white,
  },
  // Progress bar styles
  progressBarContainer: {
    height: 3,
    width: '100%',
  },
  progressBarTrack: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  // Table of Contents styles
  tocItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tocItemText: {
    color: '#333',
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
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
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
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
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
    alignItems: 'center',
  },
  themeButtonActive: {
    borderWidth: 2,
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  themeButtonTextActive: {
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
    alignItems: 'center',
  },
  alignButtonActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  fontFamilyButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  fontFamilyButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Search modal styles
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultCount: {
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  searchResultItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
  },
  searchResultChapter: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  searchResultSnippet: {
    fontSize: 13,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  searchNavButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchNavText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptySearchText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySearchSubText: {
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  // Action bar styles
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
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
    fontSize: 15,
    fontWeight: '600',
  },
  // Loading chapters
  loadingChapters: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingChaptersText: {
    fontSize: 14,
    marginTop: SPACING.md,
  },
  loadingChaptersSubText: {
    fontSize: 12,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  // Processing document UI
  loadingProcessing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingProcessingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  loadingProcessingSubText: {
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  loadingProcessingHint: {
    fontSize: 12,
    marginTop: SPACING.xs,
    textAlign: 'center',
    opacity: 0.7,
  },
  // View mode toggle
  viewModeToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    justifyContent: 'center',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    gap: SPACING.xs,
  },
  viewModeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Chapter navigation
  chapterNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  chapterNavText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chapterNavCenter: {
    alignItems: 'center',
    flex: 1,
  },
  chapterNavTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  chapterNavSub: {
    fontSize: 11,
    marginTop: 2,
  },
});

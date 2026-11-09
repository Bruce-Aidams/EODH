import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/lib/notifications/toast';
import { SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PendingBook {
  id: string;
  file: any;
  title: string;
  author: string;
  documentType: 'pdf' | 'markdown';
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export default function AdminBulkUploadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useToast();
  const [uploading, setUploading] = useState(false);
  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  // Load categories
  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('book_categories')
        .select('*')
        .order('name', { ascending: true });
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Pick multiple document files
  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ['application/pdf', 'text/markdown', 'text/x-markdown', '.md', '.markdown'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length) {
        const newBooks: PendingBook[] = result.assets.map((asset, index) => {
          const mimeType = asset.mimeType || 'application/pdf';
          const documentType = mimeType.includes('pdf') ? 'pdf' : 'markdown';
          const nameWithoutExt = asset.name.replace(/\.[^/.]+$/, '');
          
          return {
            id: `${Date.now()}-${index}`,
            file: asset,
            title: nameWithoutExt,
            author: '',
            documentType,
            status: 'pending',
            progress: 0,
          };
        });

        setPendingBooks((prev) => [...prev, ...newBooks]);
        showWarning(`Added ${newBooks.length} files. Edit titles/authors before uploading.`);
      }
    } catch (error) {
      showError('Failed to pick document files.');
    }
  };

  // Update book metadata
  const updateBookMetadata = (id: string, field: 'title' | 'author', value: string) => {
    setPendingBooks((prev) =>
      prev.map((book) => (book.id === id ? { ...book, [field]: value } : book))
    );
  };

  // Remove a pending book
  const removeBook = (id: string) => {
    setPendingBooks((prev) => prev.filter((book) => book.id !== id));
  };

  // Upload a single file to Supabase Storage
  const uploadFile = async (
    bucket: string,
    fileUri: string,
    fileName: string,
    fileType: string
  ): Promise<string | null> => {
    try {
      const filePath = `${Date.now()}-${fileName}`;
      
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, uint8Array, {
          contentType: fileType,
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`Upload error (${bucket}):`, error);
      return null;
    }
  };

  // Process all pending books
  const handleBulkUpload = async () => {
    // Validate
    const invalid = pendingBooks.filter(
      (book) => !book.title.trim() || !book.author.trim()
    );
    if (invalid.length > 0) {
      showWarning('Please fill in title and author for all books.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingBooks.length; i++) {
      const book = pendingBooks[i];
      
      // Update status to uploading
      setPendingBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, status: 'uploading', progress: 10 } : b))
      );

      try {
        // Upload document
        const documentUrl = await uploadFile(
          'documents',
          book.file.uri,
          book.file.name,
          book.file.mimeType || 
            (book.documentType === 'pdf' ? 'application/pdf' : 'text/markdown')
        );

        if (!documentUrl) {
          throw new Error('Failed to upload document.');
        }

        setPendingBooks((prev) =>
          prev.map((b) => (b.id === book.id ? { ...b, progress: 60 } : b))
        );

        // Create book record
        const { data: createdBook, error: bookError } = await supabase
          .from('books')
          .insert({
            title: book.title.trim(),
            author: book.author.trim(),
            description: null,
            category_id: defaultCategory || null,
            cover_url: null,
            document_url: documentUrl,
            document_type: book.documentType,
            file_size: book.file.size || 0,
            language: 'en',
            publication_date: null,
            is_published: true,
            has_audio: false,
            audio_type: null,
          })
          .select()
          .single();

        if (bookError) throw bookError;

        setPendingBooks((prev) =>
          prev.map((b) => (b.id === book.id ? { ...b, status: 'done', progress: 100 } : b))
        );
        successCount++;
      } catch (error: any) {
        setPendingBooks((prev) =>
          prev.map((b) =>
            b.id === book.id
              ? { ...b, status: 'error', error: error?.message || 'Upload failed' }
              : b
          )
        );
        failCount++;
      }
    }

    setUploading(false);
    
    if (successCount > 0) {
      showSuccess(`${successCount} book(s) uploaded successfully!`);
    }
    if (failCount > 0) {
      showWarning(`${failCount} book(s) failed to upload.`);
    }

    if (successCount > 0) {
      setTimeout(() => {
        Alert.alert(
          'Bulk Upload Complete',
          `${successCount} succeeded, ${failCount} failed.`,
          [
            {
              text: 'View Books',
              onPress: () => router.push('/admin/books'),
            },
            {
              text: 'Upload More',
              onPress: () => {
                // Clear completed items
                setPendingBooks((prev) =>
                  prev.filter((b) => b.status === 'error')
                );
              },
            },
            {
              text: 'Done',
              onPress: () => router.back(),
            },
          ]
        );
      }, 500);
    }
  };

  const pendingCount = pendingBooks.filter((b) => b.status === 'pending').length;
  const uploadingCount = pendingBooks.filter((b) => b.status === 'uploading').length;
  const doneCount = pendingBooks.filter((b) => b.status === 'done').length;
  const errorCount = pendingBooks.filter((b) => b.status === 'error').length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bulk Upload</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Select multiple PDF or Markdown files at once. Fill in title and author for each book before uploading.
          </Text>
        </View>

        {/* Add Files Button */}
        <TouchableOpacity
          style={[styles.addFilesButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={pickDocuments}
          disabled={uploading}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <Text style={[styles.addFilesText, { color: colors.primary }]}>Add Files</Text>
        </TouchableOpacity>

        {/* Default Category */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Default Category</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={[defaultCategory ? styles.selectText : styles.selectPlaceholder, { color: defaultCategory ? colors.text : colors.textMuted }]}>
                {categories.find(c => c.id === defaultCategory)?.name || 'No category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Book List */}
        {pendingBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.listHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Books ({pendingBooks.length})</Text>
              <View style={styles.statusBadges}>
                {pendingCount > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.textMuted }]}>{pendingCount}</Text>
                  </View>
                )}
                {uploadingCount > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.primary }]}>
                      {uploadingCount}
                    </Text>
                  </View>
                )}
                {doneCount > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.primary }]}>
                      {doneCount}
                    </Text>
                  </View>
                )}
                {errorCount > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.error + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.error }]}>
                      {errorCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {pendingBooks.map((book, index) => (
              <View key={book.id} style={[styles.bookItem, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
                <View style={[styles.bookIndex, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.bookIndexText, { color: '#FFFFFF' }]}>{index + 1}</Text>
                </View>
                <View style={styles.bookForm}>
                  <TextInput
                    style={[styles.bookInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    placeholder="Title"
                    value={book.title}
                    onChangeText={(text: string) => updateBookMetadata(book.id, 'title', text)}
                    editable={!uploading && book.status === 'pending'}
                  />
                  <TextInput
                    style={[styles.bookInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    placeholder="Author"
                    value={book.author}
                    onChangeText={(text: string) => updateBookMetadata(book.id, 'author', text)}
                    editable={!uploading && book.status === 'pending'}
                  />
                  <View style={styles.bookMeta}>
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: book.documentType === 'pdf' ? colors.error + '20' : colors.primary + '20' }
                    ]}>
                      <Text style={[
                        styles.typeBadgeText,
                        { color: book.documentType === 'pdf' ? colors.error : colors.primary }
                      ]}>
                        {book.documentType.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.fileName, { color: colors.text }]}>{book.file.name}</Text>
                  </View>
                  {book.status === 'uploading' && (
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${book.progress}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                  )}
                  {book.status === 'error' && book.error && (
                    <Text style={[styles.errorText, { color: colors.error }]}>{book.error}</Text>
                  )}
                  {book.status === 'done' && (
                    <Text style={[styles.successText, { color: colors.primary }]}>✓ Uploaded</Text>
                  )}
                </View>
                {book.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => removeBook(book.id)}
                    disabled={uploading}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
                {book.status === 'done' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
                {book.status === 'error' && (
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Upload All Button */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.primary }, uploading && { backgroundColor: colors.textMuted }]}
            onPress={handleBulkUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={[styles.uploadButtonText, { color: '#FFFFFF' }]}>Upload All ({pendingCount})</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bottom spacing */}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Default Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => {
                  setDefaultCategory('');
                  setShowCategoryModal(false);
                }}
              >
                <Text style={[styles.categoryText, { color: colors.text }]}>No category</Text>
                {!defaultCategory && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryItem, { backgroundColor: colors.surface }, defaultCategory === cat.id && { backgroundColor: colors.primary + '20' }]}
                  onPress={() => {
                    setDefaultCategory(cat.id);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[styles.categoryText, { color: colors.text }, defaultCategory === cat.id && { color: colors.primary, fontWeight: '600' }]}>{cat.name}</Text>
                  {defaultCategory === cat.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const TextInput = ({ style, ...props }: any) => {
  // Re-export from react-native with default styles
  const RNTextInput = require('react-native').TextInput;
  return <RNTextInput style={[styles.defaultInput, style]} {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: SPACING.md,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  addFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addFilesText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  input: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    borderWidth: 1,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 15,
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 15,
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  bookIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIndexText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookForm: {
    flex: 1,
    gap: SPACING.xs,
  },
  bookInput: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: 14,
    borderWidth: 1,
  },
  defaultInput: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: 14,
    borderWidth: 1,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  fileName: {
    fontSize: 12,
    flex: 1,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  errorText: {
    fontSize: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  categoryText: {
    fontSize: 15,
  },
});

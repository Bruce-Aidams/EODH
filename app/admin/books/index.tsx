import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { Book } from '@/types';
import { SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminBooksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingAll, setProcessingAll] = useState(false);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [showProcessingModal, setShowProcessingModal] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });
      setBooks(data || []);
    } catch (error) {
      console.error('Failed to fetch books:', error);
    }
    setLoading(false);
  };

  const handleTogglePublish = async (book: Book) => {
    try {
      const { error } = await supabase
        .from('books')
        .update({ is_published: !book.is_published })
        .eq('id', book.id);

      if (error) throw error;

      setBooks(books.map(b => 
        b.id === book.id ? { ...b, is_published: !b.is_published } : b
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to update book status.');
    }
  };

  const handleProcessAll = async () => {
    const unprocessed = books.filter(b => 
      b.document_type === 'pdf' || b.document_type === 'epub' || b.document_type === 'docx' || b.document_type === 'markdown'
    );

    if (unprocessed.length === 0) {
      Alert.alert('No Books to Process', 'All books have already been processed.');
      return;
    }

    Alert.alert(
      'Process All Books',
      `This will process ${unprocessed.length} book(s) for reflow reading. This may take several minutes. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setProcessingAll(true);
            setProcessingLog([]);
            setShowProcessingModal(true);

            try {
              const { processAllBooks } = await import('@/lib/admin/processAllBooks');
              const result = await processAllBooks((index, total, title, stage) => {
                setProcessingLog(prev => [...prev, `[${index + 1}/${total}] ${title}: ${stage}`]);
              });

              setProcessingLog(prev => [
                ...prev,
                '',
                `Processing complete!`,
                `Success: ${result.processed} book(s)`,
                `Failed: ${result.failed} book(s)`,
                ...(result.errors.length > 0 ? ['Errors:', ...result.errors] : []),
              ]);

              // Refresh books list
              await fetchBooks();
            } catch (err) {
              setProcessingLog(prev => [...prev, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
            }

            setProcessingAll(false);
          },
        },
      ]
    );
  };

  const handleDelete = (book: Book) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${book.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('books')
                .delete()
                .eq('id', book.id);

              if (error) throw error;

              setBooks(books.filter(b => b.id !== book.id));
              Alert.alert('Success', 'Book deleted successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete book.');
            }
          },
        },
      ]
    );
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Books</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleProcessAll} disabled={processingAll}>
            <Ionicons name="sync-outline" size={24} color={processingAll ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/admin/upload')}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchText, { color: colors.text }]}
            placeholder="Search books..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]} showsVerticalScrollIndicator={false}>
        {filteredBooks.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="book-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Books</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery ? 'No books match your search.' : 'Upload your first book to get started.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/admin/upload')}
              >
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={[styles.uploadButtonText, { color: '#FFFFFF' }]}>Upload Book</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredBooks.map((book) => (
            <View key={book.id} style={[styles.bookCard, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
              {/* Cover */}
              <View style={styles.bookCover}>
                {book.cover_url ? (
                  <View style={styles.coverImage} />
                ) : (
                  <View style={[styles.coverGradient, { backgroundColor: colors.primary }]}>
                    <Ionicons name="book" size={32} color="#FFFFFF" />
                  </View>
                )}
                <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.typeBadgeText, { color: '#FFFFFF' }]}>
                    {book.document_type === 'pdf' ? 'PDF' : book.document_type === 'epub' ? 'EPUB' : book.document_type === 'docx' ? 'DOCX' : 'MD'}
                  </Text>
                </View>
                {book.processing_status && book.processing_status !== 'completed' && (
                  <View style={[styles.statusBadge, { backgroundColor: book.processing_status === 'failed' ? colors.error : book.processing_status === 'processing' ? '#FF9800' : '#9E9E9E' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#FFFFFF' }]}>
                      {book.processing_status === 'processing' ? 'Processing' : book.processing_status === 'failed' ? 'Failed' : 'Pending'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.bookInfo}>
                <View style={styles.bookHeader}>
                  <View style={styles.bookTitleContainer}>
                    <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
                    <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{book.author}</Text>
                  </View>
                  {book.is_published && (
                    <View style={styles.publishedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    </View>
                  )}
                </View>

                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {book.publication_date || 'No date'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="document-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {formatFileSize(book.file_size)}
                    </Text>
                  </View>
                  {book.total_chapters != null && book.total_chapters > 0 && (
                    <View style={styles.metaItem}>
                      <Ionicons name="layers-outline" size={12} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {book.total_chapters} chapters
                      </Text>
                    </View>
                  )}
                  {book.has_audio && (
                    <View style={styles.metaItem}>
                      <Ionicons name="headset-outline" size={12} color={colors.primary} />
                      <Text style={[styles.metaText, { color: colors.primary }]}>
                        Audio
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.bookActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.previewButton, { borderColor: colors.border }]}
                    onPress={() => router.push(`/book/${book.id}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      Preview
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      book.is_published ? styles.unpublishButton : styles.publishButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={() => handleTogglePublish(book)}
                  >
                    <Ionicons
                      name={book.is_published ? 'eye-off-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={book.is_published ? colors.error : colors.primary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.primary },
                      ]}
                    >
                      {book.is_published ? 'Unpublish' : 'Publish'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton, { borderColor: colors.border }]}
                    onPress={() => handleDelete(book)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={[styles.actionButtonText, { color: colors.error }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Bottom spacing */}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Processing Modal */}
      <Modal
        visible={showProcessingModal}
        animationType="slide"
        onRequestClose={() => { if (!processingAll) setShowProcessingModal(false); }}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Processing Books</Text>
            {!processingAll && (
              <TouchableOpacity onPress={() => setShowProcessingModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.modalContent}>
            {processingLog.map((log, i) => (
              <Text
                key={i}
                style={[
                  styles.logLine,
                  { color: log.startsWith('Error') ? colors.error : log.includes('Success') ? colors.primary : colors.text },
                ]}
              >
                {log}
              </Text>
            ))}
            {processingAll && (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.textSecondary }]}>Processing...</Text>
              </View>
            )}
          </ScrollView>

          {!processingAll && (
            <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowProcessingModal(false)}
              >
                <Text style={[styles.closeButtonText, { color: '#FFFFFF' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
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
    alignItems: 'center',
    justifyContent: 'center',
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
  searchContainer: {
    padding: SPACING.md,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchText: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: 15,
  },
  content: {
    padding: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  uploadButton: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bookCard: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: SPACING.md,
  },
  bookCover: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  bookInfo: {
    flex: 1,
  },
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  bookTitleContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookAuthor: {
    fontSize: 11,
    marginTop: 2,
  },
  publishedBadge: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  bookActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  previewButton: {
  },
  publishButton: {
  },
  unpublishButton: {
  },
  deleteButton: {
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  logLine: {
    fontSize: 13,
    fontFamily: 'monospace',
    paddingVertical: 2,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  processingText: {
    fontSize: 13,
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  closeButton: {
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

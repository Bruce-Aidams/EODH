import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { Book } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminBooksScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.royalPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Books</Text>
        <TouchableOpacity onPress={() => router.push('/admin/upload')}>
          <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={COLORS.gray400} />
          <TextInput
            style={styles.searchText}
            placeholder="Search books..."
            placeholderTextColor={COLORS.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filteredBooks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={COLORS.gray300} />
            <Text style={styles.emptyTitle}>No Books</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No books match your search.' : 'Upload your first book to get started.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => router.push('/admin/upload')}
              >
                <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
                <Text style={styles.uploadButtonText}>Upload Book</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredBooks.map((book) => (
            <View key={book.id} style={styles.bookCard}>
              {/* Cover */}
              <View style={styles.bookCover}>
                {book.cover_url ? (
                  <View style={styles.coverImage} />
                ) : (
                  <View style={styles.coverGradient}>
                    <Ionicons name="book" size={32} color={COLORS.white} />
                  </View>
                )}
                <View style={[styles.typeBadge, { backgroundColor: book.document_type === 'pdf' ? COLORS.violet : COLORS.gold }]}>
                  <Text style={styles.typeBadgeText}>
                    {book.document_type === 'pdf' ? 'PDF' : 'MD'}
                  </Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.bookInfo}>
                <View style={styles.bookHeader}>
                  <View style={styles.bookTitleContainer}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
                  </View>
                  {book.is_published && (
                    <View style={styles.publishedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    </View>
                  )}
                </View>

                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.gray500} />
                    <Text style={styles.metaText}>
                      {book.publication_date || 'No date'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="document-outline" size={12} color={COLORS.gray500} />
                    <Text style={styles.metaText}>
                      {formatFileSize(book.file_size)}
                    </Text>
                  </View>
                  {book.has_audio && (
                    <View style={styles.metaItem}>
                      <Ionicons name="headset-outline" size={12} color={COLORS.gold} />
                      <Text style={[styles.metaText, { color: COLORS.gold }]}>
                        Audio
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.bookActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.previewButton]}
                    onPress={() => router.push(`/book/${book.id}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color={COLORS.royalPurple} />
                    <Text style={[styles.actionButtonText, { color: COLORS.royalPurple }]}>
                      Preview
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      book.is_published ? styles.unpublishButton : styles.publishButton,
                    ]}
                    onPress={() => handleTogglePublish(book)}
                  >
                    <Ionicons
                      name={book.is_published ? 'eye-off-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={book.is_published ? COLORS.warning : COLORS.success}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: book.is_published ? COLORS.warning : COLORS.success },
                      ]}
                    >
                      {book.is_published ? 'Unpublish' : 'Publish'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(book)}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                    <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
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
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.deepNavy,
    textAlign: 'center',
  },
  searchContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchText: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.deepNavy,
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
    color: COLORS.gray600,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.royalPurple,
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
    color: COLORS.white,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
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
    backgroundColor: COLORS.gray200,
  },
  coverGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.royalPurple,
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
    color: COLORS.white,
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
    color: COLORS.deepNavy,
  },
  bookAuthor: {
    fontSize: 12,
    color: COLORS.gray500,
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
    color: COLORS.gray500,
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
    backgroundColor: COLORS.royalPurple + '10',
  },
  publishButton: {
    backgroundColor: COLORS.success + '10',
  },
  unpublishButton: {
    backgroundColor: COLORS.warning + '10',
  },
  deleteButton: {
    backgroundColor: COLORS.error + '10',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

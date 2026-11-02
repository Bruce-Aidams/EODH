import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLibraryStore } from '@/stores/libraryStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Book } from '@/types';
import LazyImage from '@/components/LazyImage';

export default function LibraryScreen() {
  const router = useRouter();
  const { books, isLoading, searchQuery, sortBy, fetchBooks, setSearchQuery, setSortBy } = useLibraryStore();
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    fetchBooks();
  }, []);

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(localSearch.toLowerCase()) ||
    book.author.toLowerCase().includes(localSearch.toLowerCase())
  );

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={styles.bookItem}
      onPress={() => router.push(`/book/${item.id}`)}
    >
      <View style={styles.bookCover}>
        <LazyImage
          uri={item.cover_url || undefined}
          width={56}
          height={76}
          borderRadius={BORDER_RADIUS.sm}
        />
        {item.has_audio && (
          <View style={styles.audioBadge}>
            <Ionicons name="headset" size={10} color={COLORS.white} />
          </View>
        )}
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
        <View style={styles.bookMeta}>
          <View style={styles.metaBadge}>
            <Ionicons name={item.document_type === 'pdf' ? 'document-text' : 'code-slash'} size={10} color={COLORS.gray500} />
            <Text style={styles.metaText}>{item.document_type.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search books..."
          placeholderTextColor={COLORS.gray400}
          value={localSearch}
          onChangeText={(text) => {
            setLocalSearch(text);
            setSearchQuery(text);
          }}
        />
        {localSearch.length > 0 && (
          <TouchableOpacity onPress={() => setLocalSearch('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.gray400} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
          onPress={() => setSortBy('title')}
        >
          <Text style={[styles.sortText, sortBy === 'title' && styles.sortTextActive]}>A-Z</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
          onPress={() => setSortBy('date')}
        >
          <Text style={[styles.sortText, sortBy === 'date' && styles.sortTextActive]}>Newest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'author' && styles.sortButtonActive]}
          onPress={() => setSortBy('author')}
        >
          <Text style={[styles.sortText, sortBy === 'author' && styles.sortTextActive]}>Author</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
        </View>
      ) : filteredBooks.length > 0 ? (
        <FlatList
          data={filteredBooks}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={64} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {localSearch ? 'No Results Found' : 'Library is Empty'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {localSearch
              ? 'Try a different search term.'
              : 'Books will appear here when added by the administrator.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.deepNavy,
    height: 40,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sortButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white,
  },
  sortButtonActive: {
    backgroundColor: COLORS.royalPurple,
  },
  sortText: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  sortTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.md,
  },
  bookItem: {
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
  },
  bookCover: {
    width: 50,
    height: 70,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.deepNavy,
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: SPACING.xs,
  },
  bookMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
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
  },
});

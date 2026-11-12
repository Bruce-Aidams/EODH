import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { supabase } from '@/lib/supabase/client';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS, SHADOWS, toGradientCSS } from '@/constants/theme';
import { useResponsiveDimensions } from '@/lib/responsive/useResponsiveDimensions';
import { Book } from '@/types';
import LazyImage from '@/components/LazyImage';
import FilterChip from '@/components/FilterChip';
import SearchBar from '@/components/SearchBar';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonList } from '@/components/Skeleton';
import { useHaptics } from '@/lib/haptics';

export default function LibraryScreen() {
  const router = useRouter();
  const books = useLibraryStore((s) => s.books);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const sortBy = useLibraryStore((s) => s.sortBy);
  const fetchBooks = useLibraryStore((s) => s.fetchBooks);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const setSortBy = useLibraryStore((s) => s.setSortBy);
  const { colors, isDark } = useTheme();
  const { haptic } = useHaptics();
  const dimensions = useResponsiveDimensions();
  const insets = useSafeAreaInsets();
  const [localSearch, setLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'pdf' | 'markdown' | 'audio'>('all');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBooks();
    setRefreshing(false);
  }, [fetchBooks]);


  // Load categories once on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Background refresh on focus — fetchBooks skips if cache is fresh (< 60s TTL)
  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [fetchBooks])
  );

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('book_categories')
        .select('id, name')
        .order('name');
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const filteredBooks = useMemo(() => {
    let result = books.filter(book =>
      book.title.toLowerCase().includes(localSearch.toLowerCase()) ||
      book.author.toLowerCase().includes(localSearch.toLowerCase())
    );

    if (selectedCategory) {
      result = result.filter(book => book.category_id === selectedCategory);
    }

    if (selectedType === 'pdf') {
      result = result.filter(book => book.document_type === 'pdf');
    } else if (selectedType === 'markdown') {
      result = result.filter(book => book.document_type === 'markdown');
    } else if (selectedType === 'audio') {
      result = result.filter(book => book.has_audio);
    }

    return result;
  }, [books, localSearch, selectedCategory, selectedType]);

  const clearFilters = () => {
    setLocalSearch('');
    setSelectedCategory('');
    setSelectedType('all');
  };

  const hasFilters = localSearch || selectedCategory || selectedType !== 'all';

  const renderBook = useCallback(({ item, index }: { item: Book; index: number }) => {
    return (
      <AnimatedView
        disableAnimation
        onPress={() => router.push(`/book/${item.id}`)}
        style={[styles.bookItem, { backgroundColor: colors.card }]}
      >
        <View style={[styles.bookCover, { width: dimensions.listCoverWidth, height: dimensions.listCoverHeight }]}>
          <LazyImage
            uri={item.cover_url || undefined}
            width={dimensions.listCoverWidth}
            height={dimensions.listCoverHeight}
            borderRadius={BORDER_RADIUS.md}
          />
          {item.has_audio && (
            <View style={styles.audioBadge}>
              <Ionicons name="headset" size={10} color={COLORS.white} />
            </View>
          )}
        </View>
        <View style={styles.bookInfo}>
          <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.bookAuthor, { color: colors.textSecondary }]}>{item.author}</Text>
          <View style={styles.bookMeta}>
            <View style={[styles.metaBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons
                name={item.document_type === 'pdf' ? 'document-text' : 'code-slash'}
                size={10}
                color={colors.textSecondary}
              />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.document_type.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </AnimatedView>
    );
  }, [router, colors.card, dimensions.listCoverWidth, dimensions.listCoverHeight]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Gradient Header */}
      <AnimatedView fadeDelay={50} fadeDuration={400} slideDirection="down" slideDistance={20}>
        <View style={[styles.gradientHeader, { backgroundImage: toGradientCSS(isDark ? GRADIENTS.dark : GRADIENTS.primary, 'diagonal'), paddingTop: insets.top + SPACING.md }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>My Library</Text>
            <TouchableOpacity
              style={styles.globalSearchButton}
              onPress={() => router.push('/search')}
              accessibilityLabel="Search all books"
            >
              <Ionicons name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <SearchBar
            value={localSearch}
            onChangeText={(text) => {
              setLocalSearch(text);
              setSearchQuery(text);
            }}
            placeholder="Search books..."
            onClear={() => setLocalSearch('')}
          />
        </View>
      </AnimatedView>

      {/* Combined Filters Row */}
      <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
        {[
          { key: 'all' as const, label: 'All', icon: 'library-outline' as const },
          { key: 'pdf' as const, label: 'PDFs', icon: 'document-text-outline' as const },
          { key: 'markdown' as const, label: 'MD', icon: 'code-slash-outline' as const },
          { key: 'audio' as const, label: 'Audiobooks', icon: 'headset-outline' as const },
        ].map((type) => (
          <FilterChip
            key={type.key}
            label={type.label}
            icon={type.icon}
            selected={selectedType === type.key}
            onPress={() => setSelectedType(type.key)}
          />
        ))}
        {categories.length > 0 && (
          <>
            <View style={styles.filterDivider} />
            <FilterChip
              label="All"
              selected={!selectedCategory}
              onPress={() => setSelectedCategory('')}
            />
          </>
        )}
        {categories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.name}
            selected={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
        {hasFilters && (
          <TouchableOpacity onPress={clearFilters} style={[styles.clearFilterButton, { backgroundColor: COLORS.error + '15' }]}>
            <Ionicons name="close-circle" size={16} color={COLORS.error} />
            <Text style={[styles.clearFilterText, { color: COLORS.error }]}>Clear</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
      </AnimatedView>

      <AnimatedView fadeDelay={250} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortContainer}>
        {[
          { key: 'title' as const, label: 'A-Z' },
          { key: 'date' as const, label: 'Newest' },
          { key: 'author' as const, label: 'Author' },
        ].map((sort) => (
          <TouchableOpacity
            key={sort.key}
            activeOpacity={0.7}
            style={[
              styles.sortButton,
              { backgroundColor: colors.surfaceVariant },
              sortBy === sort.key && { backgroundColor: COLORS.royalPurple },
            ]}
            onPress={() => setSortBy(sort.key)}
          >
            <Text
              style={[
                styles.sortText,
                { color: colors.textSecondary },
                sortBy === sort.key && { color: COLORS.white },
              ]}
            >
              {sort.label}
            </Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </AnimatedView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonList count={8} itemHeight={80} />
        </View>
      ) : filteredBooks.length > 0 ? (
        <FlatList
          data={filteredBooks}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {localSearch ? 'No Results Found' : 'Library is Empty'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
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
  },
  gradientHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  globalSearchButton: {
    padding: SPACING.sm,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 8,
    paddingRight: SPACING.md,
  },
  filterContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 8,
    paddingRight: SPACING.md,
  },
  filterDivider: {
    width: 1,
    marginHorizontal: SPACING.xs,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  clearFilterText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  sortButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  sortText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.md,
    // paddingBottom is set dynamically with safe-area inset
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  bookCover: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  audioBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: COLORS.royalPurple,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 20,
  },
  bookAuthor: {
    fontSize: FONT_SIZE.sm,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
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
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});

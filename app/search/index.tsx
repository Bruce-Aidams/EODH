import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase/client';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchBar from '@/components/SearchBar';

interface SearchResult {
  book_id: string;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
  chapter_id: string | null;
  chapter_title: string;
  snippet: string;
  rank: number;
}

// Simple LRU cache for search results
class SearchCache {
  private cache = new Map<string, { result: SearchResult[]; timestamp: number }>();
  private readonly maxSize = 50;
  private readonly ttl = 5 * 60 * 1000; // 5 minutes

  get(key: string): SearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  set(key: string, result: SearchResult[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const iterator = this.cache.keys();
      const oldestKey = iterator.next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const searchCache = new SearchCache();

export default function GlobalSearchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    // Check cache first
    const cached = searchCache.get(trimmed);
    if (cached) {
      setResults(cached);
      setHasSearched(true);
      setIsSearching(false);
      return;
    }

    // Abort any previous in-flight search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Search all book content using full-text search function
      const { data, error } = await supabase.rpc('search_all_books', {
        p_query: trimmed,
        p_limit: 50,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      if (error) {
        console.error('Search error:', error);
        return;
      }

      if (data) {
        const searchResults: SearchResult[] = data.map((row: any) => ({
          book_id: row.book_id,
          book_title: row.book_title,
          book_author: row.book_author,
          book_cover_url: row.book_cover_url || null,
          chapter_id: row.chapter_id || null,
          chapter_title: row.chapter_title || '',
          snippet: row.snippet || '',
          rank: row.rank || 0,
        }));

        setResults(searchResults);
        searchCache.set(trimmed, searchResults);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Search error:', err);
    } finally {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  // Debounced auto-search: triggers when query changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    // Reduced debounce time for faster response (300ms instead of 400ms)
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleResultPress = (item: SearchResult) => {
    const params: Record<string, string> = {};
    if (item.chapter_id) {
      params.chapterId = item.chapter_id;
    }
    if (query.trim()) {
      params.searchQuery = query.trim();
    }
    router.push({
      pathname: `/book/${item.book_id}/reader`,
      params,
    });
  };

  const renderResult = useCallback(({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => handleResultPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        <Ionicons name="book" size={20} color={COLORS.royalPurple} />
        <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={1}>
          {item.book_title}
        </Text>
        <Text style={[styles.authorText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.book_author}
        </Text>
      </View>
      {item.chapter_id && item.chapter_title ? (
        <Text style={[styles.chapterText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.chapter_title}
        </Text>
      ) : null}
      {item.snippet ? (
        <Text style={[styles.snippetText, { color: colors.textMuted }]} numberOfLines={2}>
          {item.snippet.replace(/<mark>/g, '').replace(/<\/mark>/g, '')}
        </Text>
      ) : null}
    </TouchableOpacity>
  ), [colors.border, colors.text, colors.textSecondary, colors.textMuted, handleResultPress]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search Books</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={() => performSearch(query)}
          placeholder="Search across all books..."
        />
      </View>

      {/* Results */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      ) : hasSearched && results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.book_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
        />
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Search your library
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Find books by title, author, or content
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    padding: SPACING.md,
  },
  listContent: {
    padding: SPACING.md,
  },
  resultItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  bookTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginLeft: SPACING.xs,
    flex: 1,
  },
  authorText: {
    fontSize: FONT_SIZE.sm,
    marginLeft: SPACING.sm,
  },
  chapterText: {
    fontSize: FONT_SIZE.sm,
    marginLeft: SPACING.xs + 20,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  snippetText: {
    fontSize: FONT_SIZE.sm,
    marginLeft: SPACING.xs + 20,
    marginTop: SPACING.xs,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

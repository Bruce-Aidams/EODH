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
      // Use the optimized full-text search RPC function
      // This uses GIN indexes and websearch_to_tsquery for fast keyword search
      const { data, error } = await supabase
        .rpc('search_all_books', {
          p_query: trimmed,
          p_limit: 50,
        })
        .limit(50);

      if (abortControllerRef.current?.signal.aborted) return;

      if (error) {
        console.error('Search RPC error:', error);
        // Fallback: try searching books by title/author only if RPC fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('books')
          .select('id, title, author, cover_url')
          .ilike('title', `%${trimmed}%`)
          .or(`author.ilike.%${trimmed}%`)
          .limit(20);

        if (abortControllerRef.current?.signal.aborted) return;

        if (!fallbackError && fallbackData) {
          const fallbackResults: SearchResult[] = fallbackData.map((book: any) => ({
            book_id: book.id,
            book_title: book.title,
            book_author: book.author,
            book_cover_url: book.cover_url || null,
            chapter_id: null,
            chapter_title: book.title,
            snippet: `${book.title} by ${book.author}`,
            rank: 0,
          }));
          setResults(fallbackResults);
          searchCache.set(trimmed, fallbackResults);
        }
        return;
      }

      if (data) {
        const searchResults: SearchResult[] = data.map((item: any) => ({
          book_id: item.book_id || '',
          book_title: item.book_title || '',
          book_author: item.book_author || '',
          book_cover_url: item.book_cover_url || null,
          chapter_id: item.chapter_id || null,
          chapter_title: item.chapter_title || '',
          snippet: item.snippet || '',
          rank: item.rank || 0,
        }));

        // Sort by rank (relevance)
        searchResults.sort((a, b) => b.rank - a.rank);

        setResults(searchResults);
        searchCache.set(trimmed, searchResults);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Global search error:', err);
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

  const handleResultPress = (bookId: string) => {
    router.push(`/book/${bookId}/reader`);
  };

  // Clean snippet: remove HTML tags from ts_headline output
  const cleanSnippet = (snippet: string): string => {
    if (!snippet) return '';
    return snippet
      .replace(/<mark>/gi, '')
      .replace(/<\/mark>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => handleResultPress(item.book_id)}
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
      {item.chapter_id && (
        <View style={styles.chapterInfo}>
          <Ionicons name="document-text" size={16} color={colors.textMuted} />
          <Text style={[styles.chapterTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.chapter_title}
          </Text>
        </View>
      )}
      {item.snippet ? (
        <Text style={[styles.snippet, { color: colors.textMuted }]} numberOfLines={3}>
          {cleanSnippet(item.snippet)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search All Books</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={() => performSearch(query)}
          placeholder="Search titles, authors, content..."
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
          keyExtractor={(item) => `${item.book_id}-${item.chapter_id || 'meta'}`}
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
  chapterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  chapterTitle: {
    fontSize: FONT_SIZE.sm,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  snippet: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    marginLeft: 24,
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

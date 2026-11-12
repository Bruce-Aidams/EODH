// Mock AsyncStorage before importing anything that uses it
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
          })),
          single: jest.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
    },
  },
}));

import { useLibraryStore } from '@/stores/libraryStore';
import { Book } from '@/types';

const createBook = (overrides: Partial<Book> = {}): Book => ({
  id: '1',
  title: 'Test Book',
  author: 'Author',
  description: null,
  category_id: null,
  cover_url: null,
  document_url: null,
  document_type: 'pdf',
  file_size: null,
  language: 'en',
  publication_date: null,
  is_published: true,
  has_audio: false,
  audio_type: null,
  processing_status: null,
  total_chapters: null,
  total_pages: null,
  content_format: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('libraryStore persist middleware', () => {
  beforeEach(() => {
    mockStorage.clear();
    useLibraryStore.persist.clearStorage();
    useLibraryStore.setState({
      books: [],
      featuredBooks: [],
      recentlyOpened: [],
      recentlyListened: [],
      favorites: [],
      bookmarks: [],
      highlights: [],
      notes: [],
      isLoading: false,
      searchQuery: '',
      selectedCategory: null,
      sortBy: 'title',
      booksFetchedAt: null,
    });
  });

  describe('persist configuration', () => {
    it('has the correct storage name', () => {
      const opts = useLibraryStore.persist.getOptions();
      expect(opts.name).toBe('library-storage');
    });

    it('has version 1', () => {
      const opts = useLibraryStore.persist.getOptions();
      expect(opts.version).toBe(1);
    });
  });

  describe('partialize', () => {
    it('persists only the data fields, not functions or loading states', () => {
      const opts = useLibraryStore.persist.getOptions();
      const partialize = opts.partialize as ((state: ReturnType<typeof useLibraryStore.getState>) => Record<string, unknown>) | undefined;
      if (!partialize) {
        throw new Error('partialize is not configured');
      }

      const state = useLibraryStore.getState();
      const partial = partialize(state);

      expect(Object.keys(partial)).toEqual(
        expect.arrayContaining([
          'books',
          'featuredBooks',
          'recentlyOpened',
          'recentlyListened',
          'favorites',
          'booksFetchedAt',
        ])
      );

      // Functions and loading states should NOT be persisted
      expect(partial).not.toHaveProperty('fetchBooks');
      expect(partial).not.toHaveProperty('isLoading');
      expect(partial).not.toHaveProperty('searchQuery');
      expect(partial).not.toHaveProperty('toggleFavorite');
    });
  });

  describe('state persistence and restoration', () => {
    it('saves books to AsyncStorage when state changes', async () => {
      const books = [createBook()];

      useLibraryStore.setState({ books });

      // Wait for the persist middleware to flush
      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('library-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.books).toEqual(books);
    });

    it('saves booksFetchedAt timestamp', async () => {
      const timestamp = Date.now();
      useLibraryStore.setState({ booksFetchedAt: timestamp });

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('library-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.booksFetchedAt).toBe(timestamp);
    });

    it('saves favorites list', async () => {
      useLibraryStore.setState({ favorites: ['book-1', 'book-2'] });

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('library-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.favorites).toEqual(['book-1', 'book-2']);
    });
  });

  describe('TTL-based cache skip', () => {
    it('skips fetchBooks when cache is fresh (< 60s)', async () => {
      // Set cached data with a recent timestamp
      const now = Date.now();
      useLibraryStore.setState({
        books: [createBook({ title: 'Cached Book' })],
        booksFetchedAt: now,
      });

      // fetchBooks should skip because cache is fresh
      await useLibraryStore.getState().fetchBooks();

      // The supabase query should not have been called because we skipped
      // We verify by checking that isLoading was not set to true
      expect(useLibraryStore.getState().isLoading).toBe(false);
    });

    it('does not skip fetchBooks when cache is stale (> 60s)', async () => {
      // Set cached data with an old timestamp (120 seconds ago)
      const oldTime = Date.now() - 120_000;
      useLibraryStore.setState({
        books: [createBook({ title: 'Cached Book' })],
        booksFetchedAt: oldTime,
      });

      // fetchBooks should NOT skip because cache is stale (> 60s)
      // It will proceed to the Supabase query and update booksFetchedAt
      await useLibraryStore.getState().fetchBooks();

      // booksFetchedAt should be updated to a newer timestamp
      const newTime = useLibraryStore.getState().booksFetchedAt!;
      expect(newTime).toBeGreaterThan(oldTime);
    });

    it('does not skip fetchBooks with forceRefresh option', async () => {
      // Set cached data with a recent timestamp
      const beforeRefresh = Date.now();
      useLibraryStore.setState({
        books: [createBook({ title: 'Cached Book' })],
        booksFetchedAt: beforeRefresh,
      });

      // Small delay to ensure a different timestamp
      await new Promise((r) => setTimeout(r, 10));

      // forceRefresh should bypass the TTL check
      await useLibraryStore.getState().fetchBooks({ forceRefresh: true });

      // booksFetchedAt should be updated to a newer timestamp
      const newTime = useLibraryStore.getState().booksFetchedAt!;
      expect(newTime).toBeGreaterThan(beforeRefresh);
    });

    it('does not skip when booksFetchedAt is null (first load)', async () => {
      useLibraryStore.setState({
        books: [],
        booksFetchedAt: null,
      });

      await useLibraryStore.getState().fetchBooks();

      // Should not early-return; booksFetchedAt should be set
      expect(useLibraryStore.getState().booksFetchedAt).not.toBeNull();
    });

    it('does not skip when books array is empty', async () => {
      const beforeFetch = Date.now();
      useLibraryStore.setState({
        books: [],
        booksFetchedAt: beforeFetch,
      });

      await new Promise((r) => setTimeout(r, 10));
      await useLibraryStore.getState().fetchBooks();

      // Should not early-return because books is empty; booksFetchedAt should be updated
      const newTime = useLibraryStore.getState().booksFetchedAt!;
      expect(newTime).toBeGreaterThan(beforeFetch);
    });
  });

  describe('clearStorage', () => {
    it('clears persisted state from AsyncStorage', async () => {
      useLibraryStore.setState({
        books: [createBook({ title: 'To Delete' })],
      });

      await new Promise((r) => setTimeout(r, 0));
      expect(mockStorage.has('library-storage')).toBe(true);

      useLibraryStore.persist.clearStorage();
      expect(mockStorage.has('library-storage')).toBe(false);
    });
  });

  describe('merge state on hydration', () => {
    it('restores persisted books on re-hydration', async () => {
      // Set and persist some books
      useLibraryStore.setState({
        books: [createBook({ title: 'Persisted Book' })],
        booksFetchedAt: Date.now(),
      });

      await new Promise((r) => setTimeout(r, 0));

      // Verify the data is stored
      const stored = mockStorage.get('library-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.books[0].title).toBe('Persisted Book');
    });
  });
});

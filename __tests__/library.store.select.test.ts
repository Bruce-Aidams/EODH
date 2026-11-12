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

// Track select() calls to verify selective field usage
const selectCalls: string[] = [];

// Build a chainable mock without circular type references
function createChainableMock(): any {
  const chain: any = {};
  const selectFn = jest.fn((fields: string) => {
    selectCalls.push(fields);
    return chain;
  });
  const eqFn = jest.fn(() => chain);
  const orderFn = jest.fn(() => chain);
  const limitFn = jest.fn(() => chain);
  const singleFn = jest.fn(() => ({ data: null, error: null }));

  chain.select = selectFn;
  chain.eq = eqFn;
  chain.order = orderFn;
  chain.limit = limitFn;
  chain.single = singleFn;
  return chain;
}

const chainableMock = createChainableMock();

const mockFrom = jest.fn(() => {
  selectCalls.length = 0; // reset for each from() call
  return createChainableMock();
});

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
    },
  },
}));

import { useLibraryStore, BOOK_LIST_FIELDS } from '@/stores/libraryStore';

describe('libraryStore selective field selection', () => {
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
    jest.clearAllMocks();
  });

  describe('fetchBooks', () => {
    it('uses selective fields instead of * in the main query', async () => {
      useLibraryStore.setState({ booksFetchedAt: null });

      await useLibraryStore.getState().fetchBooks();

      expect(selectCalls).toContain(BOOK_LIST_FIELDS);
    });

    it('does not use * in any query', async () => {
      useLibraryStore.setState({ booksFetchedAt: null });

      await useLibraryStore.getState().fetchBooks();

      expect(selectCalls).not.toContain('*');
    });
  });

  describe('fetchFeaturedBooks', () => {
    it('uses selective fields instead of * in the main query', async () => {
      await useLibraryStore.getState().fetchFeaturedBooks();

      expect(selectCalls).toContain(BOOK_LIST_FIELDS);
    });

    it('does not use * in any query', async () => {
      await useLibraryStore.getState().fetchFeaturedBooks();

      expect(selectCalls).not.toContain('*');
    });
  });

  describe('selective fields coverage', () => {
    it('includes all fields needed for list views', () => {
      const fields = BOOK_LIST_FIELDS.split(', ').map((f) => f.trim());
      expect(fields).toContain('id');
      expect(fields).toContain('title');
      expect(fields).toContain('author');
      expect(fields).toContain('cover_url');
      expect(fields).toContain('document_type');
      expect(fields).toContain('created_at');
      expect(fields).toContain('has_audio');
    });

    it('excludes heavy fields not needed for list views', () => {
      const fields = BOOK_LIST_FIELDS.split(', ').map((f) => f.trim());
      expect(fields).not.toContain('description');
      expect(fields).not.toContain('document_url');
      expect(fields).not.toContain('file_size');
      expect(fields).not.toContain('total_chapters');
      expect(fields).not.toContain('total_pages');
      expect(fields).not.toContain('content_format');
    });
  });
});

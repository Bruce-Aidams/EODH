import { create } from 'zustand';
import { Book, ReadingProgress, ListeningProgress, Bookmark, Highlight, Note } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface LibraryState {
  books: Book[];
  featuredBooks: Book[];
  recentlyOpened: Book[];
  recentlyListened: (Book & { listeningProgress: ListeningProgress | null })[];
  favorites: string[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
  isLoading: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  sortBy: 'title' | 'date' | 'author';
  
  fetchBooks: () => Promise<void>;
  fetchFeaturedBooks: () => Promise<void>;
  fetchRecentlyOpened: () => Promise<void>;
  fetchRecentlyListened: () => Promise<void>;
  toggleFavorite: (bookId: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSortBy: (sortBy: 'title' | 'date' | 'author') => void;
  getReadingProgress: (bookId: string) => Promise<ReadingProgress | null>;
  getListeningProgress: (bookId: string) => Promise<ListeningProgress | null>;
  fetchReadingProgress: () => Promise<void>;
  fetchListeningProgress: () => Promise<void>;
  updateReadingProgress: (progress: Partial<ReadingProgress>) => Promise<void>;
  updateListeningProgress: (progress: Partial<ListeningProgress>) => Promise<void>;
  getBookmarks: (bookId: string) => Promise<Bookmark[]>;
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'created_at'>) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  getHighlights: (bookId: string) => Promise<Highlight[]>;
  addHighlight: (highlight: Omit<Highlight, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  removeHighlight: (highlightId: string) => Promise<void>;
  getNotes: (bookId: string) => Promise<Note[]>;
  addNote: (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateNote: (noteId: string, content: string) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
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

  fetchBooks: async () => {
    set({ isLoading: true });
    try {
      // Try fetching with is_published filter first; fall back to all books if the column doesn't exist
      let query = supabase.from('books').select('*').eq('is_published', true);

      if (get().selectedCategory) {
        query = query.eq('category_id', get().selectedCategory!);
      }

      switch (get().sortBy) {
        case 'title':
          query = query.order('title', { ascending: true });
          break;
        case 'date':
          query = query.order('created_at', { ascending: false });
          break;
        case 'author':
          query = query.order('author', { ascending: true });
          break;
      }

      let { data, error } = await query;
      if (error) {
        // If the is_published column doesn't exist, fall back to fetching all books
        console.warn('fetchBooks: is_published filter failed, falling back to all books:', error.message);
        let fallbackQuery = supabase.from('books').select('*');

        if (get().selectedCategory) {
          fallbackQuery = fallbackQuery.eq('category_id', get().selectedCategory!);
        }

        switch (get().sortBy) {
          case 'title':
            fallbackQuery = fallbackQuery.order('title', { ascending: true });
            break;
          case 'date':
            fallbackQuery = fallbackQuery.order('created_at', { ascending: false });
            break;
          case 'author':
            fallbackQuery = fallbackQuery.order('author', { ascending: true });
            break;
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) {
          console.error('fetchBooks: fallback also failed:', fallbackError.message);
          set({ books: [], isLoading: false });
          return;
        }
        set({ books: fallbackData || [], isLoading: false });
        return;
      }

      set({ books: data || [], isLoading: false });
    } catch (err) {
      console.error('fetchBooks: unexpected error:', err);
      set({ isLoading: false });
    }
  },

  fetchFeaturedBooks: async () => {
    try {
      // Try fetching with is_published filter first; fall back to all books if the column doesn't exist
      let { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.warn('fetchFeaturedBooks: is_published filter failed, falling back to all books:', error.message);
        const { data: fallbackData } = await supabase
          .from('books')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        set({ featuredBooks: fallbackData || [] });
        return;
      }

      set({ featuredBooks: data || [] });
    } catch (err) {
      console.error('fetchFeaturedBooks: unexpected error:', err);
    }
  },

  fetchRecentlyOpened: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('reading_progress')
        .select('book_id, books(*)')
        .eq('user_id', user.id)
        .order('last_read_at', { ascending: false })
        .limit(10);
      
      if (data) {
        const books = (data as any[]).map(item => item.books).filter(Boolean) as unknown as Book[];
        set({ recentlyOpened: books });
      }
    } catch {
      // Silent fail
    }
  },

  fetchRecentlyListened: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('listening_progress')
        .select('*, books(*)')
        .eq('user_id', user.id)
        .order('last_listened_at', { ascending: false })
        .limit(10);
      
      if (data) {
        const listened = data
          .map(item => ({ ...item.books, listeningProgress: item } as Book & { listeningProgress: ListeningProgress | null }))
          .filter(item => item.title !== undefined) as (Book & { listeningProgress: ListeningProgress | null })[];
        set({ recentlyListened: listened });
      }
    } catch {
      // Silent fail
    }
  },

  toggleFavorite: (bookId: string) => {
    const favorites = get().favorites;
    if (favorites.includes(bookId)) {
      set({ favorites: favorites.filter(id => id !== bookId) });
    } else {
      set({ favorites: [...favorites, bookId] });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSelectedCategory: (categoryId: string | null) => set({ selectedCategory: categoryId }),
  setSortBy: (sortBy: 'title' | 'date' | 'author') => set({ sortBy }),

  getReadingProgress: async (bookId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single();
    
    return data;
  },

  getListeningProgress: async (bookId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data } = await supabase
      .from('listening_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single();
    
    return data;
  },

  fetchReadingProgress: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('reading_progress').select('*').eq('user_id', user.id);
    } catch {
      // Silent fail
    }
  },

  fetchListeningProgress: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('listening_progress').select('*').eq('user_id', user.id);
    } catch {
      // Silent fail
    }
  },

  updateReadingProgress: async (progress: Partial<ReadingProgress>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const existing = await get().getReadingProgress(progress.book_id!);
    
    const data = {
      user_id: user.id,
      ...progress,
      last_read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    if (existing) {
      await supabase.from('reading_progress').update(data).eq('id', existing.id);
    } else {
      await supabase.from('reading_progress').insert(data);
    }
  },

  updateListeningProgress: async (progress: Partial<ListeningProgress>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const existing = await get().getListeningProgress(progress.book_id!);
    
    const data = {
      user_id: user.id,
      ...progress,
      last_listened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    if (existing) {
      await supabase.from('listening_progress').update(data).eq('id', existing.id);
    } else {
      await supabase.from('listening_progress').insert(data);
    }
  },

  getBookmarks: async (bookId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
    
    return data || [];
  },

  addBookmark: async (bookmark: Omit<Bookmark, 'id' | 'created_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const newBookmark = {
      ...bookmark,
      user_id: user.id,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    
    set(state => ({ bookmarks: [...state.bookmarks, newBookmark] }));
    
    await supabase.from('bookmarks').insert({
      ...bookmark,
      user_id: user.id,
    });
  },

  removeBookmark: async (bookmarkId: string) => {
    await supabase.from('bookmarks').delete().eq('id', bookmarkId);
  },

  getHighlights: async (bookId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data } = await supabase
      .from('highlights')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
    
    return data || [];
  },

  addHighlight: async (highlight: Omit<Highlight, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const newHighlight = {
      ...highlight,
      user_id: user.id,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    set(state => ({ highlights: [...state.highlights, newHighlight] }));
    
    await supabase.from('highlights').insert({
      ...highlight,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },

  removeHighlight: async (highlightId: string) => {
    await supabase.from('highlights').delete().eq('id', highlightId);
  },

  getNotes: async (bookId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
    
    return data || [];
  },

  addNote: async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const newNote = {
      ...note,
      user_id: user.id,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    set(state => ({ notes: [...state.notes, newNote] }));
    
    await supabase.from('notes').insert({
      ...note,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },

  updateNote: async (noteId: string, content: string) => {
    await supabase.from('notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', noteId);
  },

  removeNote: async (noteId: string) => {
    await supabase.from('notes').delete().eq('id', noteId);
  },
}));

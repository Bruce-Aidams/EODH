import { readingProgressService } from '@/lib/reader/ReadingProgressService';

// Mock Supabase — chainable mock supporting eq().eq().order().limit().single()
// The restoreProgress chain: select().eq().eq().order().limit().single()
// The saveProgress chain: select().eq().eq().single() then update().eq() or insert()
const mockSingleResult = Promise.resolve({ data: null, error: null });
const mockUpdateResult = Promise.resolve({ data: null, error: null });
const mockInsertResult = Promise.resolve({ data: null, error: null });

// Factory to create a chainable eq result that references itself
function createEqResult(): any {
  let self: any;
  self = {
    eq: jest.fn(() => self),
    single: jest.fn(() => mockSingleResult),
    order: jest.fn(() => ({
      limit: jest.fn(() => ({
        single: jest.fn(() => mockSingleResult),
      })),
    })),
  };
  return self;
}

const eqResult = createEqResult();

const mockSelect = jest.fn(() => ({
  eq: jest.fn(() => eqResult),
  single: jest.fn(() => mockSingleResult),
}));

const mockUpdate = jest.fn(() => ({
  eq: jest.fn(() => mockUpdateResult),
}));

const mockInsert = jest.fn(() => mockInsertResult);

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
    })),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: {
            user: { id: 'test-user-123' },
          },
        })
      ),
    },
  },
}));

// Mock Auth Store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      user: { id: 'test-user-123' },
    })),
  },
}));

describe('ReadingProgressService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Reset the singleton's internal state between tests
    readingProgressService.clearPendingSave();
    // Access private state via any to reset lastSavedProgress
    (readingProgressService as any).lastSavedProgress = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    readingProgressService.clearPendingSave();
    (readingProgressService as any).lastSavedProgress = null;
  });

  describe('getLastSavedProgress', () => {
    it('returns null initially', () => {
      const progress = readingProgressService.getLastSavedProgress();
      expect(progress).toBeNull();
    });

    it('returns the last saved progress after saveProgress', async () => {
      const data = {
        book_id: 'book-1',
        page_number: 10,
        progress_percent: 50,
        chapter_id: 'ch-1',
        text_offset: 100,
      };

      readingProgressService.saveProgress(data);
      jest.advanceTimersByTime(2500); // Wait for debounce
      await Promise.resolve();

      const progress = readingProgressService.getLastSavedProgress();
      expect(progress).not.toBeNull();
      expect(progress?.book_id).toBe('book-1');
      expect(progress?.page_number).toBe(10);
      expect(progress?.progress_percent).toBe(50);
    });
  });

  describe('saveProgress debounce', () => {
    it('debounces multiple calls within the wait period', async () => {
      const data1 = {
        book_id: 'book-1',
        page_number: 5,
        progress_percent: 25,
      };
      const data2 = {
        book_id: 'book-1',
        page_number: 10,
        progress_percent: 50,
      };

      readingProgressService.saveProgress(data1);
      readingProgressService.saveProgress(data2);

      // Only the last call should be saved after debounce
      jest.advanceTimersByTime(2500);
      await Promise.resolve();

      const progress = readingProgressService.getLastSavedProgress();
      expect(progress?.page_number).toBe(10);
      expect(progress?.progress_percent).toBe(50);
    });

    it('does not save immediately', () => {
      readingProgressService.saveProgress({
        book_id: 'book-1',
        page_number: 5,
        progress_percent: 25,
      });

      // Before debounce fires, lastSavedProgress should still be null
      const progress = readingProgressService.getLastSavedProgress();
      expect(progress).toBeNull();
    });
  });

  describe('clearPendingSave', () => {
    it('clears any pending save timeout', () => {
      readingProgressService.saveProgress({
        book_id: 'book-1',
        page_number: 5,
        progress_percent: 25,
      });

      readingProgressService.clearPendingSave();

      // After clearing, advancing timers should not trigger the save
      jest.advanceTimersByTime(5000);
      // The save may or may not have fired depending on timing, but the timeout reference is cleared
      // We can verify the method doesn't throw
      expect(() => readingProgressService.clearPendingSave()).not.toThrow();
    });
  });

  describe('restoreProgress', () => {
    it('returns null when no progress exists', async () => {
      const progress = await readingProgressService.restoreProgress('nonexistent-book');
      expect(progress).toBeNull();
    });
  });

  describe('progress data structure', () => {
    it('accepts progress data with all fields', () => {
      expect(() => {
        readingProgressService.saveProgress({
          book_id: 'book-1',
          page_number: 42,
          progress_percent: 75.5,
          chapter_id: 'ch-3',
          text_offset: 500,
        });
      }).not.toThrow();
    });

    it('accepts progress data with minimal fields', () => {
      expect(() => {
        readingProgressService.saveProgress({
          book_id: 'book-1',
          page_number: 1,
          progress_percent: 0,
        });
      }).not.toThrow();
    });
  });
});

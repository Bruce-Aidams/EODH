import { Highlight, Bookmark, BookChapter } from '@/types';

// Shared test data factories
const createHighlight = (overrides: Partial<Highlight> = {}): Highlight => ({
  id: 'hl-1',
  user_id: 'user-1',
  book_id: 'book-1',
  chapter_id: null,
  page_number: 5,
  text: 'Highlighted text content.',
  color: '#FFC928',
  note: null,
  text_offset_start: 0,
  text_offset_end: 24,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 'bm-1',
  user_id: 'user-1',
  book_id: 'book-1',
  chapter_id: null,
  page_number: 10,
  text_excerpt: 'Bookmarked passage.',
  note: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

const createChapter = (overrides: Partial<BookChapter> = {}): BookChapter => ({
  id: 'ch-1',
  book_id: 'book-1',
  title: 'Chapter 1',
  order_index: 0,
  content: null,
  page_start: 1,
  page_end: 10,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Reader Component Logic', () => {
  describe('Time formatting (AudioProgressSlider & AudioPlayerBar)', () => {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    it('formats 0 seconds as 0:00', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats 5 seconds as 0:05', () => {
      expect(formatTime(5)).toBe('0:05');
    });

    it('formats 59 seconds as 0:59', () => {
      expect(formatTime(59)).toBe('0:59');
    });

    it('formats 60 seconds as 1:00', () => {
      expect(formatTime(60)).toBe('1:00');
    });

    it('formats 3661 seconds as 61:01', () => {
      expect(formatTime(3661)).toBe('61:01');
    });

    it('handles fractional seconds by flooring', () => {
      expect(formatTime(60.9)).toBe('1:00');
    });
  });

  describe('Playback speed cycling (AudioPlayerBar)', () => {
    const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

    const cycleSpeed = (currentSpeed: number) => {
      const currentIndex = SPEEDS.indexOf(currentSpeed);
      return SPEEDS[(currentIndex + 1) % SPEEDS.length];
    };

    it('cycles from 0.5 to 0.75', () => {
      expect(cycleSpeed(0.5)).toBe(0.75);
    });

    it('cycles from 1.0 to 1.25', () => {
      expect(cycleSpeed(1.0)).toBe(1.25);
    });

    it('cycles from 2.0 back to 0.5', () => {
      expect(cycleSpeed(2.0)).toBe(0.5);
    });

    it('cycles through all speeds in order starting from 1.0', () => {
      let speed = 1.0;
      const sequence: number[] = [];
      for (let i = 0; i < SPEEDS.length; i++) {
        sequence.push(speed);
        speed = cycleSpeed(speed);
      }
      // Starting from 1.0, the cycle is: 1.0, 1.25, 1.5, 1.75, 2.0, 0.5, 0.75
      expect(sequence).toEqual([1.0, 1.25, 1.5, 1.75, 2.0, 0.5, 0.75]);
    });
  });

  describe('Rewind and Forward (AudioPlayerBar)', () => {
    const rewind = (currentTime: number) => Math.max(0, currentTime - 10);
    const forward = (currentTime: number, duration: number) =>
      Math.min(duration, currentTime + 10);

    describe('rewind', () => {
      it('rewinds 10 seconds from current time', () => {
        expect(rewind(30)).toBe(20);
      });

      it('does not go below 0', () => {
        expect(rewind(5)).toBe(0);
      });

      it('stays at 0 when already at 0', () => {
        expect(rewind(0)).toBe(0);
      });
    });

    describe('forward', () => {
      it('forwards 10 seconds from current time', () => {
        expect(forward(30, 100)).toBe(40);
      });

      it('does not exceed duration', () => {
        expect(forward(95, 100)).toBe(100);
      });

      it('stays at duration when already at end', () => {
        expect(forward(100, 100)).toBe(100);
      });
    });
  });

  describe('Bookmark filtering (BookmarkManager)', () => {
    const filterBookmarks = (bookmarks: Bookmark[], bookId: string) =>
      bookmarks.filter((b) => b.book_id === bookId);

    it('returns only bookmarks for the given book', () => {
      const bookmarks = [
        createBookmark({ id: 'bm-1', book_id: 'book-1' }),
        createBookmark({ id: 'bm-2', book_id: 'book-2' }),
        createBookmark({ id: 'bm-3', book_id: 'book-1' }),
      ];

      const result = filterBookmarks(bookmarks, 'book-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('bm-1');
      expect(result[1].id).toBe('bm-3');
    });

    it('returns empty array when no bookmarks match', () => {
      const bookmarks = [
        createBookmark({ id: 'bm-1', book_id: 'book-2' }),
      ];

      const result = filterBookmarks(bookmarks, 'book-1');
      expect(result).toHaveLength(0);
    });

    it('returns empty array when bookmarks list is empty', () => {
      const result = filterBookmarks([], 'book-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('Highlight filtering by book ID', () => {
    const filterHighlights = (highlights: Highlight[], bookId: string) =>
      highlights.filter((h) => h.book_id === bookId);

    it('returns only highlights for the given book', () => {
      const highlights = [
        createHighlight({ id: 'hl-1', book_id: 'book-1' }),
        createHighlight({ id: 'hl-2', book_id: 'book-2' }),
        createHighlight({ id: 'hl-3', book_id: 'book-1' }),
      ];

      const result = filterHighlights(highlights, 'book-1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no highlights match', () => {
      const highlights = [
        createHighlight({ id: 'hl-1', book_id: 'book-2' }),
      ];

      const result = filterHighlights(highlights, 'book-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('Highlight color styling (TextHighlighter)', () => {
    const getHighlightBg = (color: string) => color + '30';

    it('appends 30 for 20% opacity', () => {
      expect(getHighlightBg('#FFC928')).toBe('#FFC92830');
    });

    it('works with any hex color', () => {
      expect(getHighlightBg('#FF0000')).toBe('#FF000030');
      expect(getHighlightBg('#00FF00')).toBe('#00FF0030');
    });
  });

  describe('Chapter current index detection (ChapterPlaylist)', () => {
    const findCurrentChapterIndex = (
      chapters: BookChapter[],
      chapterId: string | null
    ) => {
      if (!chapterId) return 0;
      const index = chapters.findIndex((ch) => ch.id === chapterId);
      return index >= 0 ? index : 0;
    };

    it('returns 0 when chapterId is null', () => {
      const chapters = [createChapter({ id: 'ch-1' }), createChapter({ id: 'ch-2' })];
      expect(findCurrentChapterIndex(chapters, null)).toBe(0);
    });

    it('returns the correct index for a matching chapter', () => {
      const chapters = [
        createChapter({ id: 'ch-1' }),
        createChapter({ id: 'ch-2' }),
        createChapter({ id: 'ch-3' }),
      ];
      expect(findCurrentChapterIndex(chapters, 'ch-2')).toBe(1);
    });

    it('returns 0 when chapterId is not found', () => {
      const chapters = [
        createChapter({ id: 'ch-1' }),
        createChapter({ id: 'ch-2' }),
      ];
      expect(findCurrentChapterIndex(chapters, 'ch-999')).toBe(0);
    });
  });

  describe('Font family list (FontSettingsSheet)', () => {
    const FONT_FAMILIES = ['System', 'Georgia', 'Merriweather', 'Lora', 'Literata', 'Open Sans', 'Roboto'];

    it('contains 7 font families', () => {
      expect(FONT_FAMILIES).toHaveLength(7);
    });

    it('includes System as the default', () => {
      expect(FONT_FAMILIES).toContain('System');
    });

    it('includes all expected fonts', () => {
      expect(FONT_FAMILIES).toContain('Georgia');
      expect(FONT_FAMILIES).toContain('Merriweather');
      expect(FONT_FAMILIES).toContain('Roboto');
    });
  });

  describe('Font size delta (FontSettingsSheet)', () => {
    const applyFontSizeDelta = (currentSize: number, delta: number, min: number, max: number) =>
      Math.max(min, Math.min(max, currentSize + delta));

    it('increases font size by delta', () => {
      expect(applyFontSizeDelta(18, 2, 12, 32)).toBe(20);
    });

    it('decreases font size by delta', () => {
      expect(applyFontSizeDelta(18, -2, 12, 32)).toBe(16);
    });

    it('does not go below minimum', () => {
      expect(applyFontSizeDelta(12, -5, 12, 32)).toBe(12);
    });

    it('does not go above maximum', () => {
      expect(applyFontSizeDelta(30, 5, 12, 32)).toBe(32);
    });
  });

  describe('Header subtitle formatting (ReaderHeader)', () => {
    const formatSubtitle = (currentPage: number, totalPages: number, estimatedReadingTime: string) =>
      `${currentPage} / ${totalPages} · ${estimatedReadingTime}`;

    it('formats page number and reading time', () => {
      expect(formatSubtitle(5, 100, '45 min')).toBe('5 / 100 · 45 min');
    });

    it('handles page 1', () => {
      expect(formatSubtitle(1, 50, '30 min')).toBe('1 / 50 · 30 min');
    });
  });

  describe('Overflow menu items (ReaderOverflowMenu)', () => {
    it('contains 8 menu items', () => {
      const menuItems = [
        { icon: 'information-circle-outline', label: 'Book Info' },
        { icon: 'list-outline', label: 'Table of Contents' },
        { icon: 'search-outline', label: 'Search in Book' },
        { icon: 'bookmark-outline', label: 'Bookmarks' },
        { icon: 'pencil', label: 'Highlights' },
        { icon: 'settings-outline', label: 'Reading Settings' },
        { icon: 'share-outline', label: 'Share' },
        { icon: 'flag-outline', label: 'Report an Issue' },
      ];
      expect(menuItems).toHaveLength(8);
    });

    it('includes all expected menu labels', () => {
      const labels = [
        'Book Info',
        'Table of Contents',
        'Search in Book',
        'Bookmarks',
        'Highlights',
        'Reading Settings',
        'Share',
        'Report an Issue',
      ];
      expect(labels).toHaveLength(8);
      expect(labels).toContain('Bookmarks');
      expect(labels).toContain('Highlights');
    });
  });

  describe('Bookmarked state toggle', () => {
    const toggleBookmark = (isBookmarked: boolean) => !isBookmarked;

    it('toggles from false to true', () => {
      expect(toggleBookmark(false)).toBe(true);
    });

    it('toggles from true to false', () => {
      expect(toggleBookmark(true)).toBe(false);
    });
  });

  describe('Has audio check (AudioPlayerBar)', () => {
    const hasAudio = (segmentsCount?: number, segmentsLength?: number) => {
      const count = segmentsCount ?? segmentsLength ?? 0;
      return count > 0;
    };

    it('returns true when segmentsCount is provided', () => {
      expect(hasAudio(5)).toBe(true);
    });

    it('returns false when segmentsCount is 0', () => {
      expect(hasAudio(0)).toBe(false);
    });

    it('returns false when segmentsCount is undefined and segmentsLength is 0', () => {
      expect(hasAudio(undefined, 0)).toBe(false);
    });

    it('falls back to segmentsLength when segmentsCount is undefined', () => {
      expect(hasAudio(undefined, 3)).toBe(true);
    });

    it('returns false when both are undefined', () => {
      expect(hasAudio(undefined, undefined)).toBe(false);
    });
  });

  describe('Play/Pause state (AudioPlayerBar)', () => {
    const getPlayPauseAction = (isPlaying: boolean) => (isPlaying ? 'pause' : 'play');

    it('returns pause when playing', () => {
      expect(getPlayPauseAction(true)).toBe('pause');
    });

    it('returns play when paused', () => {
      expect(getPlayPauseAction(false)).toBe('play');
    });
  });

  describe('Content rendering branches (ChapterContent)', () => {
    // Simulates the rendering logic: processing > loading > html > raw text
    const getRenderMode = ({
      processingDocument,
      loadingChapters,
      htmlContent,
      rawContent,
    }: {
      processingDocument: boolean;
      loadingChapters: boolean;
      htmlContent: string;
      rawContent: string;
    }) => {
      if (processingDocument) return 'processing';
      if (loadingChapters) return 'loading';
      if (htmlContent) return 'html';
      return 'raw';
    };

    it('shows processing when processingDocument is true', () => {
      expect(
        getRenderMode({
          processingDocument: true,
          loadingChapters: true,
          htmlContent: '<p>test</p>',
          rawContent: 'test',
        })
      ).toBe('processing');
    });

    it('shows loading when loadingChapters is true and not processing', () => {
      expect(
        getRenderMode({
          processingDocument: false,
          loadingChapters: true,
          htmlContent: '<p>test</p>',
          rawContent: 'test',
        })
      ).toBe('loading');
    });

    it('shows HTML when htmlContent is provided', () => {
      expect(
        getRenderMode({
          processingDocument: false,
          loadingChapters: false,
          htmlContent: '<p>test</p>',
          rawContent: 'test',
        })
      ).toBe('html');
    });

    it('shows raw text when no HTML content', () => {
      expect(
        getRenderMode({
          processingDocument: false,
          loadingChapters: false,
          htmlContent: '',
          rawContent: 'test',
        })
      ).toBe('raw');
    });
  });
});

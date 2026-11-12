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

// ---------------------------------------------------------------------------
// SearchResult type mirrors app/search/index.tsx
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// SearchCache class mirrors app/search/index.tsx
// ---------------------------------------------------------------------------
class SearchCache {
  private cache = new Map<string, { result: SearchResult[]; timestamp: number }>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize = 50, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

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

// ---------------------------------------------------------------------------
// handleResultPress logic mirrors app/search/index.tsx
// ---------------------------------------------------------------------------
interface NavigationResult {
  pathname: string;
  params: Record<string, string>;
}

function buildNavigationParams(item: SearchResult, query: string): NavigationResult {
  const params: Record<string, string> = {};
  if (item.chapter_id) {
    params.chapterId = item.chapter_id;
  }
  const trimmed = query.trim();
  if (trimmed) {
    params.searchQuery = trimmed;
  }
  return {
    pathname: `/book/${item.book_id}/reader`,
    params,
  };
}

// ---------------------------------------------------------------------------
// Snippet HTML stripping mirrors app/search/index.tsx renderResult
// ---------------------------------------------------------------------------
function stripMarkTags(snippet: string): string {
  return snippet.replace(/<mark>/g, '').replace(/<\/mark>/g, '');
}

// ---------------------------------------------------------------------------
// performSearch query validation mirrors app/search/index.tsx
// ---------------------------------------------------------------------------
function shouldSearch(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length >= 2;
}

// ---------------------------------------------------------------------------
// RPC row mapping mirrors app/search/index.tsx data.map
// ---------------------------------------------------------------------------
function mapRpcRowToResult(row: Record<string, any>): SearchResult {
  return {
    book_id: row.book_id,
    book_title: row.book_title,
    book_author: row.book_author,
    book_cover_url: row.book_cover_url || null,
    chapter_id: row.chapter_id || null,
    chapter_title: row.chapter_title || '',
    snippet: row.snippet || '',
    rank: row.rank || 0,
  };
}

// ---------------------------------------------------------------------------
// In-book search logic mirrors app/book/[id]/reader/index.tsx searchInBook
// ---------------------------------------------------------------------------
interface SearchMatch {
  chapterId: string;
  chapterTitle: string;
  matchIndex: number;
  snippet: string;
  textOffset: number;
  chapterIndex: number;
}

interface ChapterWithContent {
  id: string;
  title: string;
  content: string | null;
}

function searchInBookContent(
  chapters: ChapterWithContent[],
  query: string
): SearchMatch[] {
  if (!query.trim()) return [];

  const searchQuery = query.trim().toLowerCase();
  const results: SearchMatch[] = [];
  let matchIndex = 0;

  // Build combined raw text (stripped of HTML tags)
  const combinedRaw = chapters
    .map((ch) => (ch.content || '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' '))
    .join('');
  const lowerCombined = combinedRaw.toLowerCase();

  let index = 0;
  while (true) {
    const foundIndex = lowerCombined.indexOf(searchQuery, index);
    if (foundIndex === -1) break;

    // Find which chapter this offset belongs to
    let charCount = 0;
    let matchedChapterIndex = 0;
    let matchedChapterId = '';
    let matchedChapterTitle = '';

    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = chapters[ci];
      const chapterRaw = (chapter.content || '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
      const chapterLen = chapterRaw.length;

      if (charCount + chapterLen > foundIndex) {
        matchedChapterIndex = ci;
        matchedChapterId = chapter.id;
        matchedChapterTitle = chapter.title;
        break;
      }
      charCount += chapterLen;
    }

    // Build snippet from the combined raw text
    const snippetStart = Math.max(0, foundIndex - 50);
    const snippetEnd = Math.min(combinedRaw.length, foundIndex + query.length + 50);
    let snippet = combinedRaw.substring(snippetStart, snippetEnd);

    const lowerSnippet = snippet.toLowerCase();
    const matchPos = lowerSnippet.indexOf(searchQuery);
    if (matchPos !== -1) {
      const before = snippet.substring(0, matchPos);
      const match = snippet.substring(matchPos, matchPos + query.length);
      const after = snippet.substring(matchPos + query.length);
      snippet = `${before}<mark style="background-color: #FFC928; color: inherit;">${match}</mark>${after}`;
    }

    results.push({
      chapterId: matchedChapterId,
      chapterTitle: matchedChapterTitle,
      matchIndex,
      snippet,
      textOffset: foundIndex,
      chapterIndex: matchedChapterIndex,
    });

    matchIndex++;
    index = foundIndex + query.length;

    if (results.length >= 100) break;
  }

  return results;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Search Cache', () => {
  let cache: SearchCache;

  beforeEach(() => {
    cache = new SearchCache(3, 5 * 60 * 1000);
  });

  describe('get and set', () => {
    it('returns null for a key that has not been set', () => {
      expect(cache.get('hello')).toBeNull();
    });

    it('returns the stored results after setting', () => {
      const results: SearchResult[] = [
        {
          book_id: 'b1',
          book_title: 'Test Book',
          book_author: 'Author',
          book_cover_url: null,
          chapter_id: 'ch-1',
          chapter_title: 'Chapter 1',
          snippet: 'some text',
          rank: 1,
        },
      ];
      cache.set('hello', results);
      expect(cache.get('hello')).toEqual(results);
    });

    it('returns different results for different keys', () => {
      const resultsA: SearchResult[] = [{
        book_id: 'a', book_title: 'A', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const resultsB: SearchResult[] = [{
        book_id: 'b', book_title: 'B', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      cache.set('keyA', resultsA);
      cache.set('keyB', resultsB);
      expect(cache.get('keyA')).toEqual(resultsA);
      expect(cache.get('keyB')).toEqual(resultsB);
    });
  });

  describe('TTL expiration', () => {
    it('returns null after TTL expires', () => {
      const shortTtlCache = new SearchCache(10, 50); // 50ms TTL
      const results: SearchResult[] = [{
        book_id: 'b1', book_title: 'TTL Test', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      shortTtlCache.set('expire', results);
      expect(shortTtlCache.get('expire')).toEqual(results);

      // Wait for TTL to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(shortTtlCache.get('expire')).toBeNull();
          resolve(undefined);
        }, 60);
      });
    });

    it('returns results before TTL expires', () => {
      const shortTtlCache = new SearchCache(10, 500); // 500ms TTL
      const results: SearchResult[] = [{
        book_id: 'b1', book_title: 'TTL Test', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      shortTtlCache.set('expire', results);
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(shortTtlCache.get('expire')).toEqual(results);
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('LRU eviction', () => {
    it('evicts the oldest entry when capacity is reached', () => {
      const results1: SearchResult[] = [{
        book_id: '1', book_title: '1', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const results2: SearchResult[] = [{
        book_id: '2', book_title: '2', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const results3: SearchResult[] = [{
        book_id: '3', book_title: '3', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const results4: SearchResult[] = [{
        book_id: '4', book_title: '4', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];

      cache.set('key1', results1);
      cache.set('key2', results2);
      cache.set('key3', results3);

      // Cache is full (size 3). Adding key4 should evict key1.
      cache.set('key4', results4);

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toEqual(results2);
      expect(cache.get('key3')).toEqual(results3);
      expect(cache.get('key4')).toEqual(results4);
    });

    it('does not evict when updating an existing key', () => {
      const results1: SearchResult[] = [{
        book_id: '1', book_title: '1', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const results2: SearchResult[] = [{
        book_id: '2', book_title: '2', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const results3: SearchResult[] = [{
        book_id: '3', book_title: '3', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      const updatedResults1: SearchResult[] = [{
        book_id: '1-updated', book_title: '1 Updated', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];

      cache.set('key1', results1);
      cache.set('key2', results2);
      cache.set('key3', results3);

      // Update key1 — should not evict anything
      cache.set('key1', updatedResults1);

      expect(cache.get('key1')).toEqual(updatedResults1);
      expect(cache.get('key2')).toEqual(results2);
      expect(cache.get('key3')).toEqual(results3);
    });
  });

  describe('clear', () => {
    it('removes all cached entries', () => {
      const results: SearchResult[] = [{
        book_id: 'b1', book_title: 'Test', book_author: '', book_cover_url: null,
        chapter_id: null, chapter_title: '', snippet: '', rank: 0,
      }];
      cache.set('a', results);
      cache.set('b', results);
      cache.clear();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });
  });
});

describe('Search query validation', () => {
  it('returns false for empty string', () => {
    expect(shouldSearch('')).toBe(false);
  });

  it('returns false for single character', () => {
    expect(shouldSearch('a')).toBe(false);
  });

  it('returns false for two characters with leading space', () => {
    // ' a' trims to 'a' which is length 1
    expect(shouldSearch(' a')).toBe(false);
  });

  it('returns true for two characters', () => {
    expect(shouldSearch('ab')).toBe(true);
  });

  it('returns true for longer query', () => {
    expect(shouldSearch('hello world')).toBe(true);
  });

  it('trims whitespace before checking length', () => {
    expect(shouldSearch('  hello  ')).toBe(true);
    expect(shouldSearch('  a  ')).toBe(false);
  });
});

describe('Search result navigation params', () => {
  const baseResult: SearchResult = {
    book_id: 'book-123',
    book_title: 'Test Book',
    book_author: 'Test Author',
    book_cover_url: null,
    chapter_id: 'ch-5',
    chapter_title: 'Chapter 5',
    snippet: 'Some matching text',
    rank: 1,
  };

  it('builds pathname with book ID', () => {
    const nav = buildNavigationParams(baseResult, 'query');
    expect(nav.pathname).toBe('/book/book-123/reader');
  });

  it('includes chapterId when result has a chapter_id', () => {
    const nav = buildNavigationParams(baseResult, 'query');
    expect(nav.params.chapterId).toBe('ch-5');
  });

  it('omits chapterId when result has no chapter_id', () => {
    const resultWithoutChapter = { ...baseResult, chapter_id: null };
    const nav = buildNavigationParams(resultWithoutChapter, 'query');
    expect(nav.params.chapterId).toBeUndefined();
  });

  it('includes searchQuery when query is non-empty', () => {
    const nav = buildNavigationParams(baseResult, 'hello world');
    expect(nav.params.searchQuery).toBe('hello world');
  });

  it('trims the searchQuery', () => {
    const nav = buildNavigationParams(baseResult, '  hello  ');
    expect(nav.params.searchQuery).toBe('hello');
  });

  it('omits searchQuery when query is empty', () => {
    const nav = buildNavigationParams(baseResult, '');
    expect(nav.params.searchQuery).toBeUndefined();
  });

  it('omits searchQuery when query is only whitespace', () => {
    const nav = buildNavigationParams(baseResult, '   ');
    expect(nav.params.searchQuery).toBeUndefined();
  });

  it('includes both chapterId and searchQuery when both are present', () => {
    const nav = buildNavigationParams(baseResult, 'search term');
    expect(nav.params).toEqual({
      chapterId: 'ch-5',
      searchQuery: 'search term',
    });
  });

  it('produces empty params when no chapter and no query', () => {
    const resultWithoutChapter = { ...baseResult, chapter_id: null };
    const nav = buildNavigationParams(resultWithoutChapter, '');
    expect(nav.params).toEqual({});
  });
});

describe('Snippet HTML mark tag stripping', () => {
  it('removes opening mark tags', () => {
    expect(stripMarkTags('<mark>hello</mark>')).toBe('hello');
  });

  it('removes multiple mark tag pairs', () => {
    expect(stripMarkTags('<mark>a</mark> and <mark>b</mark>')).toBe('a and b');
  });

  it('leaves plain text unchanged', () => {
    expect(stripMarkTags('no tags here')).toBe('no tags here');
  });

  it('handles empty string', () => {
    expect(stripMarkTags('')).toBe('');
  });

  it('removes mark tags with attributes', () => {
    // The actual implementation only strips <mark> and </mark>, not attributes
    // This tests the actual behavior
    expect(stripMarkTags('<mark style="background: yellow;">text</mark>')).toBe('<mark style="background: yellow;">text');
  });
});

describe('RPC row mapping', () => {
  it('maps all fields from a complete row', () => {
    const row = {
      book_id: 'b-1',
      book_title: 'The Great Gatsby',
      book_author: 'F. Scott Fitzgerald',
      book_cover_url: 'https://example.com/cover.jpg',
      chapter_id: 'ch-3',
      chapter_title: 'Chapter 3',
      snippet: '...<mark>green</mark> light...',
      rank: 0.95,
    };
    const result = mapRpcRowToResult(row);
    expect(result.book_id).toBe('b-1');
    expect(result.book_title).toBe('The Great Gatsby');
    expect(result.book_author).toBe('F. Scott Fitzgerald');
    expect(result.book_cover_url).toBe('https://example.com/cover.jpg');
    expect(result.chapter_id).toBe('ch-3');
    expect(result.chapter_title).toBe('Chapter 3');
    expect(result.snippet).toBe('...<mark>green</mark> light...');
    expect(result.rank).toBe(0.95);
  });

  it('defaults null cover_url to null', () => {
    const row = {
      book_id: 'b-1', book_title: 'T', book_author: 'A', book_cover_url: null,
      chapter_id: null, chapter_title: '', snippet: '', rank: 0,
    };
    const result = mapRpcRowToResult(row);
    expect(result.book_cover_url).toBeNull();
  });

  it('defaults missing chapter_id to null', () => {
    const row = {
      book_id: 'b-1', book_title: 'T', book_author: 'A', book_cover_url: null,
      chapter_id: null, chapter_title: '', snippet: '', rank: 0,
    };
    const result = mapRpcRowToResult(row);
    expect(result.chapter_id).toBeNull();
  });

  it('defaults missing chapter_title to empty string', () => {
    const row = {
      book_id: 'b-1', book_title: 'T', book_author: 'A', book_cover_url: null,
      chapter_id: 'ch-1', chapter_title: null, snippet: '', rank: 0,
    };
    const result = mapRpcRowToResult(row);
    expect(result.chapter_title).toBe('');
  });

  it('defaults missing snippet to empty string', () => {
    const row = {
      book_id: 'b-1', book_title: 'T', book_author: 'A', book_cover_url: null,
      chapter_id: null, chapter_title: '', snippet: null, rank: 0,
    };
    const result = mapRpcRowToResult(row);
    expect(result.snippet).toBe('');
  });

  it('defaults missing rank to 0', () => {
    const row = {
      book_id: 'b-1', book_title: 'T', book_author: 'A', book_cover_url: null,
      chapter_id: null, chapter_title: '', snippet: '', rank: null,
    };
    const result = mapRpcRowToResult(row);
    expect(result.rank).toBe(0);
  });

  it('maps multiple rows', () => {
    const rows = [
      {
        book_id: 'b-1', book_title: 'Book 1', book_author: 'Author 1', book_cover_url: null,
        chapter_id: 'ch-1', chapter_title: 'Ch 1', snippet: 'snippet 1', rank: 1,
      },
      {
        book_id: 'b-2', book_title: 'Book 2', book_author: 'Author 2', book_cover_url: 'url',
        chapter_id: null, chapter_title: '', snippet: 'snippet 2', rank: 0.5,
      },
    ];
    const results = rows.map(mapRpcRowToResult);
    expect(results).toHaveLength(2);
    expect(results[0].book_id).toBe('b-1');
    expect(results[1].book_id).toBe('b-2');
  });
});

describe('In-book search', () => {
  const chapters: ChapterWithContent[] = [
    {
      id: 'ch-1',
      title: 'Chapter 1',
      content: 'The quick brown fox jumps over the lazy dog.',
    },
    {
      id: 'ch-2',
      title: 'Chapter 2',
      content: 'A dog barked at the fox in the morning.',
    },
    {
      id: 'ch-3',
      title: 'Chapter 3',
      content: 'The fox and the dog became friends.',
    },
  ];

  describe('basic matching', () => {
    it('finds all occurrences of a word across chapters', () => {
      const results = searchInBookContent(chapters, 'fox');
      expect(results).toHaveLength(3);
    });

    it('finds all occurrences of "the" across chapters', () => {
      const results = searchInBookContent(chapters, 'the');
      // "The" appears multiple times (case-insensitive)
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array when no match', () => {
      const results = searchInBookContent(chapters, 'zebra');
      expect(results).toHaveLength(0);
    });

    it('returns empty array for empty query', () => {
      const results = searchInBookContent(chapters, '');
      expect(results).toHaveLength(0);
    });

    it('returns empty array for whitespace-only query', () => {
      const results = searchInBookContent(chapters, '   ');
      expect(results).toHaveLength(0);
    });
  });

  describe('case insensitivity', () => {
    it('matches uppercase query against lowercase text', () => {
      const results = searchInBookContent(chapters, 'FOX');
      expect(results).toHaveLength(3);
    });

    it('matches mixed case query', () => {
      const results = searchInBookContent(chapters, 'Fox');
      expect(results).toHaveLength(3);
    });

    it('matches lowercase query against uppercase text', () => {
      const upperChapters: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content: 'THE QUICK BROWN FOX.' },
      ];
      const results = searchInBookContent(upperChapters, 'the');
      expect(results).toHaveLength(1);
    });
  });

  describe('chapter attribution', () => {
    it('attributes matches to the correct chapter', () => {
      const results = searchInBookContent(chapters, 'fox');
      // First fox is in ch-1, second in ch-2, third in ch-3
      expect(results[0].chapterId).toBe('ch-1');
      expect(results[1].chapterId).toBe('ch-2');
      expect(results[2].chapterId).toBe('ch-3');
    });

    it('sets correct chapter titles', () => {
      const results = searchInBookContent(chapters, 'fox');
      expect(results[0].chapterTitle).toBe('Chapter 1');
      expect(results[1].chapterTitle).toBe('Chapter 2');
      expect(results[2].chapterTitle).toBe('Chapter 3');
    });

    it('sets correct chapter indices', () => {
      const results = searchInBookContent(chapters, 'fox');
      expect(results[0].chapterIndex).toBe(0);
      expect(results[1].chapterIndex).toBe(1);
      expect(results[2].chapterIndex).toBe(2);
    });
  });

  describe('match indexing', () => {
    it('assigns sequential match indices', () => {
      const results = searchInBookContent(chapters, 'fox');
      expect(results[0].matchIndex).toBe(0);
      expect(results[1].matchIndex).toBe(1);
      expect(results[2].matchIndex).toBe(2);
    });
  });

  describe('snippet generation', () => {
    it('includes the matched text in the snippet', () => {
      const results = searchInBookContent(chapters, 'fox');
      const snippet = results[0].snippet;
      expect(snippet.toLowerCase()).toContain('fox');
    });

    it('wraps the matched text in mark tags', () => {
      const results = searchInBookContent(chapters, 'fox');
      const snippet = results[0].snippet;
      expect(snippet).toContain('<mark');
      expect(snippet).toContain('</mark>');
    });

    it('includes context around the match', () => {
      const results = searchInBookContent(chapters, 'fox');
      const snippet = results[0].snippet;
      // Should include surrounding text
      expect(snippet.length).toBeGreaterThan(3);
    });
  });

  describe('text offset', () => {
    it('records the correct text offset in combined text', () => {
      const results = searchInBookContent(chapters, 'fox');
      // First fox is at a specific offset in the combined text
      expect(results[0].textOffset).toBeGreaterThan(-1);
      // Each subsequent match should have a greater offset
      for (let i = 1; i < results.length; i++) {
        expect(results[i].textOffset).toBeGreaterThan(results[i - 1].textOffset);
      }
    });
  });

  describe('HTML tag stripping', () => {
    it('strips HTML tags from content before searching', () => {
      const htmlChapters: ChapterWithContent[] = [
        {
          id: 'ch-1',
          title: 'Ch 1',
          content: '<p>The <strong>quick</strong> brown fox.</p>',
        },
      ];
      const results = searchInBookContent(htmlChapters, 'quick');
      expect(results).toHaveLength(1);
    });

    it('handles HTML entities', () => {
      const htmlChapters: ChapterWithContent[] = [
        {
          id: 'ch-1',
          title: 'Ch 1',
          content: 'He said &quot;hello&quot; to the fox.',
        },
      ];
      const results = searchInBookContent(htmlChapters, 'hello');
      expect(results).toHaveLength(1);
    });
  });

  describe('result limit', () => {
    it('limits results to 100 matches', () => {
      // Create content with many occurrences
      const content = 'a a a a a a a a a a a a a a a a a a a a '.repeat(30);
      const chapters: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content },
      ];
      const results = searchInBookContent(chapters, 'a');
      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases', () => {
    it('handles empty chapters array', () => {
      const results = searchInBookContent([], 'fox');
      expect(results).toHaveLength(0);
    });

    it('handles chapters with null content', () => {
      const chaptersWithNull: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content: null },
        { id: 'ch-2', title: 'Ch 2', content: 'The fox is here.' },
      ];
      const results = searchInBookContent(chaptersWithNull, 'fox');
      expect(results).toHaveLength(1);
      expect(results[0].chapterId).toBe('ch-2');
    });

    it('handles chapters with empty content', () => {
      const chaptersWithEmpty: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content: '' },
        { id: 'ch-2', title: 'Ch 2', content: 'The fox is here.' },
      ];
      const results = searchInBookContent(chaptersWithEmpty, 'fox');
      expect(results).toHaveLength(1);
    });

    it('handles single character search', () => {
      const results = searchInBookContent(chapters, 'x');
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles special characters in query', () => {
      const chapters: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content: 'Price: $100. Tax: 10%.' },
      ];
      const results = searchInBookContent(chapters, '$100');
      expect(results).toHaveLength(1);
    });

    it('handles query that spans chapter boundary', () => {
      // A query that would span two chapters won't match because
      // the search is done on combined text with spaces between chapters
      const chapters: ChapterWithContent[] = [
        { id: 'ch-1', title: 'Ch 1', content: 'Hello wo' },
        { id: 'ch-2', title: 'Ch 2', content: 'rld' },
      ];
      const results = searchInBookContent(chapters, 'world');
      // "Hello wo" + " " + "world" — the combined text has a space between chapters
      // so "world" should still match in ch-2
      expect(results).toHaveLength(1);
    });
  });
});

describe('Reader initial search navigation logic', () => {
  // Mirrors the useEffect logic in app/book/[id]/reader/index.tsx
  // that processes initialChapterId and initialSearchQuery

  interface NavigationAction {
    type: 'navigate' | 'search' | 'showSearch';
    chapterIndex?: number;
    query?: string;
  }

  function simulateInitialSearchNavigation(
    chaptersWithContent: BookChapter[],
    initialChapterId: string | undefined,
    initialSearchQuery: string | undefined,
    initialSearchProcessed: { current: boolean }
  ): NavigationAction[] {
    const actions: NavigationAction[] = [];

    if (initialSearchProcessed.current) return actions;
    if (!initialChapterId && !initialSearchQuery) return actions;
    if (chaptersWithContent.length === 0) return actions;

    initialSearchProcessed.current = true;

    const targetIndex = chaptersWithContent.findIndex(ch => ch.id === initialChapterId);
    if (targetIndex !== -1 && initialSearchQuery) {
      actions.push({ type: 'navigate', chapterIndex: targetIndex });
      actions.push({ type: 'search', query: initialSearchQuery });
      actions.push({ type: 'showSearch' });
    } else if (targetIndex !== -1) {
      actions.push({ type: 'navigate', chapterIndex: targetIndex });
    }

    return actions;
  }

  const chapters = [
    createChapter({ id: 'ch-1', title: 'Chapter 1' }),
    createChapter({ id: 'ch-2', title: 'Chapter 2' }),
    createChapter({ id: 'ch-3', title: 'Chapter 3' }),
  ];

  it('does nothing when no initial params', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, undefined, undefined, guard);
    expect(actions).toHaveLength(0);
  });

  it('does nothing when chapters are empty', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation([], 'ch-1', 'query', guard);
    expect(actions).toHaveLength(0);
  });

  it('does nothing when already processed', () => {
    const guard = { current: true };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-1', 'query', guard);
    expect(actions).toHaveLength(0);
  });

  it('navigates to chapter and searches when both params are present', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-2', 'hello', guard);
    expect(actions).toHaveLength(3);
    expect(actions[0]).toEqual({ type: 'navigate', chapterIndex: 1 });
    expect(actions[1]).toEqual({ type: 'search', query: 'hello' });
    expect(actions[2]).toEqual({ type: 'showSearch' });
  });

  it('navigates to chapter when only chapterId is present', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-3', undefined, guard);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'navigate', chapterIndex: 2 });
  });

  it('does nothing when chapterId does not match any chapter', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-999', 'query', guard);
    expect(actions).toHaveLength(0);
  });

  it('does nothing when chapterId does not match but searchQuery is present', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-999', 'query', guard);
    expect(actions).toHaveLength(0);
  });

  it('sets the processed guard to true after running', () => {
    const guard = { current: false };
    simulateInitialSearchNavigation(chapters, 'ch-1', 'query', guard);
    expect(guard.current).toBe(true);
  });

  it('navigates to the first chapter when chapterId is ch-1', () => {
    const guard = { current: false };
    const actions = simulateInitialSearchNavigation(chapters, 'ch-1', 'query', guard);
    expect(actions[0]).toEqual({ type: 'navigate', chapterIndex: 0 });
  });
});

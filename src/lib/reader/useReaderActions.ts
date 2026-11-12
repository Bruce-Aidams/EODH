import { useState, useCallback, useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/lib/notifications/toast';
import { useHaptics } from '@/lib/haptics';
import { BookChapter, Highlight } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Search result type for in-book search.
 */
export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  matchIndex: number;
  snippet: string;
  textOffset: number;
  chapterIndex: number;
}

/**
 * Custom hook that handles all reader actions:
 * - Bookmark toggle (add/remove)
 * - Highlight creation
 * - Note creation and saving to highlights
 * - In-book search with result navigation
 * - Chapter navigation with scroll positioning
 *
 * This extracts ~250 lines of action logic from the main reader component.
 */
export function useReaderActions(options: {
  bookId: string;
  bookTitle?: string;
  htmlContent: string;
  rawContent: string;
  setHtmlContent: (content: string) => void;
  setRawContent: (content: string) => void;
  currentPage: number;
  totalPages: number;
  chaptersWithContent: BookChapter[];
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;
  setLoadingChapters: (loading: boolean) => void;
  fetchChapterContent: (chapterId: string) => Promise<void>;
  bookSegments: any[];
  setCurrentSegmentIndex: (index: number) => void;
  readingSettings: { fontSize: number; lineSpacing: number; margins: number };
  scrollViewRef: any;
  onShowSuccess: (msg: string) => void;
  onShowError: (msg: string) => void;
  onShowWarning: (msg: string) => void;
  onShowInfo: (msg: string) => void;
}) {
  const {
    bookId,
    bookTitle,
    htmlContent,
    rawContent,
    setHtmlContent,
    setRawContent,
    currentPage,
    totalPages,
    chaptersWithContent,
    currentChapterIndex,
    setCurrentChapterIndex,
    setLoadingChapters,
    fetchChapterContent,
    bookSegments,
    setCurrentSegmentIndex,
    readingSettings,
    scrollViewRef,
    onShowSuccess,
    onShowError,
    onShowWarning,
    onShowInfo,
  } = options;

  const user = useAuthStore((s) => s.user);
  const addBookmark = useLibraryStore((s) => s.addBookmark);
  const removeBookmark = useLibraryStore((s) => s.removeBookmark);
  const bookmarks = useLibraryStore((s) => s.bookmarks);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const addNote = useLibraryStore((s) => s.addNote);
  const removeHighlight = useLibraryStore((s) => s.removeHighlight);
  const highlights = useLibraryStore((s) => s.highlights);
  const { haptic } = useHaptics();

  // Note/Highlight modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFC928');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Filter highlights for the current book
  const bookHighlights = useMemo(() => {
    return highlights.filter(h => h.book_id === bookId);
  }, [highlights, bookId]);

  // Check if current page is bookmarked
  const isPageBookmarked = useMemo(() => {
    if (!user) return false;
    return bookmarks.some(b => b.book_id === bookId && b.page_number === currentPage);
  }, [bookmarks, bookId, currentPage, user]);

  // Find the bookmark for the current page
  const currentBookmark = useMemo(() => {
    if (!user) return null;
    return bookmarks.find(b => b.book_id === bookId && b.page_number === currentPage) || null;
  }, [bookmarks, bookId, currentPage, user]);

  // Bookmark toggle handler
  const handleBookmark = async () => {
    if (!user) {
      onShowWarning('Please sign in to bookmark pages.');
      return;
    }
    if (isPageBookmarked && currentBookmark) {
      try {
        await removeBookmark(currentBookmark.id);
        await haptic('light');
        onShowSuccess('Bookmark removed.');
      } catch {
        onShowError('Failed to remove bookmark.');
      }
    } else {
      try {
        await addBookmark({
          book_id: bookId,
          page_number: currentPage,
          text_excerpt: rawContent.substring(0, 200),
          note: null,
          user_id: user.id,
          chapter_id: null,
        } as any);
        await haptic('success');
        onShowSuccess('Page bookmarked.');
      } catch {
        onShowError('Failed to bookmark page.');
      }
    }
  };

  // Remove bookmark
  const handleRemoveBookmark = async (bookmarkId: string) => {
    try {
      await removeBookmark(bookmarkId);
      onShowSuccess('Bookmark removed.');
    } catch {
      onShowError('Failed to remove bookmark.');
    }
  };

  // Highlight handler
  const handleHighlight = async () => {
    if (!user) {
      onShowWarning('Please sign in to highlight text.');
      return;
    }
    await haptic('light');
    const excerpt = rawContent.substring(0, 300);
    handleSaveHighlight(excerpt);
  };

  const handleSaveHighlight = async (text: string) => {
    if (!user) return;
    try {
      await addHighlight({
        book_id: bookId,
        page_number: currentPage,
        text: text.substring(0, 500),
        color: highlightColor,
        note: null,
        user_id: user.id,
        chapter_id: null,
        text_offset_start: null,
        text_offset_end: null,
      } as any);
      setShowNoteModal(false);
      setNoteText('');
      await haptic('success');
      onShowSuccess('Text highlighted.');
    } catch {
      onShowError('Failed to save highlight.');
    }
  };

  // Note handler
  const handleSaveNote = async () => {
    if (!user) {
      onShowWarning('Please sign in to add notes.');
      return;
    }
    if (!noteText.trim()) {
      onShowWarning('Please enter some text for your note.');
      return;
    }
    try {
      await addNote({
        book_id: bookId,
        page_number: currentPage,
        content: noteText.trim(),
        user_id: user.id,
        chapter_id: null,
      } as any);
      setShowNoteModal(false);
      setNoteText('');
      onShowSuccess('Note saved.');
    } catch {
      onShowError('Failed to save note.');
    }
  };

  const openNoteModal = () => {
    setNoteText('');
    setShowNoteModal(true);
  };

  // Remove highlight handler
  const handleRemoveHighlight = async (highlightId: string) => {
    try {
      await removeHighlight(highlightId);
      onShowSuccess('Highlight removed.');
    } catch {
      onShowError('Failed to remove highlight.');
    }
  };

  // Note for highlight state
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [highlightNoteText, setHighlightNoteText] = useState('');

  const handleAddNoteToHighlight = (highlight: Highlight) => {
    setSelectedHighlight(highlight);
    setHighlightNoteText(highlight.note || '');
    setShowNoteModal(true);
  };

  const handleSaveHighlightNote = async () => {
    if (!selectedHighlight || !highlightNoteText.trim()) {
      onShowWarning('Please enter some text for your note.');
      return;
    }
    try {
      await supabase
        .from('highlights')
        .update({ note: highlightNoteText.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedHighlight.id)
        .select()
        .single();

      const updatedHighlight = { ...selectedHighlight, note: highlightNoteText.trim(), updated_at: new Date().toISOString() };
      useLibraryStore.setState(state => ({
        highlights: state.highlights.map(h => h.id === selectedHighlight.id ? updatedHighlight : h),
      }));

      setShowNoteModal(false);
      setHighlightNoteText('');
      setSelectedHighlight(null);
      onShowSuccess('Note saved to highlight.');
    } catch {
      onShowError('Failed to save note.');
    }
  };

  // In-book search
  const searchInBook = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const searchQuery = query.trim().toLowerCase();
      const results: SearchResult[] = [];
      let matchIndex = 0;

      const combinedRaw = htmlContent.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
      const lowerCombined = combinedRaw.toLowerCase();

      let index = 0;
      while (true) {
        const foundIndex = lowerCombined.indexOf(searchQuery, index);
        if (foundIndex === -1) break;

        let charCount = 0;
        let matchedChapterIndex = 0;
        let matchedChapterId = '';
        let matchedChapterTitle = '';

        for (let ci = 0; ci < chaptersWithContent.length; ci++) {
          const chapter = chaptersWithContent[ci];
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

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIndex(0);
      }
    } catch (err) {
      console.error('Search error:', err);
      onShowError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      searchInBook(searchQuery);
    }
  };

  const navigateToSearchResult = async (index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    setCurrentSearchIndex(index);
    const result = searchResults[index];
    setShowSearch(false);

    const targetChapterIndex = result.chapterIndex;
    const combinedHtml = htmlContent;
    const sectionId = `chapter-${targetChapterIndex}`;
    const isCombined = combinedHtml.includes(`id="${sectionId}"`);

    if (isCombined) {
      const combinedRaw = combinedHtml.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
      const lowerCombined = combinedRaw.toLowerCase();
      const matchedTextLower = searchQuery.trim().toLowerCase();
      const offset = result.textOffset;

      const markTag = '<mark id="search-match" style="background-color: #FFC928; color: inherit;">';
      const searchText = combinedHtml.substring(offset, offset + matchedTextLower.length);
      const searchTextLower = searchText.toLowerCase();

      if (searchTextLower === matchedTextLower) {
        const before = combinedHtml.substring(0, offset);
        const match = combinedHtml.substring(offset, offset + matchedTextLower.length);
        const after = combinedHtml.substring(offset + matchedTextLower.length);
        const highlightedContent = `${before}${markTag}${match}</mark>${after}`;
        setHtmlContent(highlightedContent);
        setRawContent(highlightedContent.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' '));
      }

      onShowInfo(`Match ${index + 1} of ${searchResults.length}: ${result.chapterTitle}`);

      setTimeout(() => {
        if (scrollViewRef.current) {
          const avgCharsPerLine = Math.max(40, Math.floor((SCREEN_WIDTH - readingSettings.margins * 2) / (readingSettings.fontSize * 0.5)));
          const textBefore = combinedRaw.substring(0, offset);
          const textLines = Math.floor(textBefore.length / avgCharsPerLine);
          const lineHeight = readingSettings.fontSize * readingSettings.lineSpacing;
          const estimatedY = Math.max(0, textLines * lineHeight - 100);
          (scrollViewRef.current as any).scrollTo({ y: estimatedY, animated: true });
        }
      }, 300);
    } else {
      const chapter = chaptersWithContent[targetChapterIndex];
      if (!chapter || !chapter.content) {
        onShowWarning('Chapter content not available.');
        return;
      }

      if (targetChapterIndex !== currentChapterIndex) {
        setCurrentChapterIndex(targetChapterIndex);
        setLoadingChapters(true);
        if (scrollViewRef.current) {
          (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
        }
        await fetchChapterContent(result.chapterId);
        setLoadingChapters(false);
        if (bookSegments[targetChapterIndex] !== undefined) {
          setCurrentSegmentIndex(targetChapterIndex);
        }
      }

      const content = chapter.content;
      const lowerContent = content.toLowerCase();
      const matchedTextLower = searchQuery.trim().toLowerCase();
      const markTag = '<mark id="search-match" style="background-color: #FFC928; color: inherit;">';

      const firstMatchIndex = lowerContent.indexOf(matchedTextLower);
      if (firstMatchIndex !== -1) {
        const before = content.substring(0, firstMatchIndex);
        const match = content.substring(firstMatchIndex, firstMatchIndex + matchedTextLower.length);
        const after = content.substring(firstMatchIndex + matchedTextLower.length);
        const highlightedContent = `${before}${markTag}${match}</mark>${after}`;
        setHtmlContent(highlightedContent);
        setRawContent(highlightedContent.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' '));
      }

      onShowInfo(`Match ${index + 1} of ${searchResults.length}: ${result.chapterTitle}`);

      setTimeout(() => {
        if (scrollViewRef.current) {
          const avgCharsPerLine = Math.max(40, Math.floor((SCREEN_WIDTH - readingSettings.margins * 2) / (readingSettings.fontSize * 0.5)));
          const textBefore = content.substring(0, firstMatchIndex >= 0 ? firstMatchIndex : 0);
          const textLines = Math.floor(textBefore.replace(/<[^>]+>/g, '').length / avgCharsPerLine);
          const lineHeight = readingSettings.fontSize * readingSettings.lineSpacing;
          const estimatedY = Math.max(0, textLines * lineHeight - 100);
          (scrollViewRef.current as any).scrollTo({ y: estimatedY, animated: true });
        }
      }, 300);
    }
  };

  // Navigate to a specific chapter
  const navigateToChapterIndex = async (index: number) => {
    if (chaptersWithContent[index]) {
      await haptic('medium');
      setCurrentChapterIndex(index);

      const combinedHtml = htmlContent;
      const sectionId = `chapter-${index}`;
      if (combinedHtml.includes(`id="${sectionId}"`)) {
        const sectionIndex = combinedHtml.indexOf(`id="${sectionId}"`);
        if (sectionIndex >= 0) {
          const textBefore = combinedHtml.substring(0, sectionIndex);
          const avgCharsPerLine = Math.max(40, Math.floor((SCREEN_WIDTH - readingSettings.margins * 2) / (readingSettings.fontSize * 0.5)));
          const textLines = Math.floor(textBefore.replace(/<[^>]+>/g, '').length / avgCharsPerLine);
          const lineHeight = readingSettings.fontSize * readingSettings.lineSpacing;
          const estimatedY = Math.max(0, textLines * lineHeight - 50);

          if (scrollViewRef.current) {
            (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
            setTimeout(() => {
              if (scrollViewRef.current) {
                (scrollViewRef.current as any).scrollTo({ y: estimatedY, animated: true });
              }
            }, 100);
          }
        }
      } else {
        setLoadingChapters(true);
        if (scrollViewRef.current) {
          (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
        }
        await fetchChapterContent(chaptersWithContent[index].id);
        setLoadingChapters(false);
      }

      if (bookSegments[index] !== undefined) {
        setCurrentSegmentIndex(index);
      }
    }
  };

  return {
    // Bookmark state and actions
    isPageBookmarked,
    currentBookmark,
    handleBookmark,
    handleRemoveBookmark,
    bookmarks,

    // Highlight state and actions
    bookHighlights,
    highlights,
    handleHighlight,
    handleSaveHighlight,
    handleRemoveHighlight,
    highlightColor,
    setHighlightColor,

    // Note state and actions
    showNoteModal,
    setShowNoteModal,
    noteText,
    setNoteText,
    handleSaveNote,
    openNoteModal,

    // Note for highlight
    selectedHighlight,
    setSelectedHighlight,
    highlightNoteText,
    setHighlightNoteText,
    handleAddNoteToHighlight,
    handleSaveHighlightNote,

    // Search state and actions
    showSearch,
    setShowSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    currentSearchIndex,
    setCurrentSearchIndex,
    isSearching,
    searchInBook,
    handleSearch,
    navigateToSearchResult,

    // Chapter navigation
    navigateToChapterIndex,
  };
}

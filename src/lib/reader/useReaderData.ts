import { useEffect, useRef, useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Book, BookChapter, AudioSegment } from '@/types';
import { markdownToHtml, extractChapters } from '@/lib/markdown/renderer';
import { readingProgressService } from '@/lib/reader/ReadingProgressService';
import { useAudioStore } from '@/stores/audioStore';
import { getAudioSegmentUri } from '@/lib/offline/fileManager';
import { processDocument } from '@/lib/admin/textProcessing';

/**
 * Custom hook that handles all data fetching for the reader screen.
 * - Fetches book data from Supabase
 * - Checks for locally downloaded documents
 * - Restores reading progress
 * - Fetches and processes chapters
 * - Fetches audio segments
 *
 * This extracts ~300 lines of data-fetching logic from the main reader component.
 */
export function useReaderData(bookIdParam: string, initialChapterId?: string, initialSearchQuery?: string) {
  const bookId = Array.isArray(bookIdParam) ? bookIdParam[0] : bookIdParam;
  const bookIdRef = useRef<string>('');
  const chapterContentCache = useRef<Map<string, string>>(new Map());

  const updateReadingProgress = useLibraryStore((s) => s.updateReadingProgress);
  const getBookmarks = useLibraryStore((s) => s.getBookmarks);
  const getHighlights = useLibraryStore((s) => s.getHighlights);
  const setSegments = useAudioStore((s) => s.setSegments);
  const setAlignments = useAudioStore((s) => s.setAlignments);

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [localDocumentUri, setLocalDocumentUri] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'reflow' | 'original'>('reflow');
  const [chaptersWithContent, setChaptersWithContent] = useState<BookChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [processingDocument, setProcessingDocument] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [chapters, setChapters] = useState<{ id: string; title: string; level: number }[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  // Audio segments
  const [bookSegments, setBookSegments] = useState<AudioSegment[]>([]);
  const [resolvedAudioUris, setResolvedAudioUris] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  // Check for locally downloaded document
  const checkLocalDocument = async (bid: string): Promise<string | null> => {
    const docUri = `${FileSystem.documentDirectory}eodh/books/${bid}/document`;
    const info = await FileSystem.getInfoAsync(docUri);
    return info.exists ? docUri : null;
  };

  // Create a fallback chapter if processing fails
  const createFallbackChapter = async (book: Book) => {
    try {
      if (book.document_url) {
        const { data, error } = await supabase
          .from('book_chapters')
          .insert({
            book_id: book.id,
            title: book.title || 'Document',
            order_index: 0,
            content: `<p><em>Document loaded. Use "Original PDF" mode to view the full document, or contact the admin to process this document for reflow reading.</em></p>`,
          })
          .select();

        if (!error && data && data.length > 0) {
          setChaptersWithContent(data);
          setChapters(data.map((ch) => ({ id: ch.id, title: ch.title, level: 1 })));
          loadChapterContent(data[0]);
          setViewMode('original');
        }
      }
    } catch (err) {
      console.error('Fallback chapter creation failed:', err);
    }
  };

  // Auto-process document if no chapters exist
  const autoProcessDocument = async (book: Book, onShowSuccess: (msg: string) => void, onShowInfo: (msg: string) => void, onShowWarning: (msg: string) => void) => {
    setProcessingDocument(true);
    setProcessingMessage('Extracting text and creating chapters...');

    try {
      const result = await processDocument(book, (progress) => {
        setProcessingMessage(progress.message);
      });

      if (result.success) {
        onShowSuccess(`Document processed! ${result.chaptersCreated} chapters created.`);
        const bid = bookIdRef.current;
        if (bid) {
          await fetchChapters(bid);
          setViewMode('reflow');
        }
      } else {
        console.warn('Document processing failed, creating fallback:', result.error);
        await createFallbackChapter(book);
      }
    } catch (err: any) {
      console.error('Auto-process error:', err);
      await createFallbackChapter(book);
    } finally {
      setProcessingDocument(false);
      setProcessingMessage('');
    }
  };

  // Load a specific chapter's content
  const loadChapterContent = (chapter: BookChapter) => {
    if (chapter.content) {
      setHtmlContent(chapter.content);
      const rawText = chapter.content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
      setRawContent(rawText);
    } else {
      setHtmlContent('<p>No content available for this chapter.</p>');
      setRawContent('');
    }
    const lines = (chapter.content || '').split('\n').length;
    setTotalPages(Math.max(1, Math.ceil(lines / 40)));
  };

  // Load all chapters content for continuous scrolling
  const loadAllChaptersContent = async (chapters: BookChapter[]) => {
    setLoadingChapters(true);
    try {
      let combinedHtml = '';
      let combinedRaw = '';
      let totalLines = 0;

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        let content = chapter.content || '';

        if (!content || content.trim() === '') {
          const cached = chapterContentCache.current.get(chapter.id);
          if (cached) {
            content = cached;
          } else {
            const { data } = await supabase
              .from('book_chapters')
              .select('content')
              .eq('id', chapter.id)
              .single();
            if (data?.content) {
              content = data.content;
              chapterContentCache.current.set(chapter.id, content);
            }
          }
        }

        if (content) {
          combinedHtml += `<section id="chapter-${i}">${content}</section>`;
          const rawText = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
          combinedRaw += rawText + '\n\n';
          totalLines += content.split('\n').length;
        }
      }

      setHtmlContent(combinedHtml);
      setRawContent(combinedRaw);
      setTotalPages(Math.max(1, Math.ceil(totalLines / 40)));
    } catch (err) {
      console.error('Failed to load chapters content:', err);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Fetch chapter list
  const fetchChapterList = async (bid: string): Promise<BookChapter[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('book_chapters')
        .select('id, book_id, title, content, order_index, page_start, page_end, created_at')
        .eq('book_id', bid)
        .order('order_index', { ascending: true });

      if (!fetchError && data) {
        setChaptersWithContent(data);
        setChapters(data.map((ch) => ({ id: ch.id, title: ch.title, level: 1 })));
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    }
    return [];
  };

  // Fetch chapter content by ID
  const fetchChapterContent = async (chapterId: string) => {
    const cached = chapterContentCache.current.get(chapterId);
    if (cached) {
      const chapter = chaptersWithContent.find(ch => ch.id === chapterId);
      if (chapter) {
        loadChapterContent(chapter);
        return;
      }
    }

    try {
      const { data } = await supabase
        .from('book_chapters')
        .select('content')
        .eq('id', chapterId)
        .single();

      if (data?.content) {
        chapterContentCache.current.set(chapterId, data.content);
        const chapter = { ...chaptersWithContent.find(ch => ch.id === chapterId)!, content: data.content };
        loadChapterContent(chapter);
      }
    } catch (err) {
      console.error('Failed to fetch chapter content:', err);
    }
  };

  // Fetch processed chapters
  const fetchChapters = async (bid: string): Promise<BookChapter[]> => {
    setLoadingChapters(true);
    try {
      const data = await fetchChapterList(bid);
      if (data.length > 0) {
        await loadAllChaptersContent(data);
      }
      return data;
    } finally {
      setLoadingChapters(false);
    }
  };

  // Fetch audio segments for the book
  const fetchAudioSegments = async (bid: string) => {
    try {
      const { data: segData, error: segError } = await supabase
        .from('audio_segments')
        .select('*')
        .eq('book_id', bid)
        .order('order_index', { ascending: true });

      if (segError) {
        console.error('Failed to fetch audio segments:', segError);
        return;
      }

      if (segData && segData.length > 0) {
        setBookSegments(segData);
        setSegments(segData);

        // Resolve audio URIs — check for locally downloaded files first
        const uris: string[] = [];
        for (let i = 0; i < segData.length; i++) {
          const segment = segData[i];
          const localUri = await getAudioSegmentUri(bid, i + 1, segment.audio_url);
          uris.push(localUri || segment.audio_url || '');
        }
        setResolvedAudioUris(uris);

        // Restore listening progress if available
        const { currentTime: storeTime } = useAudioStore.getState();
        if (storeTime > 0) {
          for (let i = segData.length - 1; i >= 0; i--) {
            if (storeTime >= segData[i].start_time) {
              setCurrentSegmentIndex(i);
              break;
            }
          }
        }
      }

      // Fetch alignments if available
      const { data: alignData } = await supabase
        .from('audio_alignments')
        .select('*')
        .eq('book_id', bid)
        .order('start_time', { ascending: true });

      if (alignData && alignData.length > 0) {
        setAlignments(alignData);
      }
    } catch (err) {
      console.error('Error fetching audio segments:', err);
    }
  };

  // Fetch book data
  const fetchBook = async (onShowInfo: (msg: string) => void, onShowSuccess: (msg: string) => void, onShowWarning: (msg: string) => void) => {
    setLoading(true);
    setError(null);
    try {
      bookIdRef.current = bookId;

      const { data, error: fetchError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setBook(data);

        // Check for locally downloaded document
        const localUri = await checkLocalDocument(bookId!);
        if (localUri) {
          setLocalDocumentUri(localUri);
        }

        // Restore reading progress
        const savedProgress = await readingProgressService.restoreProgress(bookId);
        if (savedProgress) {
          setCurrentPage(savedProgress.page_number);
          setProgressPercent(savedProgress.progress_percent);
        }

        // For reflow-capable formats
        if (data.document_type === 'pdf' || data.document_type === 'epub' || data.document_type === 'docx') {
          const chaptersResult = await fetchChapters(bookId);

          if (!chaptersResult || chaptersResult.length === 0) {
            if (data.document_type === 'pdf') {
              setViewMode('original');
              setLoading(false);
              onShowInfo('Processing document for reflow reading...');
              autoProcessDocument(data, onShowSuccess, onShowInfo, onShowWarning);
              return;
            } else {
              await autoProcessDocument(data, onShowSuccess, onShowInfo, onShowWarning);
            }
          } else {
            setViewMode('reflow');
          }
        }

        // For Markdown
        if (data.document_type === 'markdown') {
          const documentUri = localUri || data.document_url;
          if (documentUri) {
            try {
              let text: string;
              if (localUri && (documentUri.startsWith('file://') || documentUri.startsWith('/'))) {
                text = await readAsStringAsync(documentUri);
              } else {
                const response = await fetch(documentUri);
                if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
                text = await response.text();
              }

              setRawContent(text);
              setHtmlContent(markdownToHtml(text));
              const lines = text.split('\n').length;
              setTotalPages(Math.max(1, Math.ceil(lines / 40)));

              const extractedChapters = extractChapters(text);
              setChapters(extractedChapters.map((ch, i) => ({
                id: `chapter-${i}`,
                title: ch.title,
                level: ch.level,
              })));
            } catch (err: any) {
              setError(err?.message || 'Failed to load document content.');
            }
          }
        }
      } else {
        setError('Book not found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load book.');
    }
    setLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    // We expose fetchBook so the caller can pass toast callbacks
    // The actual call is made by the caller in their useEffect
    return () => {
      readingProgressService.clearPendingSave();
    };
  }, []);

  // Load highlights and bookmarks when book changes
  useEffect(() => {
    if (book?.id) {
      getHighlights(book.id);
      getBookmarks(book.id);
      fetchAudioSegments(book.id);
    }
  }, [book?.id]);

  // Estimated reading time
  const estimatedReadingTime = useCallback(() => {
    const words = rawContent.split(/\s+/).filter(w => w.length > 0).length;
    const minutes = Math.ceil(words / 200);
    if (minutes < 60) return `${minutes} min read`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m read`;
  }, [rawContent]);

  return {
    bookIdRef,
    book,
    setBook,
    loading,
    setLoading,
    htmlContent,
    setHtmlContent,
    rawContent,
    setRawContent,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    error,
    localDocumentUri,
    viewMode,
    setViewMode,
    chaptersWithContent,
    currentChapterIndex,
    setCurrentChapterIndex,
    loadingChapters,
    processingDocument,
    processingMessage,
    chapters,
    progressPercent,
    setProgressPercent,
    bookSegments,
    setBookSegments,
    resolvedAudioUris,
    currentSegmentIndex,
    setCurrentSegmentIndex,
    chapterContentCache,
    fetchBook,
    fetchChapters,
    fetchChapterContent,
    loadChapterContent,
    loadAllChaptersContent,
    fetchAudioSegments,
    autoProcessDocument,
    createFallbackChapter,
    checkLocalDocument,
    estimatedReadingTime,
    updateReadingProgress,
  };
}

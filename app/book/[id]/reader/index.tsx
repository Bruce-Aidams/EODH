import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/lib/notifications/toast';
import { Book, BookChapter, Highlight } from '@/types';
import { BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { markdownToHtml, markdownHtmlStyles, markdownHtmlStylesDark, extractChapters } from '@/lib/markdown/renderer';
import PdfReader from '@/components/PdfReader';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { processDocument } from '@/lib/admin/textProcessing';
import { useAudioStore } from '@/stores/audioStore';
import { useCompleteAudioPlayer } from '@/lib/audio/player';
import { getAudioSegmentUri } from '@/lib/offline/fileManager';
import { AudioSegment } from '@/types';
import { useHaptics } from '@/lib/haptics';
import { ProgressBar } from '@/components/ProgressBar';

// Extracted components
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ChapterContent } from '@/components/reader/ChapterContent';
import { TextHighlighter } from '@/components/reader/TextHighlighter';
import { FontSettingsSheet } from '@/components/reader/FontSettingsSheet';
import { BookmarkManager } from '@/components/reader/BookmarkManager';
import { ReaderOverflowMenu } from '@/components/reader/ReaderOverflowMenu';
import { AudioPlayerBar } from '@/components/reader/AudioPlayerBar';
import { ChapterPlaylist } from '@/components/reader/ChapterPlaylist';
import { AISummaryPanel } from '@/components/reader/AISummaryPanel';

// Services
import { readingProgressService } from '@/lib/reader/ReadingProgressService';
import { useAudioSync } from '@/lib/reader/AudioSyncService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReaderScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;
  const initialChapterId = params.chapterId as string | undefined;
  const initialSearchQuery = params.searchQuery as string | undefined;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateReadingProgress = useLibraryStore((s) => s.updateReadingProgress);
  const addBookmark = useLibraryStore((s) => s.addBookmark);
  const removeBookmark = useLibraryStore((s) => s.removeBookmark);
  const getBookmarks = useLibraryStore((s) => s.getBookmarks);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const addNote = useLibraryStore((s) => s.addNote);
  const removeHighlight = useLibraryStore((s) => s.removeHighlight);
  const getHighlights = useLibraryStore((s) => s.getHighlights);
  const bookmarks = useLibraryStore((s) => s.bookmarks);
  const highlights = useLibraryStore((s) => s.highlights);
  const readingSettings = useSettingsStore((s) => s.readingSettings);
  const setReadingSettings = useSettingsStore((s) => s.setReadingSettings);
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { colors, isDark } = useTheme();
  const { haptic } = useHaptics();
  const insets = useSafeAreaInsets();

  // Audio sync
  const { syncState, toggleAutoScroll } = useAudioSync();

  // Audio store actions
  const setSegments = useAudioStore((s) => s.setSegments);
  const setAlignments = useAudioStore((s) => s.setAlignments);
  const setBufferStatus = useAudioStore((s) => s.setBufferStatus);
  const resetAudio = useAudioStore((s) => s.reset);
  const setStorePlaybackSpeed = useAudioStore((s) => s.setPlaybackSpeed);

  // Audio player state
  const [bookSegments, setBookSegments] = useState<AudioSegment[]>([]);
  const [resolvedAudioUris, setResolvedAudioUris] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  // Core state
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [localDocumentUri, setLocalDocumentUri] = useState<string | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<'reflow' | 'original'>('reflow');
  const [chaptersWithContent, setChaptersWithContent] = useState<BookChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [processingDocument, setProcessingDocument] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // In-memory cache for chapter content
  const chapterContentCache = useRef<Map<string, string>>(new Map());

  // Note/Highlight modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFC928');

  // Bookmarks modal state
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Highlights modal state
  const [showHighlights, setShowHighlights] = useState(false);
  const [highlightNoteText, setHighlightNoteText] = useState('');
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);

  // Table of Contents state
  const [showToc, setShowToc] = useState(false);
  const [chapters, setChapters] = useState<{ id: string; title: string; level: number }[]>([]);

  // Progress bar state
  const [progressPercent, setProgressPercent] = useState(0);

  // Auto-hide header timer
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerAutoHidden, setHeaderAutoHidden] = useState(false);

  // In-book search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterId: string; chapterTitle: string; matchIndex: number; snippet: string; textOffset: number; chapterIndex: number }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Track whether we've processed the initial search navigation
  const initialSearchProcessed = useRef(false);

  // Overflow menu state
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // Chapter playlist state
  const [showChapterPlaylist, setShowChapterPlaylist] = useState(false);

  // AI Summary panel state
  const [showAISummary, setShowAISummary] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const bookIdRef = useRef<string>('');

  // Build the current audio URI from the active segment (uses local file if available)
  const currentSegment = bookSegments[currentSegmentIndex] || null;
  const currentAudioUri = resolvedAudioUris[currentSegmentIndex] || currentSegment?.audio_url || null;

  // Use refs to avoid stale closures in callbacks
  const currentSegmentRef = useRef(currentSegment);
  const currentSegmentIndexRef = useRef(currentSegmentIndex);
  const bookSegmentsRef = useRef(bookSegments);
  currentSegmentRef.current = currentSegment;
  currentSegmentIndexRef.current = currentSegmentIndex;
  bookSegmentsRef.current = bookSegments;

  // Stabilized callbacks to prevent infinite re-renders
  const handleAudioPositionChange = useCallback((time: number) => {
    const seg = currentSegmentRef.current;
    if (seg) {
      const globalTime = seg.start_time + time;
      useAudioStore.setState({ currentTime: globalTime });
    }
  }, []);

  const handleAudioDurationChange = useCallback((dur: number) => {
    useAudioStore.setState({ duration: dur });
  }, []);

  const handleAudioBufferingChange = useCallback((buf: boolean) => {
    setBufferStatus(buf ? 'buffering' : 'ready');
  }, [setBufferStatus]);

  const handleAudioPlay = useCallback(() => {
    useAudioStore.setState({ isPlaying: true });
  }, []);

  const handleAudioPause = useCallback(() => {
    useAudioStore.setState({ isPlaying: false });
  }, []);

  const handleAudioPlaybackEnd = useCallback(() => {
    const idx = currentSegmentIndexRef.current;
    const segs = bookSegmentsRef.current;
    if (idx < segs.length - 1) {
      setCurrentSegmentIndex(idx + 1);
    } else {
      useAudioStore.setState({ isPlaying: false });
    }
  }, []);

  const audioCallbacks = useMemo(
    () => ({
      onPositionChange: handleAudioPositionChange,
      onDurationChange: handleAudioDurationChange,
      onBufferingChange: handleAudioBufferingChange,
      onPlay: handleAudioPlay,
      onPause: handleAudioPause,
      onPlaybackEnd: handleAudioPlaybackEnd,
    }),
    [handleAudioPositionChange, handleAudioDurationChange, handleAudioBufferingChange, handleAudioPlay, handleAudioPause, handleAudioPlaybackEnd],
  );

  // Real audio player hook — keyed on segment so it reloads when segment changes
  const {
    isPlaying: playerIsPlaying,
    isLoaded,
    isBuffering,
    currentTime: playerTime,
    duration: playerDuration,
    playbackRate,
    play: playerPlay,
    pause: playerPause,
    seekTo: playerSeekTo,
    setPlaybackRate: playerSetRate,
    didJustFinish,
  } = useCompleteAudioPlayer(currentAudioUri, 1.0, audioCallbacks);

  // Sync store state with real player state
  useEffect(() => {
    useAudioStore.setState({ isPlaying: playerIsPlaying });
  }, [playerIsPlaying]);

  // Determine current segment index based on playback time — throttle to avoid rapid re-renders
  const segmentCheckRef = useRef<number>(0);
  useEffect(() => {
    if (bookSegments.length === 0) return;
    const now = Date.now();
    if (now - segmentCheckRef.current < 500) return; // Throttle to 500ms
    segmentCheckRef.current = now;

    const { currentTime: storeTime } = useAudioStore.getState();
    for (let i = bookSegments.length - 1; i >= 0; i--) {
      if (storeTime >= bookSegments[i].start_time) {
        if (i !== currentSegmentIndex) {
          setCurrentSegmentIndex(i);
        }
        break;
      }
    }
  }, [playerTime, bookSegments, currentSegmentIndex]);

  // Auto-process document if no chapters exist
  const autoProcessDocument = async (book: Book) => {
    setProcessingDocument(true);
    setProcessingMessage('Extracting text and creating chapters...');

    try {
      const result = await processDocument(book, (progress) => {
        setProcessingMessage(progress.message);
      });

      if (result.success) {
        showSuccess(`Document processed! ${result.chaptersCreated} chapters created.`);
        const bookId = bookIdRef.current;
        if (bookId) {
          await fetchChapters(bookId);
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
          showWarning('Document could not be fully processed. Showing original PDF mode.');
          setViewMode('original');
        }
      }
    } catch (err) {
      console.error('Fallback chapter creation failed:', err);
    }
  };

  // Fetch book data
  const fetchBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const bookId = (Array.isArray(id) ? id[0] : id)!;
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
              showInfo('Processing document for reflow reading...');
              autoProcessDocument(data);
              return;
            } else {
              await autoProcessDocument(data);
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

  useEffect(() => {
    fetchBook();
    // Reset the initial search flag when book changes
    initialSearchProcessed.current = false;
    return () => {
      readingProgressService.clearPendingSave();
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      playerPause();
      resetAudio();
    };
  }, [id]);

  // Auto-navigate to chapter and search when opened from global search results
  useEffect(() => {
    if (initialSearchProcessed.current) return;
    if (!initialChapterId && !initialSearchQuery) return;
    if (chaptersWithContent.length === 0) return;

    initialSearchProcessed.current = true;

    // Find the chapter index matching the chapterId
    const targetIndex = chaptersWithContent.findIndex(ch => ch.id === initialChapterId);
    if (targetIndex !== -1 && initialSearchQuery) {
      // Navigate to the chapter first, then run search
      setTimeout(() => {
        navigateToChapterIndex(targetIndex);
        // After navigation, set the search query and run the search
        setTimeout(() => {
          setSearchQuery(initialSearchQuery!);
          searchInBook(initialSearchQuery!);
          // After search completes, navigate to the first result
          setTimeout(() => {
            setShowSearch(true);
          }, 500);
        }, 300);
      }, 200);
    } else if (targetIndex !== -1) {
      // No search query, just navigate to the chapter
      setTimeout(() => {
        navigateToChapterIndex(targetIndex);
      }, 200);
    }
  }, [chaptersWithContent, initialChapterId, initialSearchQuery]);

  // Fetch audio segments for the book
  const fetchAudioSegments = async (bookId: string) => {
    try {
      const { data: segData, error: segError } = await supabase
        .from('audio_segments')
        .select('*')
        .eq('book_id', bookId)
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
          const localUri = await getAudioSegmentUri(bookId, i + 1, segment.audio_url);
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
        .eq('book_id', bookId)
        .order('start_time', { ascending: true });

      if (alignData && alignData.length > 0) {
        setAlignments(alignData);
      }
    } catch (err) {
      console.error('Error fetching audio segments:', err);
    }
  };

  // Check for locally downloaded document
  const checkLocalDocument = async (bookId: string): Promise<string | null> => {
    const docUri = `${FileSystem.documentDirectory}eodh/books/${bookId}/document`;
    const info = await getInfoAsync(docUri);
    return info.exists ? docUri : null;
  };

  // Fetch chapter list
  const fetchChapterList = async (bookId: string): Promise<BookChapter[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('book_chapters')
        .select('id, book_id, title, content, order_index, page_start, page_end, created_at')
        .eq('book_id', bookId)
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

  // Fetch processed chapters
  const fetchChapters = async (bookId: string): Promise<BookChapter[]> => {
    setLoadingChapters(true);
    try {
      const data = await fetchChapterList(bookId);
      if (data.length > 0) {
        await loadAllChaptersContent(data);
      }
      return data;
    } finally {
      setLoadingChapters(false);
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

  // Navigate to a specific chapter
  const navigateToChapterIndex = async (index: number) => {
    if (chaptersWithContent[index]) {
      await haptic('medium');
      setCurrentChapterIndex(index);
      setShowToc(false);
      setShowChapterPlaylist(false);
      
      // If all chapters are combined in one HTML, scroll to the chapter section
      const combinedHtml = htmlContent;
      const sectionId = `chapter-${index}`;
      if (combinedHtml.includes(`id="${sectionId}"`)) {
        // Content is combined — scroll to the section
        // Calculate the approximate position by finding the section in the HTML
        const sectionIndex = combinedHtml.indexOf(`id="${sectionId}"`);
        if (sectionIndex >= 0) {
          // Estimate scroll position from the character offset in combined HTML
          const textBefore = combinedHtml.substring(0, sectionIndex);
          const avgCharsPerLine = Math.max(40, Math.floor((SCREEN_WIDTH - readingSettings.margins * 2) / (readingSettings.fontSize * 0.5)));
          const textLines = Math.floor(textBefore.replace(/<[^>]+>/g, '').length / avgCharsPerLine);
          const lineHeight = readingSettings.fontSize * readingSettings.lineSpacing;
          const estimatedY = Math.max(0, textLines * lineHeight - 50);
          
          if (scrollViewRef.current) {
            (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
            // Wait for render, then scroll to the section
            setTimeout(() => {
              if (scrollViewRef.current) {
                (scrollViewRef.current as any).scrollTo({ y: estimatedY, animated: true });
              }
            }, 100);
          }
        }
      } else {
        // Content is not combined — load the single chapter
        setLoadingChapters(true);
        if (scrollViewRef.current) {
          (scrollViewRef.current as any).scrollTo({ y: 0, animated: false });
        }
        await fetchChapterContent(chaptersWithContent[index].id);
        setLoadingChapters(false);
      }
      
      // Switch audio to the matching segment
      if (bookSegments[index] !== undefined) {
        setCurrentSegmentIndex(index);
      }
    } else {
      setShowToc(false);
      setShowChapterPlaylist(false);
    }
  };

  // Scroll handler
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;

    const scrollPercent = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    const page = Math.max(1, Math.ceil(scrollPercent * totalPages));
    const pct = Math.min(100, scrollPercent * 100);

    setCurrentPage(page);
    setProgressPercent(pct);

    if (book) {
      updateReadingProgress({
        book_id: bookIdRef.current,
        page_number: page,
        progress_percent: pct,
      });
    }

    // Auto-hide header on scroll
    if (!headerAutoHidden) {
      setHeaderAutoHidden(true);
      setShowHeader(false);
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      headerTimerRef.current = setTimeout(() => {
        setHeaderAutoHidden(false);
        setShowHeader(true);
      }, 3000);
    }
  }, [book, totalPages, updateReadingProgress, headerAutoHidden]);

  // Header toggle
  const toggleHeader = () => {
    if (headerAutoHidden) {
      setShowHeader(true);
      setHeaderAutoHidden(false);
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      headerTimerRef.current = setTimeout(() => {
        setHeaderAutoHidden(true);
        setShowHeader(false);
      }, 3000);
    } else {
      setShowHeader(!showHeader);
    }
  };

  // Actions toggle
  const toggleActions = () => {
    setShowActions(!showActions);
  };

  // Font size change
  const changeFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, readingSettings.fontSize + delta));
    setReadingSettings({ fontSize: newSize });
  };

  // Reset settings
  const resetSettings = () => {
    setReadingSettings({
      fontFamily: 'System',
      fontSize: 18,
      lineSpacing: 1.5,
      textAlign: 'justify',
      backgroundColor: '#F6F5FC',
      theme: 'light',
      margins: 16,
    });
    showSuccess('Settings reset to defaults.');
    setShowSettings(false);
  };

  // Check if current page is bookmarked
  const isPageBookmarked = (() => {
    if (!book || !user) return false;
    return bookmarks.some(b => b.book_id === book.id && b.page_number === currentPage);
  })();

  // Find the bookmark for the current page
  const currentBookmark = (() => {
    if (!book || !user) return null;
    return bookmarks.find(b => b.book_id === book.id && b.page_number === currentPage) || null;
  })();

  // Bookmark toggle handler - adds or removes bookmark
  const handleBookmark = async () => {
    if (!book || !user) {
      showWarning('Please sign in to bookmark pages.');
      return;
    }
    if (isPageBookmarked && currentBookmark) {
      // Remove existing bookmark
      try {
        await removeBookmark(currentBookmark.id);
        await haptic('light');
        showSuccess('Bookmark removed.');
      } catch (err) {
        showError('Failed to remove bookmark.');
      }
    } else {
      // Add new bookmark
      try {
        await addBookmark({
          book_id: book.id,
          page_number: currentPage,
          text_excerpt: rawContent.substring(0, 200),
          note: null,
          user_id: user.id,
          chapter_id: null,
        } as any);
        await haptic('success');
        showSuccess('Page bookmarked.');
      } catch (err) {
        showError('Failed to bookmark page.');
      }
    }
  };

  // Highlight handler
  const handleHighlight = async () => {
    if (!user) {
      showWarning('Please sign in to highlight text.');
      return;
    }
    await haptic('light');
    const excerpt = rawContent.substring(0, 300);
    handleSaveHighlight(excerpt);
  };

  const handleSaveHighlight = async (text: string) => {
    if (!book || !user) return;
    try {
      await addHighlight({
        book_id: book.id,
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
      showSuccess('Text highlighted.');
    } catch (err) {
      showError('Failed to save highlight.');
    }
  };

  // Note handler
  const handleSaveNote = async () => {
    if (!book || !user) {
      showWarning('Please sign in to add notes.');
      return;
    }
    if (!noteText.trim()) {
      showWarning('Please enter some text for your note.');
      return;
    }
    try {
      await addNote({
        book_id: book.id,
        page_number: currentPage,
        content: noteText.trim(),
        user_id: user.id,
        chapter_id: null,
      } as any);
      setShowNoteModal(false);
      setNoteText('');
      showSuccess('Note saved.');
    } catch (err) {
      showError('Failed to save note.');
    }
  };

  const openNoteModal = () => {
    setNoteText('');
    setShowNoteModal(true);
  };

  // Filter highlights for the current book
  const bookHighlights = useMemo(() => {
    if (!book) return [];
    return highlights.filter(h => h.book_id === book.id);
  }, [highlights, book]);

  // Load highlights, bookmarks, and audio segments when book changes
  useEffect(() => {
    if (book?.id) {
      getHighlights(book.id);
      getBookmarks(book.id);
      fetchAudioSegments(book.id);
    }
  }, [book?.id]);

  // Remove highlight handler
  const handleRemoveHighlight = async (highlightId: string) => {
    try {
      await removeHighlight(highlightId);
      showSuccess('Highlight removed.');
    } catch (err) {
      showError('Failed to remove highlight.');
    }
  };

  // Add note to highlight handler
  const handleAddNoteToHighlight = (highlight: Highlight) => {
    setSelectedHighlight(highlight);
    setHighlightNoteText(highlight.note || '');
    setShowNoteModal(true);
  };

  // Save note to highlight
  const handleSaveHighlightNote = async () => {
    if (!selectedHighlight || !highlightNoteText.trim()) {
      showWarning('Please enter some text for your note.');
      return;
    }
    try {
      const { data } = await supabase
        .from('highlights')
        .update({ note: highlightNoteText.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedHighlight.id)
        .select()
        .single();
      
      // Update local store
      const updatedHighlight = { ...selectedHighlight, note: highlightNoteText.trim(), updated_at: new Date().toISOString() };
      useLibraryStore.setState(state => ({
        highlights: state.highlights.map(h => h.id === selectedHighlight.id ? updatedHighlight : h),
      }));
      
      setShowNoteModal(false);
      setHighlightNoteText('');
      setSelectedHighlight(null);
      showSuccess('Note saved to highlight.');
    } catch (err) {
      showError('Failed to save note.');
    }
  };

  // In-book search
  const searchInBook = async (query: string) => {
    if (!book || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const searchQuery = query.trim().toLowerCase();
      const results: { chapterId: string; chapterTitle: string; matchIndex: number; snippet: string; textOffset: number; chapterIndex: number }[] = [];
      let matchIndex = 0;

      // Search in the combined HTML content (stripped of tags for matching)
      // This ensures the offset matches what's actually rendered
      const combinedRaw = htmlContent.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
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
        let offsetInChapter = 0;
        
        for (let ci = 0; ci < chaptersWithContent.length; ci++) {
          const chapter = chaptersWithContent[ci];
          const chapterRaw = (chapter.content || '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
          const chapterLen = chapterRaw.length;
          
          if (charCount + chapterLen > foundIndex) {
            matchedChapterIndex = ci;
            matchedChapterId = chapter.id;
            matchedChapterTitle = chapter.title;
            offsetInChapter = foundIndex - charCount;
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
          textOffset: foundIndex, // offset in combined raw text
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
      showError('Search failed. Please try again.');
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
    
    // Check if content is combined (all chapters in one HTML)
    const combinedHtml = htmlContent;
    const sectionId = `chapter-${targetChapterIndex}`;
    const isCombined = combinedHtml.includes(`id="${sectionId}"`);

    if (isCombined) {
      // Content is combined — scroll to the match within the combined content
      const combinedRaw = combinedHtml.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
      const lowerCombined = combinedRaw.toLowerCase();
      const matchedTextLower = searchQuery.trim().toLowerCase();
      const offset = result.textOffset;

      // Verify the offset still matches
      const textAtOffset = lowerCombined.substring(offset, offset + matchedTextLower.length);
      
      // Highlight the matched text in the combined HTML
      // Find the match in the HTML content by matching the raw text position
      const markTag = '<mark id="search-match" style="background-color: #FFC928; color: inherit;">';
      
      // To highlight, we need to find the match in the HTML (not raw text)
      // Since HTML has tags, we search for the text content within the HTML
      const searchText = combinedHtml.substring(offset, offset + matchedTextLower.length);
      const searchTextLower = searchText.toLowerCase();
      
      if (searchTextLower === matchedTextLower) {
        // Direct match in HTML at this offset
        const before = combinedHtml.substring(0, offset);
        const match = combinedHtml.substring(offset, offset + matchedTextLower.length);
        const after = combinedHtml.substring(offset + matchedTextLower.length);
        const highlightedContent = `${before}${markTag}${match}</mark>${after}`;
        setHtmlContent(highlightedContent);
        setRawContent(highlightedContent.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' '));
      }

      showInfo(`Match ${index + 1} of ${searchResults.length}: ${result.chapterTitle}`);

      // Scroll to the match — estimate Y position from text offset in combined content
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
      // Content is not combined — switch to the chapter
      const chapter = chaptersWithContent[targetChapterIndex];
      if (!chapter || !chapter.content) {
        showWarning('Chapter content not available.');
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

      // Highlight within the single chapter content
      const content = chapter.content;
      const lowerContent = content.toLowerCase();
      const matchedTextLower = searchQuery.trim().toLowerCase();
      const markTag = '<mark id="search-match" style="background-color: #FFC928; color: inherit;">';

      // Find the first occurrence of the search query in this chapter
      const firstMatchIndex = lowerContent.indexOf(matchedTextLower);
      if (firstMatchIndex !== -1) {
        const before = content.substring(0, firstMatchIndex);
        const match = content.substring(firstMatchIndex, firstMatchIndex + matchedTextLower.length);
        const after = content.substring(firstMatchIndex + matchedTextLower.length);
        const highlightedContent = `${before}${markTag}${match}</mark>${after}`;
        setHtmlContent(highlightedContent);
        setRawContent(highlightedContent.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' '));
      }

      showInfo(`Match ${index + 1} of ${searchResults.length}: ${result.chapterTitle}`);

      // Scroll to the match
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

  // Theme colors
  const getThemeColors = () => {
    switch (readingSettings.theme) {
      case 'dark':
        return { background: '#1a1a1a', text: '#e0e0e0', secondaryText: '#888888' };
      case 'system':
        return {
          background: isDark ? '#1a1a1a' : '#FFFFFF',
          text: isDark ? '#e0e0e0' : '#1a1a1a',
          secondaryText: isDark ? '#888888' : '#666666',
        };
      case 'blue':
        return { background: '#1a2744', text: '#D6E4F0', secondaryText: '#8BA4C0' };
      default:
        return { background: '#FFFFFF', text: '#1a1a1a', secondaryText: '#666666' };
    }
  };

  const getHtmlStyles = () => {
    const baseFontSize = readingSettings.fontSize;

    if (readingSettings.theme === 'dark' || readingSettings.theme === 'blue') {
      return {
        ...markdownHtmlStylesDark,
        document: {
          ...markdownHtmlStylesDark.document,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
        p: {
          ...markdownHtmlStylesDark.p,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
        li: {
          ...markdownHtmlStylesDark.li,
          fontSize: baseFontSize,
          lineHeight: baseFontSize * readingSettings.lineSpacing,
          fontFamily: readingSettings.fontFamily,
        },
      };
    }

    return {
      ...markdownHtmlStyles,
      document: {
        ...markdownHtmlStyles.document,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
      p: {
        ...markdownHtmlStyles.p,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
      li: {
        ...markdownHtmlStyles.li,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * readingSettings.lineSpacing,
        fontFamily: readingSettings.fontFamily,
      },
    };
  };

  const themeColors = getThemeColors();
  const htmlStyles = getHtmlStyles();
  const contentWidth = SCREEN_WIDTH - readingSettings.margins * 2;

  // Estimated reading time
  const estimatedReadingTime = useMemo(() => {
    const words = rawContent.split(/\s+/).filter(w => w.length > 0).length;
    const minutes = Math.ceil(words / 200);
    if (minutes < 60) return `${minutes} min read`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m read`;
  }, [rawContent]);

  // Navigate to chapter
  const navigateToChapter = useCallback((index: number) => {
    if (chaptersWithContent.length > 0) {
      navigateToChapterIndex(index);
    } else if (scrollViewRef.current && htmlContent) {
      (scrollViewRef.current as any).scrollTo({ y: 0, animated: true });
      setShowToc(false);
    }
  }, [chaptersWithContent.length, htmlContent]);

  // Overflow menu handlers
  const handleOverflowBookInfo = () => {
    setShowOverflowMenu(false);
    showInfo(`Book: ${book?.title || 'Unknown'}\nAuthor: ${book?.author || 'Unknown'}`);
  };

  const handleOverflowToc = () => {
    setShowOverflowMenu(false);
    setShowToc(true);
  };

  const handleOverflowSearch = () => {
    setShowOverflowMenu(false);
    setShowSearch(true);
  };

  const handleOverflowBookmarks = () => {
    setShowOverflowMenu(false);
    setShowBookmarks(true);
  };

  // Remove bookmark from modal
  const handleRemoveBookmark = async (bookmarkId: string) => {
    try {
      await removeBookmark(bookmarkId);
      showSuccess('Bookmark removed.');
    } catch (err) {
      showError('Failed to remove bookmark.');
    }
  };

  const handleOverflowSettings = () => {
    setShowOverflowMenu(false);
    setShowSettings(true);
  };

  const handleOverflowShare = async () => {
    setShowOverflowMenu(false);
    try {
      await Share.share({
        message: `Reading "${book?.title || 'Unknown Book'}" on EODH App`,
        title: book?.title || 'EODH Book',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleOverflowReport = () => {
    setShowOverflowMenu(false);
    Alert.alert('Report Issue', 'Please describe the issue you encountered.');
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
        {processingDocument ? (
          <View style={styles.loadingProcessing}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingProcessingText, { color: themeColors.text }]}>
              {processingMessage || 'Processing document...'}
            </Text>
            <Text style={[styles.loadingProcessingSubText, { color: themeColors.secondaryText }]}>
              Converting to reflow format for smooth reading
            </Text>
            <Text style={[styles.loadingProcessingHint, { color: themeColors.secondaryText }]}>
              This may take a moment for larger files
            </Text>
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
      <StatusBar
        barStyle={(readingSettings.theme === 'dark' || readingSettings.theme === 'blue') ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <ReaderHeader
        bookTitle={book?.title || 'Reader'}
        currentPage={currentPage}
        totalPages={totalPages}
        estimatedReadingTime={estimatedReadingTime}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        showHeader={showHeader}
        chaptersCount={chapters.length}
        isBookmarked={isPageBookmarked}
        onBack={() => router.back()}
        onToggleHeader={toggleHeader}
        onSearch={() => setShowSearch(true)}
        onTableOfContents={() => setShowToc(true)}
        onActions={toggleActions}
        onOverflowMenu={() => setShowOverflowMenu(true)}
        onSettings={() => setShowSettings(true)}
        onToggleBookmark={handleBookmark}
      />

      {/* Progress Bar */}
      {book?.document_type !== 'pdf' && (
        <ProgressBar progress={progressPercent} height={3} />
      )}

      {/* Content */}
      <AnimatedView style={{ flex: 1 }} fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <TouchableOpacity style={styles.tapArea} onPress={toggleHeader} activeOpacity={1}>
          {book?.document_type === 'pdf' && viewMode === 'original' && (localDocumentUri || book.document_url) ? (
            <View style={{ flex: 1 }}>
              <PdfReader
                sourceUri={localDocumentUri || book.document_url || ''}
                onPageChange={(page, total) => {
                  setCurrentPage(page);
                  setTotalPages(total);
                  if (book) {
                    updateReadingProgress({
                      book_id: bookIdRef.current,
                      page_number: page,
                      progress_percent: Math.min(100, (page / total) * 100),
                    });
                  }
                }}
                onLoadComplete={(total) => setTotalPages(total)}
                onError={(err) => console.error('PDF error:', err)}
              />
            </View>
          ) : (
            <ChapterContent
              htmlContent={htmlContent}
              rawContent={rawContent}
              themeColors={themeColors}
              colors={{ primary: colors.primary }}
              readingSettings={readingSettings}
              contentWidth={contentWidth}
              htmlStyles={htmlStyles}
              loadingChapters={loadingChapters}
              processingDocument={processingDocument}
              processingMessage={processingMessage}
              scrollViewRef={scrollViewRef as any}
              onScroll={handleScroll}
            />
          )}
        </TouchableOpacity>
      </AnimatedView>

      {/* View Mode Toggle for PDF Books */}
      {book?.document_type === 'pdf' && (
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              viewMode === 'reflow' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('reflow')}
          >
            <Ionicons name="text" size={16} color={viewMode === 'reflow' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.viewModeButtonText, { color: viewMode === 'reflow' ? '#FFFFFF' : colors.primary }]}>
              Reflow
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              viewMode === 'original' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('original')}
          >
            <Ionicons name="document-text" size={16} color={viewMode === 'original' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.viewModeButtonText, { color: viewMode === 'original' ? '#FFFFFF' : colors.primary }]}>
              Original PDF
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Bar */}
      {showActions && (
        <View style={[styles.actionBar, { backgroundColor: themeColors.background, borderTopColor: colors.border }]}>
          <BookmarkManager
            bookId={book?.id || ''}
            currentPage={currentPage}
            bookmarks={bookmarks}
            themeColors={themeColors}
            colors={{ primary: colors.primary }}
            isBookmarked={isPageBookmarked}
            onToggleBookmark={handleBookmark}
          />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHighlight}
            accessibilityLabel="Highlight text"
          >
            <Ionicons name="pencil" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Highlight</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={openNoteModal}
            accessibilityLabel="Add note"
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Note</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleActions}
            accessibilityLabel="Close actions"
          >
            <Ionicons name="close" size={22} color={themeColors.secondaryText} />
            <Text style={[styles.actionButtonText, { color: themeColors.secondaryText }]}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                {selectedHighlight ? 'Note for Highlight' : 'Add Note'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                  setHighlightNoteText('');
                  setSelectedHighlight(null);
                }}
                accessibilityLabel="Close note modal"
              >
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            {selectedHighlight && (
              <View
                style={[
                  styles.highlightPreview,
                  {
                    backgroundColor: selectedHighlight.color + '30',
                    borderLeftColor: selectedHighlight.color,
                  },
                ]}
              >
                <Text style={[styles.highlightPreviewText, { color: themeColors.text }]} numberOfLines={3}>
                  {selectedHighlight.text}
                </Text>
              </View>
            )}

            <TextInput
              style={[styles.noteInput, { color: themeColors.text, backgroundColor: themeColors.background }]}
              placeholder="Write your note..."
              placeholderTextColor={themeColors.secondaryText}
              value={selectedHighlight ? highlightNoteText : noteText}
              onChangeText={(text) => {
                if (selectedHighlight) {
                  setHighlightNoteText(text);
                } else {
                  setNoteText(text);
                }
              }}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              accessibilityLabel="Note text input"
            />

            {!selectedHighlight && (
              <>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: themeColors.text }]}>Highlight Color</Text>
                  <View style={styles.colorRow}>
                    {['#FFC928', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'].map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          highlightColor === color && styles.colorCircleActive,
                        ]}
                        onPress={() => setHighlightColor(color)}
                        accessibilityLabel={`Select highlight color ${color}`}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveNote}
                    accessibilityLabel="Save note"
                  >
                    <Text style={styles.noteActionText}>Save Note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleSaveHighlight(noteText || rawContent.substring(0, 300))}
                    accessibilityLabel="Save highlight"
                  >
                    <Text style={styles.noteActionText}>Save Highlight</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {selectedHighlight && (
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveHighlightNote}
                  accessibilityLabel="Save note to highlight"
                >
                  <Text style={styles.noteActionText}>Save Note to Highlight</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Table of Contents Modal */}
      <Modal visible={showToc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Table of Contents</Text>
              <TouchableOpacity onPress={() => setShowToc(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {chapters.map((chapter, index) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={[
                    styles.tocItem,
                    { paddingLeft: chapter.level === 1 ? 0 : chapter.level === 2 ? 16 : 24 },
                  ]}
                  onPress={() => navigateToChapter(index)}
                >
                  <Text
                    style={[
                      styles.tocItemText,
                      {
                        color: themeColors.text,
                        fontSize: chapter.level === 1 ? 16 : chapter.level === 2 ? 14 : 13,
                        fontWeight: chapter.level === 1 ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {chapter.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Search in Book</Text>
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: colors.border }]}
                placeholder="Search..."
                placeholderTextColor={themeColors.secondaryText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoFocus={true}
                accessibilityLabel="Search text input"
              />
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: colors.primary }]}
                onPress={handleSearch}
                disabled={isSearching || searchQuery.trim().length < 2}
              >
                <Ionicons name="search" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {isSearching ? (
              <View style={styles.loadingChapters}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <Text style={[styles.searchResultCount, { color: themeColors.secondaryText }]}>
                  {searchResults.length} matches found
                </Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {searchResults.map((result, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.searchResultItem,
                        { borderBottomColor: colors.border },
                        index === currentSearchIndex && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => navigateToSearchResult(index)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="bookmark" size={16} color={colors.primary} />
                        <Text style={[styles.searchResultChapter, { color: themeColors.text }]}>
                          {result.chapterTitle}
                        </Text>
                      </View>
                      <Text style={[styles.searchResultSnippet, { color: themeColors.secondaryText }]}>
                        {result.snippet.replace(/<[^>]+>/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                    onPress={() => navigateToSearchResult(currentSearchIndex - 1)}
                    disabled={currentSearchIndex === 0}
                  >
                    <Ionicons name="arrow-up" size={20} color={currentSearchIndex === 0 ? themeColors.secondaryText : colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.searchNavText, { color: themeColors.text }]}>
                    {currentSearchIndex + 1} / {searchResults.length}
                  </Text>
                  <TouchableOpacity
                    style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                    onPress={() => navigateToSearchResult(currentSearchIndex + 1)}
                    disabled={currentSearchIndex >= searchResults.length - 1}
                  >
                    <Ionicons name="arrow-down" size={20} color={currentSearchIndex >= searchResults.length - 1 ? themeColors.secondaryText : colors.primary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : searchQuery.trim().length >= 2 ? (
              <View style={styles.emptySearch}>
                <Ionicons name="search" size={48} color={themeColors.secondaryText} />
                <Text style={[styles.emptySearchText, { color: themeColors.secondaryText }]}>No matches found</Text>
                <Text style={[styles.emptySearchSubText, { color: themeColors.secondaryText }]}>
                  Try a different search term
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Font Settings Sheet */}
      <FontSettingsSheet
        visible={showSettings}
        readingSettings={readingSettings}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowSettings(false)}
        onSetReadingSettings={setReadingSettings}
        onChangeFontSize={changeFontSize}
        onResetSettings={resetSettings}
      />

      {/* Overflow Menu */}
      <ReaderOverflowMenu
        visible={showOverflowMenu}
        book={book}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowOverflowMenu(false)}
        onBookInfo={handleOverflowBookInfo}
        onTableOfContents={handleOverflowToc}
        onSearch={handleOverflowSearch}
        onBookmarks={handleOverflowBookmarks}
        onHighlights={() => setShowHighlights(true)}
        onSettings={handleOverflowSettings}
        onShare={handleOverflowShare}
        onReport={handleOverflowReport}
        onAIInsights={() => setShowAISummary(true)}
      />

      {/* AI Summary Panel */}
      <AISummaryPanel
        visible={showAISummary}
        bookId={id}
        bookTitle={book?.title || ''}
        fullText={rawContent}
        onClose={() => setShowAISummary(false)}
      />

      {/* Highlights Modal */}
      <Modal visible={showHighlights} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Highlights ({bookHighlights.length})
              </Text>
              <TouchableOpacity onPress={() => setShowHighlights(false)} accessibilityLabel="Close highlights">
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: '70%' }}>
              {bookHighlights.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <View style={[{ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                    <Ionicons name="pencil-outline" size={28} color={themeColors.secondaryText} />
                  </View>
                  <Text style={[{ color: themeColors.text, marginTop: 0, fontSize: 16, fontWeight: '600', letterSpacing: 0.1 }]}>
                    No highlights yet
                  </Text>
                  <Text style={[{ color: themeColors.secondaryText, marginTop: 6, fontSize: 14, lineHeight: 20 }]}>
                    Use the Highlight button to mark passages
                  </Text>
                </View>
              ) : (
                <TextHighlighter
                  highlights={bookHighlights}
                  themeColors={themeColors}
                  colors={{ primary: colors.primary, border: colors.border }}
                  onRemoveHighlight={handleRemoveHighlight}
                  onAddNoteToHighlight={handleAddNoteToHighlight}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bookmarks Modal */}
      <Modal visible={showBookmarks} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Bookmarks ({bookmarks.filter(b => b.book_id === book?.id).length})
              </Text>
              <TouchableOpacity onPress={() => setShowBookmarks(false)} accessibilityLabel="Close bookmarks">
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: '70%' }}>
              {bookmarks.filter(b => b.book_id === book?.id).length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <View style={[{ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                    <Ionicons name="bookmark-outline" size={28} color={themeColors.secondaryText} />
                  </View>
                  <Text style={[{ color: themeColors.text, marginTop: 0, fontSize: 16, fontWeight: '600', letterSpacing: 0.1 }]}>
                    No bookmarks yet
                  </Text>
                  <Text style={[{ color: themeColors.secondaryText, marginTop: 6, fontSize: 14, lineHeight: 20 }]}>
                    Tap the bookmark icon to save your place
                  </Text>
                </View>
              ) : (
                bookmarks
                  .filter(b => b.book_id === book?.id)
                  .map((bookmark) => (
                    <View
                      key={bookmark.id}
                      style={[
                        styles.bookmarkItem,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bookmarkPageText, { color: colors.primary }]}>
                          Page {bookmark.page_number}
                        </Text>
                        {bookmark.text_excerpt && (
                          <Text
                            style={[styles.bookmarkExcerpt, { color: themeColors.text }]}
                            numberOfLines={2}
                          >
                            {bookmark.text_excerpt}
                          </Text>
                        )}
                        {bookmark.note && (
                          <Text
                            style={[styles.bookmarkNote, { color: themeColors.secondaryText }]}
                            numberOfLines={2}
                          >
                            📝 {bookmark.note}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveBookmark(bookmark.id)}
                        accessibilityLabel="Remove bookmark"
                        style={{ padding: 8 }}
                      >
                        <Ionicons name="trash-outline" size={20} color={themeColors.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chapter Playlist */}
      <ChapterPlaylist
        visible={showChapterPlaylist}
        chapters={chaptersWithContent}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowChapterPlaylist(false)}
        onSelectChapter={navigateToChapterIndex}
      />

      {/* Audio Player Bar */}
      {book && (
        <AudioPlayerBar
          bookId={book.id}
          themeColors={themeColors}
          onChapterPlaylist={() => setShowChapterPlaylist(true)}
          onPlay={playerPlay}
          onPause={playerPause}
          onSeek={(time) => {
            // Map global time to segment-local time for seeking
            if (currentSegment) {
              const localTime = time - currentSegment.start_time;
              playerSeekTo(Math.max(0, localTime));
            } else {
              playerSeekTo(time);
            }
          }}
          onSpeedChange={(speed) => {
            playerSetRate(speed);
            setStorePlaybackSpeed(speed);
          }}
          isPlaying={playerIsPlaying}
          currentTime={currentSegment ? currentSegment.start_time + playerTime : playerTime}
          duration={playerDuration}
          playbackRate={playbackRate}
          segmentsCount={bookSegments.length}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainer: {
    height: 3,
    width: '100%',
  },
  progressBarTrack: {
    height: '100%',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  tapArea: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: 20,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  tocItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tocItemText: {
    color: '#333',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultCount: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  searchResultItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  searchResultChapter: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchResultSnippet: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  searchNavButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchNavText: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptySearchText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 0.1,
  },
  emptySearchSubText: {
    fontSize: 14,
    marginTop: 6,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  bookmarkPageText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  bookmarkExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  bookmarkNote: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorCircleActive: {
    borderWidth: 2,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  noteActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  noteActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  highlightPreview: {
    padding: 12,
    borderLeftWidth: 3,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 12,
  },
  highlightPreviewText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  loadingChapters: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingChaptersText: {
    fontSize: 14,
    marginTop: 16,
    fontWeight: '500',
  },
  loadingProcessing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingProcessingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  loadingProcessingSubText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  loadingProcessingHint: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.7,
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    justifyContent: 'center',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  viewModeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});

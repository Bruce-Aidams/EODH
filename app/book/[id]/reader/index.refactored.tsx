import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/lib/notifications/toast';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioStore } from '@/stores/audioStore';
import { useCompleteAudioPlayer } from '@/lib/audio/player';
import { AudioSegment } from '@/types';

// Custom hooks
import { useReaderData } from '@/lib/reader/useReaderData';
import { useReaderActions } from '@/lib/reader/useReaderActions';

// Extracted components
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ChapterContent } from '@/components/reader/ChapterContent';
import { FontSettingsSheet } from '@/components/reader/FontSettingsSheet';
import { ReaderOverflowMenu } from '@/components/reader/ReaderOverflowMenu';
import { AudioPlayerBar } from '@/components/reader/AudioPlayerBar';
import { ChapterPlaylist } from '@/components/reader/ChapterPlaylist';
import { AISummaryPanel } from '@/components/reader/AISummaryPanel';
import { ReaderSearchModal } from '@/components/reader/ReaderSearchModal';
import { ReaderNoteModal } from '@/components/reader/ReaderNoteModal';
import { ReaderBookmarksModal } from '@/components/reader/ReaderBookmarksModal';
import { ReaderHighlightsModal } from '@/components/reader/ReaderHighlightsModal';
import { ReaderActionBar } from '@/components/reader/ReaderActionBar';
import PdfReader from '@/components/PdfReader';
import { ProgressBar } from '@/components/ProgressBar';

// Services
import { useAudioSync } from '@/lib/reader/AudioSyncService';
import { markdownHtmlStyles, markdownHtmlStylesDark } from '@/lib/markdown/renderer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReaderScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;
  const initialChapterId = params.chapterId as string | undefined;
  const initialSearchQuery = params.searchQuery as string | undefined;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const readingSettings = useSettingsStore((s) => s.readingSettings);
  const setReadingSettings = useSettingsStore((s) => s.setReadingSettings);
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Audio sync
  const { syncState, toggleAutoScroll } = useAudioSync();

  // Audio store actions
  const setBufferStatus = useAudioStore((s) => s.setBufferStatus);
  const resetAudio = useAudioStore((s) => s.reset);
  const setStorePlaybackSpeed = useAudioStore((s) => s.setPlaybackSpeed);

  // Data fetching hook
  const data = useReaderData(id, initialChapterId, initialSearchQuery);

  const scrollViewRef = useRef<Animated.ScrollView>(null);

  // Actions hook
  const actions = useReaderActions({
    bookId: id,
    bookTitle: data.book?.title,
    htmlContent: data.htmlContent,
    rawContent: data.rawContent,
    setHtmlContent: data.setHtmlContent,
    setRawContent: data.setRawContent,
    currentPage: data.currentPage,
    totalPages: data.totalPages,
    chaptersWithContent: data.chaptersWithContent,
    currentChapterIndex: data.currentChapterIndex,
    setCurrentChapterIndex: data.setCurrentChapterIndex,
    setLoadingChapters: (loading: boolean) => {
      // useReaderData manages this internally
    },
    fetchChapterContent: data.fetchChapterContent,
    bookSegments: data.bookSegments,
    setCurrentSegmentIndex: data.setCurrentSegmentIndex,
    readingSettings,
    scrollViewRef,
    onShowSuccess: showSuccess,
    onShowError: showError,
    onShowWarning: showWarning,
    onShowInfo: showInfo,
  });

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showChapterPlaylist, setShowChapterPlaylist] = useState(false);
  const [showAISummary, setShowAISummary] = useState(false);
  const [headerAutoHidden, setHeaderAutoHidden] = useState(false);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio player state
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const currentSegment = data.bookSegments[currentSegmentIndex] || null;
  const currentAudioUri = data.resolvedAudioUris[currentSegmentIndex] || currentSegment?.audio_url || null;

  // Use refs to avoid stale closures in callbacks
  const currentSegmentRef = useRef(currentSegment);
  const currentSegmentIndexRef = useRef(currentSegmentIndex);
  const bookSegmentsRef = useRef(data.bookSegments);
  currentSegmentRef.current = currentSegment;
  currentSegmentIndexRef.current = currentSegmentIndex;
  bookSegmentsRef.current = data.bookSegments;

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

  // Real audio player hook
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

  // Determine current segment index based on playback time
  const segmentCheckRef = useRef<number>(0);
  useEffect(() => {
    if (data.bookSegments.length === 0) return;
    const now = Date.now();
    if (now - segmentCheckRef.current < 500) return;
    segmentCheckRef.current = now;

    const { currentTime: storeTime } = useAudioStore.getState();
    for (let i = data.bookSegments.length - 1; i >= 0; i--) {
      if (storeTime >= data.bookSegments[i].start_time) {
        if (i !== currentSegmentIndex) {
          setCurrentSegmentIndex(i);
        }
        break;
      }
    }
  }, [playerTime, data.bookSegments, currentSegmentIndex]);

  // Fetch book on mount
  useEffect(() => {
    data.fetchBook(showInfo, showSuccess, showWarning);
    return () => {
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      playerPause();
      resetAudio();
    };
  }, [id]);

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

  // Scroll handler
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;

    const scrollPercent = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    const page = Math.max(1, Math.ceil(scrollPercent * data.totalPages));
    const pct = Math.min(100, scrollPercent * 100);

    data.setCurrentPage(page);
    data.setProgressPercent(pct);

    if (data.book) {
      data.updateReadingProgress({
        book_id: data.bookIdRef.current,
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
  }, [data.book, data.totalPages, data.updateReadingProgress, headerAutoHidden]);

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

  // Navigate to chapter
  const navigateToChapter = useCallback((index: number) => {
    if (data.chaptersWithContent.length > 0) {
      actions.navigateToChapterIndex(index);
    } else if (scrollViewRef.current && data.htmlContent) {
      (scrollViewRef.current as any).scrollTo({ y: 0, animated: true });
      setShowToc(false);
    }
  }, [data.chaptersWithContent.length, data.htmlContent]);

  // Overflow menu handlers
  const handleOverflowBookInfo = () => {
    setShowOverflowMenu(false);
    showInfo(`Book: ${data.book?.title || 'Unknown'}\nAuthor: ${data.book?.author || 'Unknown'}`);
  };

  const handleOverflowToc = () => {
    setShowOverflowMenu(false);
    setShowToc(true);
  };

  const handleOverflowSearch = () => {
    setShowOverflowMenu(false);
    actions.setShowSearch(true);
  };

  const handleOverflowBookmarks = () => {
    setShowOverflowMenu(false);
    setShowBookmarks(true);
  };

  const handleOverflowSettings = () => {
    setShowOverflowMenu(false);
    setShowSettings(true);
  };

  const handleOverflowShare = async () => {
    setShowOverflowMenu(false);
    try {
      await Share.share({
        message: `Reading "${data.book?.title || 'Unknown Book'}" on EODH App`,
        title: data.book?.title || 'EODH Book',
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
  if (data.loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
        {data.processingDocument ? (
          <View style={styles.loadingProcessing}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingProcessingText, { color: themeColors.text }]}>
              {data.processingMessage || 'Processing document...'}
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

  const estimatedReadingTime = data.estimatedReadingTime();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
      <StatusBar
        barStyle={(readingSettings.theme === 'dark' || readingSettings.theme === 'blue') ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <ReaderHeader
        bookTitle={data.book?.title || 'Reader'}
        currentPage={data.currentPage}
        totalPages={data.totalPages}
        estimatedReadingTime={estimatedReadingTime}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        showHeader={showHeader}
        chaptersCount={data.chapters.length}
        isBookmarked={actions.isPageBookmarked}
        onBack={() => router.back()}
        onToggleHeader={toggleHeader}
        onSearch={handleOverflowSearch}
        onTableOfContents={handleOverflowToc}
        onActions={toggleActions}
        onOverflowMenu={() => setShowOverflowMenu(true)}
        onSettings={handleOverflowSettings}
        onToggleBookmark={actions.handleBookmark}
      />

      {/* Progress Bar */}
      {data.book?.document_type !== 'pdf' && (
        <ProgressBar progress={data.progressPercent} height={3} />
      )}

      {/* Content */}
      <AnimatedView style={{ flex: 1 }} fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <TouchableOpacity style={styles.tapArea} onPress={toggleHeader} activeOpacity={1}>
          {data.book?.document_type === 'pdf' && data.viewMode === 'original' && (data.localDocumentUri || data.book.document_url) ? (
            <View style={{ flex: 1 }}>
              <PdfReader
                sourceUri={data.localDocumentUri || data.book.document_url || ''}
                onPageChange={(page, total) => {
                  data.setCurrentPage(page);
                  data.setTotalPages(total);
                  if (data.book) {
                    data.updateReadingProgress({
                      book_id: data.bookIdRef.current,
                      page_number: page,
                      progress_percent: Math.min(100, (page / total) * 100),
                    });
                  }
                }}
                onLoadComplete={(total) => data.setTotalPages(total)}
                onError={(err) => console.error('PDF error:', err)}
              />
            </View>
          ) : (
            <ChapterContent
              htmlContent={data.htmlContent}
              rawContent={data.rawContent}
              themeColors={themeColors}
              colors={{ primary: colors.primary }}
              readingSettings={readingSettings}
              contentWidth={contentWidth}
              htmlStyles={htmlStyles}
              loadingChapters={data.loadingChapters}
              processingDocument={data.processingDocument}
              processingMessage={data.processingMessage}
              scrollViewRef={scrollViewRef as any}
              onScroll={handleScroll}
            />
          )}
        </TouchableOpacity>
      </AnimatedView>

      {/* View Mode Toggle for PDF Books */}
      {data.book?.document_type === 'pdf' && (
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              data.viewMode === 'reflow' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => data.setViewMode('reflow')}
          >
            <Ionicons name="text" size={16} color={data.viewMode === 'reflow' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.viewModeButtonText, { color: data.viewMode === 'reflow' ? '#FFFFFF' : colors.primary }]}>
              Reflow
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              { backgroundColor: themeColors.background, borderColor: colors.border },
              data.viewMode === 'original' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => data.setViewMode('original')}
          >
            <Ionicons name="document-text" size={16} color={data.viewMode === 'original' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.viewModeButtonText, { color: data.viewMode === 'original' ? '#FFFFFF' : colors.primary }]}>
              Original PDF
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Bar */}
      {showActions && data.book && (
        <ReaderActionBar
          bookId={data.book.id}
          currentPage={data.currentPage}
          bookmarks={actions.bookmarks}
          themeColors={themeColors}
          colors={{ primary: colors.primary }}
          isBookmarked={actions.isPageBookmarked}
          onToggleBookmark={actions.handleBookmark}
          onHighlight={actions.handleHighlight}
          onNote={actions.openNoteModal}
          onClose={toggleActions}
        />
      )}

      {/* Note Modal */}
      <ReaderNoteModal
        visible={actions.showNoteModal}
        themeColors={themeColors}
        colors={{ primary: colors.primary }}
        selectedHighlight={actions.selectedHighlight}
        noteText={actions.noteText}
        setNoteText={actions.setNoteText}
        highlightNoteText={actions.highlightNoteText}
        setHighlightNoteText={actions.setHighlightNoteText}
        highlightColor={actions.highlightColor}
        setHighlightColor={actions.setHighlightColor}
        onClose={() => {
          actions.setShowNoteModal(false);
          actions.setNoteText('');
          actions.setHighlightNoteText('');
          actions.setSelectedHighlight(null);
        }}
        onSaveNote={actions.handleSaveNote}
        onSaveHighlight={actions.handleSaveHighlight}
        onSaveHighlightNote={actions.handleSaveHighlightNote}
      />

      {/* Table of Contents Modal */}
      <ReaderTocModal
        visible={showToc}
        chapters={data.chapters}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowToc(false)}
        onNavigateToChapter={navigateToChapter}
      />

      {/* Search Modal */}
      <ReaderSearchModal
        visible={actions.showSearch}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        searchQuery={actions.searchQuery}
        setSearchQuery={actions.setSearchQuery}
        searchResults={actions.searchResults}
        currentSearchIndex={actions.currentSearchIndex}
        isSearching={actions.isSearching}
        onClose={() => {
          actions.setShowSearch(false);
          actions.setSearchQuery('');
        }}
        onSearch={actions.handleSearch}
        onNavigateToResult={actions.navigateToSearchResult}
      />

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
        book={data.book}
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
        bookTitle={data.book?.title || ''}
        fullText={data.rawContent}
        onClose={() => setShowAISummary(false)}
      />

      {/* Highlights Modal */}
      <ReaderHighlightsModal
        visible={showHighlights}
        highlights={actions.bookHighlights}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowHighlights(false)}
        onRemoveHighlight={actions.handleRemoveHighlight}
        onAddNoteToHighlight={actions.handleAddNoteToHighlight}
      />

      {/* Bookmarks Modal */}
      <ReaderBookmarksModal
        visible={showBookmarks}
        bookmarks={actions.bookmarks}
        bookId={id}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowBookmarks(false)}
        onRemoveBookmark={actions.handleRemoveBookmark}
      />

      {/* Chapter Playlist */}
      <ChapterPlaylist
        visible={showChapterPlaylist}
        chapters={data.chaptersWithContent}
        themeColors={themeColors}
        colors={{ primary: colors.primary, border: colors.border }}
        onClose={() => setShowChapterPlaylist(false)}
        onSelectChapter={actions.navigateToChapterIndex}
      />

      {/* Audio Player Bar */}
      {data.book && (
        <AudioPlayerBar
          bookId={data.book.id}
          themeColors={themeColors}
          onChapterPlaylist={() => setShowChapterPlaylist(true)}
          onPlay={playerPlay}
          onPause={playerPause}
          onSeek={(time) => {
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
          segmentsCount={data.bookSegments.length}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * Table of Contents modal extracted from the reader.
 */
function ReaderTocModal({
  visible,
  chapters,
  themeColors,
  colors,
  onClose,
  onNavigateToChapter,
}: {
  visible: boolean;
  chapters: { id: string; title: string; level: number }[];
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string; border: string };
  onClose: () => void;
  onNavigateToChapter: (index: number) => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>Table of Contents</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={themeColors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ maxHeight: 400 }}>
          {chapters.map((chapter, index) => (
            <TouchableOpacity
              key={chapter.id}
              style={[
                styles.tocItem,
                { paddingLeft: chapter.level === 1 ? 0 : chapter.level === 2 ? SPACING.md : SPACING.lg },
              ]}
              onPress={() => onNavigateToChapter(index)}
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
        </View>
      </View>
    </View>
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
  tapArea: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  tocItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tocItemText: {
    color: '#333',
  },
  loadingProcessing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingProcessingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  loadingProcessingSubText: {
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  loadingProcessingHint: {
    fontSize: 12,
    marginTop: SPACING.xs,
    textAlign: 'center',
    opacity: 0.7,
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    justifyContent: 'center',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    gap: SPACING.xs,
  },
  viewModeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

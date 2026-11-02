import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useAudioStore } from '@/stores/audioStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Book, AudioSegment, AudioAlignment } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCompleteAudioPlayer } from '@/lib/audio/player';
import { useMediaControls } from '@/lib/audio/mediaControls';
import { syncEngine, SyncPosition, WordPosition } from '@/lib/sync/engine';
import { getAudioSegmentUri } from '@/lib/offline/fileManager';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Synchronized Read-Along Screen with real audio playback.
 * 
 * Integrates expo-audio playback with the sync engine to highlight
 * the currently spoken sentence as audio plays. Supports both
 * pre-recorded audio with alignment data and TTS-based sync.
 * 
 * Features:
 * - Real audio playback via expo-audio
 * - Sentence-level highlighting based on alignment data
 * - Auto-scroll to keep highlighted text visible
 * - Playback controls (play/pause, skip ±10s, speed)
 * - Reading settings (theme, font size)
 * - Fallback to TTS-based sync when no alignment data exists
 */
export default function SyncReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { updateListeningProgress, updateReadingProgress } = useLibraryStore();
  const { readingSettings } = useSettingsStore();
  const { audioSettings } = useSettingsStore();
  const {
    isPlaying: storeIsPlaying,
    isSyncing,
    highlightedText,
    currentPage,
    setBufferStatus,
    startSync,
    stopSync,
    updateSyncState,
    reset,
  } = useAudioStore();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [bookSegments, setBookSegments] = useState<AudioSegment[]>([]);
  const [resolvedAudioUris, setResolvedAudioUris] = useState<string[]>([]);
  const [bookAlignments, setBookAlignments] = useState<AudioAlignment[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentSyncPosition, setCurrentSyncPosition] = useState<SyncPosition | null>(null);
  const [currentWord, setCurrentWord] = useState<WordPosition | null>(null);
  const [useWordLevel, setUseWordLevel] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [globalTime, setGlobalTime] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const sentenceRefs = useRef<Array<TouchableOpacity | null>>([]);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bookIdRef = useRef<string>('');

  const bookId = Array.isArray(id) ? id[0] : id;

  // Calculate total duration from segments
  useEffect(() => {
    const total = bookSegments.reduce((sum, seg) => {
      return sum + (seg.end_time - seg.start_time);
    }, 0);
    setTotalDuration(total);
  }, [bookSegments]);

  // Determine current segment index based on global time
  const currentSegmentIndex = (() => {
    if (bookSegments.length === 0) return 0;
    for (let i = bookSegments.length - 1; i >= 0; i--) {
      if (globalTime >= bookSegments[i].start_time) {
        return i;
      }
    }
    return 0;
  })();

  const currentSegment = bookSegments[currentSegmentIndex] || null;
  const currentAudioUri = resolvedAudioUris[currentSegmentIndex] || currentSegment?.audio_url || null;

  // Real audio player — keyed on segment so it reloads when segment changes
  const {
    isPlaying,
    isLoaded,
    isBuffering,
    currentTime: playerTime,
    duration: playerDuration,
    play,
    pause,
    seekTo,
    setPlaybackRate,
    didJustFinish,
  } = useCompleteAudioPlayer(
    currentAudioUri,
    audioSettings.playbackSpeed,
    {
      onPositionChange: (time) => {
        if (currentSegment) {
          const newGlobalTime = currentSegment.start_time + time;
          setGlobalTime(newGlobalTime);
          
          // Update sync engine
          syncEngine.updateTime(newGlobalTime);
        }
      },
      onDurationChange: (dur) => {
        // Duration is for the current segment only
      },
      onBufferingChange: (buf) => {
        setBufferStatus(buf ? 'buffering' : 'ready');
      },
      onPlay: () => {
        useAudioStore.setState({ isPlaying: true });
      },
      onPause: () => {
        useAudioStore.setState({ isPlaying: false });
      },
      onPlaybackEnd: () => {
        // Auto-advance to next segment
        if (currentSegmentIndex < bookSegments.length - 1) {
          // Will be handled by segment index change
        } else {
          useAudioStore.setState({ isPlaying: false });
          stopSync();
        }
      },
    },
    currentSegmentIndex
  );

  // Sync store state with real player
  useEffect(() => {
    useAudioStore.setState({ isPlaying });
  }, [isPlaying]);

  // Initialize sync engine when alignments are loaded
  useEffect(() => {
    if (bookAlignments.length > 0) {
      syncEngine.initialize({
        alignments: bookAlignments,
        segments: bookSegments,
        fullText: content,
      });

      // Upgrade to word-level highlighting using estimated timings
      syncEngine.upgradeToWordLevel(audioSettings.playbackSpeed);
      setUseWordLevel(syncEngine.hasWordLevelData());

      // Set up sync callbacks
      syncEngine.setCallbacks({
        onPositionChange: (position) => {
          setCurrentSyncPosition(position);
          
          // Update audio store for highlighting
          const alignment: AudioAlignment = {
            id: position.segmentId,
            segment_id: position.segmentId,
            book_id: bookIdRef.current,
            chapter_id: null,
            text: position.text,
            start_time: position.startTime,
            end_time: position.endTime,
            page_number: position.pageNumber,
            text_offset_start: position.textOffsetStart,
            text_offset_end: position.textOffsetEnd,
            created_at: new Date().toISOString(),
          };
          updateSyncState(alignment, globalTime);
        },
      });
    }
  }, [bookAlignments, bookSegments, content]);

  // Update current word when global time changes and word-level is enabled
  useEffect(() => {
    if (!useWordLevel || !isPlaying) {
      setCurrentWord(null);
      return;
    }
    const word = syncEngine.findCurrentWord(globalTime);
    setCurrentWord(word);
  }, [globalTime, useWordLevel, isPlaying]);

  // Auto-scroll to keep highlighted text visible
  useEffect(() => {
    if (!isSyncing || !isPlaying || !currentSyncPosition) return;

    // Find the sentence index that matches the current sync position
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const searchText = currentSyncPosition.text.trim().substring(0, 50).toLowerCase();
    
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].toLowerCase().includes(searchText)) {
        // Scroll to this sentence
        if (autoScrollTimerRef.current) {
          clearTimeout(autoScrollTimerRef.current);
        }
        autoScrollTimerRef.current = setTimeout(() => {
          sentenceRefs.current[i]?.measureLayout(
            scrollViewRef.current?.getNode() as any,
            (x: number, y: number) => {
              const scrollY = y - 100; // Keep highlighted text near top
              scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
            },
            () => {}
          );
        }, 200);
        break;
      }
    }

    return () => {
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, [currentSyncPosition, isSyncing, isPlaying, content]);

  // Auto-save progress every 5 seconds
  useEffect(() => {
    if (!isPlaying || !book) return;

    const timer = setInterval(() => {
      const progressPercent = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;
      
      updateListeningProgress({
        book_id: bookIdRef.current,
        current_time: globalTime,
        progress_percent: Math.min(progressPercent, 100),
      });

      updateReadingProgress({
        book_id: bookIdRef.current,
        page_number: currentPage,
        progress_percent: Math.min(progressPercent, 100),
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isPlaying, book, bookIdRef.current, globalTime, currentPage, totalDuration, updateListeningProgress, updateReadingProgress]);

  // Fetch book data
  useEffect(() => {
    fetchBook();
    return () => {
      pause();
      stopSync();
      reset();
      syncEngine.stop();
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, [bookId]);

  const fetchBook = async () => {
    setLoading(true);
    try {
      const { data: bookData } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookData) {
        setBook(bookData);
        bookIdRef.current = bookId;

        // Fetch audio segments
        const { data: segmentsData } = await supabase
          .from('audio_segments')
          .select('*')
          .eq('book_id', bookId)
          .order('start_time', { ascending: true });

        if (segmentsData && segmentsData.length > 0) {
          setBookSegments(segmentsData);

          // Resolve audio URIs — check for locally downloaded files first
          const uris: string[] = [];
          for (let i = 0; i < segmentsData.length; i++) {
            const segment = segmentsData[i];
            const localUri = await getAudioSegmentUri(bookId, i + 1, segment.audio_url);
            uris.push(localUri || segment.audio_url || '');
          }
          setResolvedAudioUris(uris);
        }

        // Fetch alignments for sync
        const { data: alignData } = await supabase
          .from('audio_alignments')
          .select('*')
          .eq('book_id', bookId)
          .order('start_time', { ascending: true });

        if (alignData && alignData.length > 0) {
          setBookAlignments(alignData);
        }

        // Fetch document content
        if (bookData.document_type === 'markdown' && bookData.document_url) {
          try {
            const response = await fetch(bookData.document_url);
            const text = await response.text();
            setContent(text);
          } catch {
            setContent('Unable to load document content.');
          }
        } else if (bookData.document_type === 'pdf') {
          setContent(
            `"${bookData.title}" by ${bookData.author}\n\n` +
            `PDF content will be displayed here with synchronized highlighting.\n\n` +
            `The synchronized reader highlights the currently spoken text as audio plays.\n\n` +
            `Features:\n` +
            `• Sentence-level synchronization\n` +
            `• Automatic scrolling to keep highlighted text visible\n` +
            `• Tap to pause/resume\n` +
            `• Playback speed control\n` +
            `• Reading settings customization`
          );
        }
      }
    } catch {
      setContent('Book not found.');
    }
    setLoading(false);
  };

  // Handle segment changes — seek to start of new segment
  const lastSegmentIndexRef = useRef(0);
  useEffect(() => {
    if (currentSegmentIndex !== lastSegmentIndexRef.current) {
      lastSegmentIndexRef.current = currentSegmentIndex;
      // Player will auto-load new segment URI
    }
  }, [currentSegmentIndex]);

  const handlePlayPause = useCallback(() => {
    if (bookSegments.length === 0 && bookAlignments.length === 0) return;

    if (isPlaying) {
      pause();
      stopSync();
      syncEngine.stop();
    } else {
      startSync();
      syncEngine.start();
      play();
    }
  }, [isPlaying, play, pause, startSync, stopSync, bookSegments.length, bookAlignments.length]);

  const handleSeek = (value: number) => {
    if (bookSegments.length === 0) return;

    // Map global time to segment-local time
    let accumulatedTime = 0;
    for (const seg of bookSegments) {
      const segDuration = seg.end_time - seg.start_time;
      if (value >= accumulatedTime && value < accumulatedTime + segDuration) {
        const segIndex = bookSegments.indexOf(seg);
        const localTime = value - accumulatedTime;
        setGlobalTime(value);
        seekTo(localTime);
        return;
      }
      accumulatedTime += segDuration;
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = speeds.indexOf(audioSettings.playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    useSettingsStore.setState((s) => ({
      ...s,
      audioSettings: { ...s.audioSettings, playbackSpeed: nextSpeed },
    }));
  };

  const handleSkipForward = () => {
    const newTime = Math.min(globalTime + 10, totalDuration);
    handleSeek(newTime);
  };

  const handleSkipBackward = () => {
    const newTime = Math.max(globalTime - 10, 0);
    handleSeek(newTime);
  };

  // Lock-screen media controls and headphone integration
  useMediaControls({
    title: book?.title || 'Unknown',
    artist: book?.author || 'Unknown',
    album: 'EODH Audiobooks',
    isPlaying,
    onPlay: () => {
      if (bookSegments.length > 0 || bookAlignments.length > 0) handlePlayPause();
    },
    onPause: () => handlePlayPause(),
    onNext: handleSkipForward,
    onPrevious: handleSkipBackward,
    onSeek: (position) => handleSeek(position),
    onStop: () => {
      handlePlayPause();
      handleSeek(0);
    },
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getThemeColors = () => {
    switch (readingSettings.theme) {
      case 'dark':
        return { background: '#1a1a1a', text: '#e0e0e0', highlight: 'rgba(255, 201, 40, 0.3)' };
      case 'sepia':
        return { background: '#f4ecd8', text: '#5b4636', highlight: 'rgba(255, 201, 40, 0.2)' };
      default:
        return { background: '#FFFFFF', text: '#1a1a1a', highlight: 'rgba(255, 201, 40, 0.3)' };
    }
  };

  const themeColors = getThemeColors();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.royalPurple} />
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Ionicons name="sync-circle-outline" size={64} color={COLORS.gray300} />
        <Text style={styles.emptyTitle}>Sync Not Available</Text>
        <Text style={styles.emptySubtitle}>This book does not have synchronized audio content.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Split content into sentences for highlighting
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

  // Build a map of sentence text to current word for word-level highlighting
  const highlightedWordMap = useMemo(() => {
    if (!useWordLevel || !currentWord || !currentSyncPosition) return new Map<string, string>();
    return new Map([[currentSyncPosition.text.trim(), currentWord.word]]);
  }, [useWordLevel, currentWord, currentSyncPosition]);

  // Determine if sync is available
  const hasSyncData = bookAlignments.length > 0 || bookSegments.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={readingSettings.theme === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      {showControls && (
        <View style={[styles.header, { backgroundColor: themeColors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              {book.title}
            </Text>
            {isSyncing && (
              <View style={styles.syncBadge}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>Sync Active</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.pageIndicator, { color: themeColors.text }]}>
              Pg {currentPage}
            </Text>
            <TouchableOpacity onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content Area */}
      <TouchableOpacity
        style={styles.contentArea}
        onPress={() => setShowControls(!showControls)}
        activeOpacity={1}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: readingSettings.margins },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {sentences.map((sentence, index) => {
            const searchText = currentSyncPosition?.text.trim().substring(0, 50).toLowerCase() || '';
            const isHighlighted = sentence.toLowerCase().includes(searchText);
            const sentenceTrimmed = sentence.trim();
            
            // For word-level highlighting, split the sentence into words
            const renderSentenceContent = () => {
              if (!useWordLevel || !isHighlighted || !highlightedWordMap.has(sentenceTrimmed)) {
                return (
                  <Text
                    style={[
                      styles.sentence,
                      {
                        color: themeColors.text,
                        fontSize: readingSettings.fontSize,
                        lineHeight: readingSettings.fontSize * readingSettings.lineSpacing,
                        backgroundColor: isHighlighted ? themeColors.highlight : 'transparent',
                        borderRadius: 4,
                        paddingHorizontal: 2,
                      },
                    ]}
                  >
                    {sentence}{' '}
                  </Text>
                );
              }

              // Word-level highlighting
              const highlightedWord = highlightedWordMap.get(sentenceTrimmed)!;
              const words = sentence.split(/(\s+)/);
              
              return (
                <Text
                  style={[
                    styles.sentence,
                    {
                      color: themeColors.text,
                      fontSize: readingSettings.fontSize,
                      lineHeight: readingSettings.fontSize * readingSettings.lineSpacing,
                      backgroundColor: themeColors.highlight,
                      borderRadius: 4,
                      paddingHorizontal: 2,
                    },
                  ]}
                >
                  {words.map((word, wIndex) => {
                    const trimmedWord = word.trim();
                    if (!trimmedWord) return <Text key={`ws-${wIndex}`}>{word}</Text>;
                    
                    const isCurrentWord = trimmedWord === highlightedWord;
                    return (
                      <Text
                        key={`w-${wIndex}`}
                        style={{
                        color: isCurrentWord ? COLORS.gold : themeColors.text,
                        fontWeight: isCurrentWord ? '700' : '400',
                        fontSize: readingSettings.fontSize,
                      }}
                      >
                        {word}
                      </Text>
                    );
                  })}
                </Text>
              );
            };
            
            return (
              <TouchableOpacity
                key={index}
                ref={(ref) => {
                  sentenceRefs.current[index] = ref;
                }}
              >
                {renderSentenceContent()}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </TouchableOpacity>

      {/* Bottom Controls */}
      {showControls && (
        <View style={[styles.bottomControls, { backgroundColor: themeColors.background }]}>
          {/* Progress Bar */}
          <View style={styles.progressRow}>
            <Text style={[styles.timeText, { color: themeColors.text }]}>
              {formatTime(globalTime)}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0}%`,
                    backgroundColor: COLORS.gold,
                  },
                ]}
              />
            </View>
            <Text style={[styles.timeText, { color: themeColors.text }]}>
              {formatTime(totalDuration)}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handleSpeedChange}>
              <Text style={[styles.speedText, { color: themeColors.text }]}>
                {audioSettings.playbackSpeed}x
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipBackward}>
              <Ionicons
                name="play-skip-back"
                size={28}
                color={themeColors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
              disabled={!hasSyncData}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={56}
                color={!hasSyncData ? COLORS.gray400 : COLORS.gold}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipForward}>
              <Ionicons
                name="play-skip-forward"
                size={28}
                color={themeColors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity>
              <Ionicons name="time-outline" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Buffering Indicator */}
      {isBuffering && (
        <View style={styles.bufferContainer}>
          <ActivityIndicator size="small" color={COLORS.gold} />
          <Text style={styles.bufferText}>Buffering...</Text>
        </View>
      )}

      {/* No Sync Data Message */}
      {!hasSyncData && !loading && (
        <View style={styles.noSyncOverlay}>
          <Ionicons name="sync-outline" size={48} color={COLORS.gray400} />
          <Text style={styles.noSyncTitle}>Synchronization Pending</Text>
          <Text style={styles.noSyncSubtitle}>
            Synchronized reading requires audio alignment data. The administrator needs to upload
            timing files (SRT/WebVTT) or generate TTS alignment for this book.
          </Text>
          <Text style={styles.noSyncNote}>
            You can still read the book or listen to audio separately.
          </Text>
        </View>
      )}

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Reading Settings
              </Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            {/* Theme */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Theme</Text>
              <View style={styles.themeButtons}>
                {(['light', 'dark', 'sepia'] as const).map((theme) => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeButton,
                      readingSettings.theme === theme && styles.themeButtonActive,
                    ]}
                    onPress={() =>
                      useSettingsStore.getState().setReadingSettings({ theme })
                    }
                  >
                    <Text
                      style={[
                        styles.themeButtonText,
                        {
                          color:
                            theme === 'light' ? '#333' : theme === 'dark' ? '#fff' : '#5b4636',
                        },
                        readingSettings.theme === theme && styles.themeButtonTextActive,
                      ]}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Size</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity
                  onPress={() =>
                    useSettingsStore
                      .getState()
                      .setReadingSettings({
                        fontSize: Math.max(12, readingSettings.fontSize - 2),
                      })
                  }
                >
                  <Ionicons name="remove-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.fontSize}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    useSettingsStore
                      .getState()
                      .setReadingSettings({
                        fontSize: Math.min(32, readingSettings.fontSize + 2),
                      })
                  }
                >
                  <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray600,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  backButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.royalPurple,
    borderRadius: BORDER_RADIUS.md,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 4,
  },
  syncText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: SPACING.lg,
    minHeight: '100%',
  },
  sentence: {
    marginBottom: 4,
  },
  bottomControls: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    minWidth: 36,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  playButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noSyncOverlay: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  noSyncTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noSyncSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  noSyncNote: {
    fontSize: 12,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  settingRow: {
    marginBottom: SPACING.lg,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  themeButtonActive: {
    borderColor: COLORS.royalPurple,
    borderWidth: 2,
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  themeButtonTextActive: {
    color: COLORS.royalPurple,
    fontWeight: '600',
  },
  fontSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  fontSizeValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
});

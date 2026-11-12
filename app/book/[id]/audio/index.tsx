import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { supabase } from '@/lib/supabase/client';
import { useAudioStore } from '@/stores/audioStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Book, AudioSegment } from '@/types';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS, SHADOWS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useCompleteAudioPlayer } from '@/lib/audio/player';
import { useMediaControls } from '@/lib/audio/mediaControls';
import { useAudioQueue } from '@/lib/audio/queue';
import { getAudioSegmentUri } from '@/lib/offline/fileManager';
import { AnimatedView } from '@/components/AnimatedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Audio Player Screen with real expo-audio playback.
 *
 * Each audio segment (chapter) is played individually. When one segment
 * finishes, the player automatically advances to the next segment.
 * Progress is saved to Supabase every few seconds.
 */
export default function AudioPlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const updateListeningProgress = useLibraryStore((s) => s.updateListeningProgress);
  const audioSettings = useSettingsStore((s) => s.audioSettings);
  const storeTime = useAudioStore((s) => s.currentTime);
  const setBufferStatus = useAudioStore((s) => s.setBufferStatus);
  const setPlaybackSpeed = useAudioStore((s) => s.setPlaybackSpeed);
  const setSegments = useAudioStore((s) => s.setSegments);
  const reset = useAudioStore((s) => s.reset);

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookSegments, setBookSegments] = useState<AudioSegment[]>([]);
  const [resolvedAudioUris, setResolvedAudioUris] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');

  const bookId = Array.isArray(id) ? id[0] : id;

  // Build the current audio URI from the active segment (uses local file if available)
  const currentSegment = bookSegments[currentSegmentIndex] || null;
  const currentAudioUri = resolvedAudioUris[currentSegmentIndex] || currentSegment?.audio_url || null;

  // Calculate total duration from all segments
  useEffect(() => {
    const total = bookSegments.reduce((sum, seg) => {
      return sum + (seg.end_time - seg.start_time);
    }, 0);
    setTotalDuration(total);
  }, [bookSegments]);

  // Determine current segment index based on playback time — throttled to avoid rapid re-renders
  // Use refs to avoid depending on currentSegmentIndex which would cause infinite loops
  const segmentCheckRef = useRef<number>(0);
  const storeTimeRef = useRef(storeTime);
  storeTimeRef.current = storeTime;

  useEffect(() => {
    if (bookSegments.length === 0) return;
    const now = Date.now();
    if (now - segmentCheckRef.current < 500) return;
    segmentCheckRef.current = now;

    const time = storeTimeRef.current;
    for (let i = bookSegments.length - 1; i >= 0; i--) {
      if (time >= bookSegments[i].start_time) {
        setCurrentSegmentIndex(i);
        break;
      }
    }
  }, [storeTime, bookSegments]);

  // Stabilized refs for callbacks — initialized with no-ops, updated after the hook
  const currentSegmentRef = useRef(currentSegment);
  const currentSegmentIndexRef = useRef(currentSegmentIndex);
  const bookSegmentsRef = useRef(bookSegments);
  const repeatModeRef = useRef(repeatMode);
  const seekToRef = useRef((_: number) => {});
  const playRef = useRef(() => {});
  const pauseRef = useRef(() => {});

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
    const mode = repeatModeRef.current;
    if (mode === 'one') {
      seekToRef.current(0);
      playRef.current();
      return;
    }
    const idx = currentSegmentIndexRef.current;
    const segs = bookSegmentsRef.current;
    if (idx < segs.length - 1) {
      setCurrentSegmentIndex(idx + 1);
    } else {
      if (mode === 'all') {
        setCurrentSegmentIndex(0);
      } else {
        useAudioStore.setState({ isPlaying: false });
      }
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
    isPlaying,
    isLoaded,
    isBuffering,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seekTo,
    setPlaybackRate,
    didJustFinish,
  } = useCompleteAudioPlayer(
    currentAudioUri,
    audioSettings.playbackSpeed,
    audioCallbacks,
  );

  // Update refs after hook returns values
  currentSegmentRef.current = currentSegment;
  currentSegmentIndexRef.current = currentSegmentIndex;
  bookSegmentsRef.current = bookSegments;
  repeatModeRef.current = repeatMode;
  seekToRef.current = seekTo;
  playRef.current = play;
  pauseRef.current = pause;

  // Sync store state with real player state
  useEffect(() => {
    useAudioStore.setState({ isPlaying });
  }, [isPlaying]);

  useEffect(() => {
    if (currentSegment) {
      const globalTime = currentSegment.start_time + currentTime;
      useAudioStore.setState({ currentTime: globalTime });
    }
  }, [currentTime, currentSegment]);

  // Auto-save listening progress every 5 seconds
  const isPlayingRef = useRef(isPlaying);
  const bookRef = useRef(book);
  const currentTimeRef = useRef(currentTime);
  const currentSegmentForSaveRef = useRef(currentSegment);
  const totalDurationRef = useRef(totalDuration);
  const bookIdRef = useRef(bookId);
  const updateListeningProgressRef = useRef(updateListeningProgress);

  isPlayingRef.current = isPlaying;
  bookRef.current = book;
  currentTimeRef.current = currentTime;
  currentSegmentForSaveRef.current = currentSegment;
  totalDurationRef.current = totalDuration;
  bookIdRef.current = bookId;
  updateListeningProgressRef.current = updateListeningProgress;

  useEffect(() => {
    const timer = setInterval(() => {
      const playing = isPlayingRef.current;
      const bk = bookRef.current;
      if (!playing || !bk) return;

      const seg = currentSegmentForSaveRef.current;
      const time = currentTimeRef.current;
      const globalTime = seg ? seg.start_time + time : time;
      const dur = totalDurationRef.current;
      const progressPercent = dur > 0 ? (globalTime / dur) * 100 : 0;
      updateListeningProgressRef.current({
        book_id: bookIdRef.current,
        current_time: globalTime,
        progress_percent: Math.min(progressPercent, 100),
      });
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchBook();
    return () => {
      pause();
      reset();
    };
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Fetch audio segments
        const { data: segData } = await supabase
          .from('audio_segments')
          .select('*')
          .eq('book_id', bookId)
          .order('order_index', { ascending: true });

        if (segData && segData.length > 0) {
          setBookSegments(segData);
          setSegments(segData);

          // Resolve audio URIs — check for locally downloaded files first
          const uris: string[] = [];
          for (let i = 0; i < segData.length; i++) {
            const segment = segData[i];
            const localUri = await getAudioSegmentUri(bookId!, i + 1, segment.audio_url);
            uris.push(localUri || segment.audio_url || '');
          }
          setResolvedAudioUris(uris);
        }
      }
    } catch {
      // Book not found
    }
    setLoading(false);
  };

  const handlePlayPause = useCallback(() => {
    if (bookSegmentsRef.current.length === 0) return;
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handleSeek = useCallback((value: number) => {
    // Map global time to segment-local time
    const segs = bookSegmentsRef.current;
    if (segs.length === 0) return;

    // Find which segment this time falls in
    let accumulatedTime = 0;
    for (const seg of segs) {
      const segDuration = seg.end_time - seg.start_time;
      if (value >= accumulatedTime && value < accumulatedTime + segDuration) {
        const segIndex = segs.indexOf(seg);
        const localTime = value - accumulatedTime;
        setCurrentSegmentIndex(segIndex);
        seekToRef.current(localTime);
        return;
      }
      accumulatedTime += segDuration;
    }
    // If beyond all segments, seek to end of last segment
    setCurrentSegmentIndex(segs.length - 1);
    seekToRef.current(0);
  }, []);

  // Use a ref for playback speed to avoid recreating this callback on every speed change
  const audioSettingsRef = useRef(audioSettings);
  audioSettingsRef.current = audioSettings;

  const handleSpeedChange = useCallback(() => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentSpeed = audioSettingsRef.current.playbackSpeed;
    const currentIndex = speeds.indexOf(currentSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    setPlaybackSpeed(nextSpeed);
    useSettingsStore.setState((s) => ({
      ...s,
      audioSettings: { ...s.audioSettings, playbackSpeed: nextSpeed },
    }));
  }, [setPlaybackRate, setPlaybackSpeed]);

  const handleSkipForward = useCallback(() => {
    const segs = bookSegmentsRef.current;
    if (segs.length === 0) return;
    const seg = currentSegmentRef.current;
    const localTime = currentTimeRef.current;
    const globalTime = seg ? seg.start_time + localTime : localTime;
    const newTime = Math.min(globalTime + 10, totalDurationRef.current);
    handleSeek(newTime);
  }, [handleSeek]);

  const handleSkipBackward = useCallback(() => {
    const seg = currentSegmentRef.current;
    const localTime = currentTimeRef.current;
    const globalTime = seg ? seg.start_time + localTime : localTime;
    const newTime = Math.max(globalTime - 10, 0);
    handleSeek(newTime);
  }, [handleSeek]);

  // Shuffle toggle
  const handleShuffle = useCallback(() => {
    setIsShuffled(prev => !prev);
  }, []);

  // Cycle repeat mode: none -> all -> one -> none
  const handleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  }, []);

  // Lock-screen media controls and headphone integration
  // Memoize the options object to avoid unnecessary re-renders in the hook
  const mediaControlsOptions = useMemo(
    () => ({
      title: book?.title || 'Unknown',
      artist: book?.author || 'Unknown',
      album: 'EODH Audiobooks',
      isPlaying,
      onPlay: () => {
        if (bookSegmentsRef.current.length > 0) playRef.current();
      },
      onPause: () => pauseRef.current(),
      onNext: handleSkipForward,
      onPrevious: handleSkipBackward,
      onSeek: (position: number) => handleSeek(position),
      onStop: () => {
        pauseRef.current();
        seekToRef.current(0);
      },
    }),
    [book?.title, book?.author, isPlaying, handleSkipForward, handleSkipBackward, handleSeek],
  );
  useMediaControls(mediaControlsOptions);

  // Calculate global time for display
  const globalTime = currentSegment ? currentSegment.start_time + currentTime : currentTime;
  const displayDuration = totalDuration || duration;

  // Memoized formatTime to avoid recreating on every render
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={[styles.emptyContainer, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <Ionicons name="headset-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Audio Not Available</Text>
        <Text style={styles.emptySubtitle}>This book does not have audio content.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activeSegment = bookSegments[currentSegmentIndex] || null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Audio Player</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]} showsVerticalScrollIndicator={false}>
        {/* Book Cover */}
        <AnimatedView fadeDelay={100} fadeDuration={400} slideDirection="up" slideDistance={20}>
          <View style={styles.coverContainer}>
            {book.cover_url ? (
              <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <View style={styles.coverGradient} />
                <Ionicons name="musical-notes" size={64} color="#FFFFFF" />
              </View>
            )}
          </View>
        </AnimatedView>

        {/* Book Info */}
        <AnimatedView fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.infoSection}>
            <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
            <Text style={styles.author} numberOfLines={1}>{book.author}</Text>

            {activeSegment && (
              <View style={styles.segmentInfo}>
                <Text style={styles.segmentLabel}>Chapter {currentSegmentIndex + 1} of {bookSegments.length}</Text>
                <Text style={styles.segmentText} numberOfLines={2}>
                  {activeSegment.text.substring(0, 100)}
                  {activeSegment.text.length > 100 ? '...' : ''}
                </Text>
              </View>
            )}
          </View>
        </AnimatedView>

        {/* Progress */}
        <View style={styles.progressSection}>
          <Slider
            style={styles.slider}
            value={globalTime}
            minimumValue={0}
            maximumValue={displayDuration || 1}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onSlidingComplete={handleSeek}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(globalTime)}</Text>
            <Text style={styles.timeText}>{formatTime(displayDuration)}</Text>
          </View>
        </View>

        {/* Playback Controls */}
        <AnimatedView fadeDelay={300} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.controlsSection}>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handleShuffle} style={[styles.utilityButton, isShuffled && styles.utilityButtonActive]}>
              <Ionicons name="shuffle-outline" size={24} color={isShuffled ? colors.primary : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipBackward}>
              <Ionicons name="play-skip-back" size={32} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
              disabled={bookSegments.length === 0}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={64}
                color={bookSegments.length === 0 ? colors.textMuted : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipForward}>
              <Ionicons name="play-skip-forward" size={32} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRepeat} style={[styles.utilityButton, (repeatMode !== 'none') && styles.utilityButtonActive]}>
              {repeatMode === 'one' ? (
                <View style={styles.repeatOneContainer}>
                  <Ionicons name="repeat" size={24} color={colors.primary} />
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              ) : (
                <Ionicons name="repeat-outline" size={24} color={repeatMode === 'all' ? colors.primary : colors.text} />
              )}
            </TouchableOpacity>
          </View>

          {/* Secondary Controls Row */}
          <View style={styles.secondaryControlsRow}>
            <TouchableOpacity onPress={handleSpeedChange} style={styles.speedButton}>
              <Text style={styles.speedText}>{audioSettings.playbackSpeed}x</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sleepButton}>
              <Ionicons name="time-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        </AnimatedView>

        {/* Buffer Status */}
        {isBuffering && (
          <View style={styles.bufferContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.bufferText}>Buffering...</Text>
          </View>
        )}

        {/* Chapter List */}
        {bookSegments.length > 0 && (
          <AnimatedView fadeDelay={400} fadeDuration={400} slideDirection="up" slideDistance={15}>
            <View style={styles.chaptersSection}>
            <Text style={styles.sectionTitle}>Chapters</Text>
            {bookSegments.map((segment, index) => (
              <TouchableOpacity
                key={segment.id}
                style={[
                  styles.chapterItem,
                  index === currentSegmentIndex && styles.chapterItemActive,
                ]}
                onPress={() => {
                  setCurrentSegmentIndex(index);
                  // Seek to start of this segment
                  seekToRef.current(0);
                }}
              >
                <View style={styles.chapterNumber}>
                  <Text
                    style={[
                      styles.chapterNumberText,
                      index === currentSegmentIndex && styles.chapterNumberTextActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.chapterInfo}>
                  <Text
                    style={[
                      styles.chapterTitle,
                      index === currentSegmentIndex && styles.chapterTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {segment.text.substring(0, 60)}
                    {segment.text.length > 60 ? '...' : ''}
                  </Text>
                  <Text style={styles.chapterDuration}>
                    {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                  </Text>
                </View>
                {index === currentSegmentIndex && isPlaying && (
                  <Ionicons name="volume-high" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          </AnimatedView>
        )}

        {/* No Audio Message */}
        {bookSegments.length === 0 && (
          <View style={styles.noAudioContainer}>
            <Ionicons name="volume-mute-outline" size={48} color={colors.textMuted} />
            <Text style={styles.noAudioTitle}>No Audio Segments</Text>
            <Text style={styles.noAudioSubtitle}>
              Audio content will be available when the administrator uploads audiobook files.
            </Text>
          </View>
        )}
      </ScrollView>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  backButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    width: '80%',
    maxWidth: 220,
  },
  coverImage: {
    width: '100%',
    maxWidth: 220,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.cardHeavy,
  },
  coverPlaceholder: {
    width: '100%',
    maxWidth: 220,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.cardHeavy,
  },
  coverGradient: {
    ...StyleSheet.absoluteFill,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.xs,
    flexShrink: 1,
  },
  author: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    flexShrink: 1,
  },
  segmentInfo: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  segmentLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  segmentText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: SPACING.lg,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 12,
  },
  controlsSection: {
    marginBottom: SPACING.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  playButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sleepButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  utilityButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  utilityButtonActive: {
    backgroundColor: 'rgba(255, 201, 40, 0.15)',
  },
  repeatOneContainer: {
    position: 'relative',
    width: 24,
    height: 24,
  },
  repeatOneText: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    fontSize: 10,
    fontWeight: 'bold',
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  bufferContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  bufferText: {
    fontSize: 13,
  },
  chaptersSection: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  chapterItemActive: {
    backgroundColor: 'rgba(255, 201, 40, 0.1)',
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  chapterNumberText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chapterNumberTextActive: {
  },
  chapterInfo: {
    flex: 1,
    minWidth: 0,
  },
  chapterTitle: {
    fontSize: 14,
  },
  chapterTitleActive: {
    fontWeight: '500',
  },
  chapterDuration: {
    fontSize: 11,
    marginTop: 2,
  },
  noAudioContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  noAudioTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  noAudioSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    lineHeight: 18,
  },
});

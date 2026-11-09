import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { supabase } from '@/lib/supabase/client';
import { useAudioStore } from '@/stores/audioStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Book, AudioSegment, AudioAlignment, BookChapter } from '@/types';
import { SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMediaControls } from '@/lib/audio/mediaControls';
import { syncEngine, SyncPosition, WordPosition, SyncEngine } from '@/lib/sync/engine';
import { getAudioSegmentUri } from '@/lib/offline/fileManager';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ttsEngine } from '@/lib/tts/engine';
import { useCompleteAudioPlayer } from '@/lib/audio/player';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Strip HTML tags from a string to get plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|section|article|nav|header|footer)\b[^>]*>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Synchronized Read-Along Screen with TTS fallback.
 * 
 * Supports two modes:
 * 1. Pre-recorded audio with alignment data (full sync)
 * 2. TTS-based sync for any book without pre-recorded audio
 * 
 * Features:
 * - Sentence-level highlighting as audio/TTS plays
 * - Auto-scroll to keep highlighted text visible
 * - Word-level highlighting where available
 * - Playback controls (play/pause, skip ±1 sentence, speed)
 * - Reading settings (theme, font size)
 * - Works with all processed book formats (PDF, EPUB, DOCX, Markdown)
 */
export default function SyncReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { updateListeningProgress, updateReadingProgress } = useLibraryStore();
  const { readingSettings } = useSettingsStore();
  const { audioSettings } = useSettingsStore();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    isPlaying: storeIsPlaying,
    isSyncing,
    highlightedText,
    currentPage,
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
  
  // TTS mode state
  const [useTTS, setUseTTS] = useState(false);
  const [ttsCurrentSentenceIndex, setTtsCurrentSentenceIndex] = useState(-1);
  const [ttsEstimatedTimings, setTtsEstimatedTimings] = useState<AudioAlignment[]>([]);
  const [ttsIsPlaying, setTtsIsPlaying] = useState(false);

  const scrollViewRef = useRef<any>(null);
  const sentenceRefs = useRef<any[]>([]);
  const autoScrollTimerRef = useRef<number | null>(null);
  const bookIdRef = useRef<string>('');

  const bookId = Array.isArray(id) ? id[0] : id;

  // Calculate total duration from segments (audio mode) or estimated timings (TTS mode)
  useEffect(() => {
    if (bookSegments.length > 0) {
      const total = bookSegments.reduce((sum, seg) => {
        return sum + (seg.end_time - seg.start_time);
      }, 0);
      setTotalDuration(total);
    } else if (ttsEstimatedTimings.length > 0) {
      const last = ttsEstimatedTimings[ttsEstimatedTimings.length - 1];
      setTotalDuration(last.end_time);
    }
  }, [bookSegments, ttsEstimatedTimings]);

  // Determine current segment index based on global time (audio mode)
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
    isPlaying: audioIsPlaying,
    isLoaded,
    isBuffering,
    currentTime: playerTime,
    duration: playerDuration,
    play: audioPlay,
    pause: audioPause,
    seekTo: audioSeekTo,
    setPlaybackRate: audioSetPlaybackRate,
  } = useCompleteAudioPlayer(
    useTTS ? null : currentAudioUri,
    audioSettings.playbackSpeed,
    {
      onPositionChange: (time: number) => {
        if (currentSegment) {
          const newGlobalTime = currentSegment.start_time + time;
          setGlobalTime(newGlobalTime);
          syncEngine.updateTime(newGlobalTime);
        }
      },
      onDurationChange: () => {},
      onBufferingChange: () => {},
      onPlay: () => {
        useAudioStore.setState({ isPlaying: true });
      },
      onPause: () => {
        useAudioStore.setState({ isPlaying: false });
      },
      onPlaybackEnd: () => {
        if (currentSegmentIndex < bookSegments.length - 1) {
          // Will be handled by segment index change
        } else {
          useAudioStore.setState({ isPlaying: false });
          stopSync();
        }
      },
    } as any
  );

  // Sync store state with real player
  useEffect(() => {
    if (!useTTS) {
      useAudioStore.setState({ isPlaying: audioIsPlaying });
    }
  }, [audioIsPlaying, useTTS]);

  // Initialize sync engine when alignments are loaded (audio mode)
  useEffect(() => {
    if (!useTTS && bookAlignments.length > 0) {
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
            id: position.segmentId ?? undefined,
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
  }, [bookAlignments, bookSegments, content, useTTS]);

  // Initialize TTS-based sync when content is loaded and no audio data exists
  useEffect(() => {
    if (useTTS && content) {
      // Generate estimated timings for TTS
      const timings = SyncEngine.estimateTTSTimings(content, String(bookId), audioSettings.playbackSpeed);
      setTtsEstimatedTimings(timings);
      
      // Set up TTS callbacks
      ttsEngine.setOnChunkBegin((utterance) => {
        const searchText = utterance.trim().substring(0, 50).toLowerCase();
        const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        
        for (let i = 0; i < sentences.length; i++) {
          if (sentences[i].toLowerCase().includes(searchText)) {
            setTtsCurrentSentenceIndex(i);
            
            // Find the timing for this sentence
            const timing = timings[i];
            if (timing) {
              const position: SyncPosition = {
                segmentId: `tts-${i}`,
                text: sentences[i].trim(),
                pageNumber: null,
                textOffsetStart: null,
                textOffsetEnd: null,
                startTime: timing.start_time,
                endTime: timing.end_time,
              };
              setCurrentSyncPosition(position);
              
              // Update progress
              const progressPercent = totalDuration > 0 ? (timing.start_time / totalDuration) * 100 : 0;
              updateReadingProgress({
                book_id: bookIdRef.current,
                page_number: 1,
                progress_percent: Math.min(progressPercent, 100),
              });
              updateListeningProgress({
                book_id: bookIdRef.current,
                current_time: timing.start_time,
                progress_percent: Math.min(progressPercent, 100),
              });
            }
            break;
          }
        }
      });

      ttsEngine.setOnDone(() => {
        setTtsIsPlaying(false);
        useAudioStore.setState({ isPlaying: false });
        stopSync();
        setCurrentSyncPosition(null);
        setTtsCurrentSentenceIndex(-1);
      });
    }
  }, [content, useTTS, bookId]);


  // Auto-scroll to keep highlighted text visible
  useEffect(() => {
    if (!currentSyncPosition) return;

    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const searchText = currentSyncPosition.text.trim().substring(0, 50).toLowerCase();
    
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].toLowerCase().includes(searchText)) {
        if (autoScrollTimerRef.current) {
          clearTimeout(autoScrollTimerRef.current);
        }
        autoScrollTimerRef.current = setTimeout(() => {
          sentenceRefs.current[i]?.measureLayout(
            scrollViewRef.current?.getNode() as any,
            (x: number, y: number) => {
              const scrollY = y - 100;
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
  }, [currentSyncPosition, content]);

  // Fetch book data
  useEffect(() => {
    fetchBook();
    return () => {
      if (useTTS) {
        ttsEngine.stop();
      } else {
        audioPause();
      }
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
        bookIdRef.current = bookId!;

        // Fetch audio segments
        const { data: segmentsData } = await supabase
          .from('audio_segments')
          .select('*')
          .eq('book_id', bookId!)
          .order('start_time', { ascending: true });

        if (segmentsData && segmentsData.length > 0) {
          setBookSegments(segmentsData);

          // Resolve audio URIs
          const uris: string[] = [];
          for (let i = 0; i < segmentsData.length; i++) {
            const segment = segmentsData[i];
            const localUri = await getAudioSegmentUri(bookId!, i + 1, segment.audio_url);
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
          setUseTTS(false);
        } else {
          // No audio data — use TTS mode
          setUseTTS(true);
        }

        // Fetch document content from book_chapters (for all formats)
        const { data: chaptersData } = await supabase
          .from('book_chapters')
          .select('title, content, order_index')
          .eq('book_id', bookId!)
          .order('order_index', { ascending: true });

        if (chaptersData && chaptersData.length > 0) {
          // Combine all chapter contents into plain text
          let fullText = '';
          for (const chapter of chaptersData) {
            const plainText = stripHtml(chapter.content || '');
            if (plainText) {
              fullText += `\n\n${chapter.title}\n\n${plainText}`;
            }
          }
          setContent(fullText.trim());
        } else if (bookData.document_type === 'markdown' && bookData.document_url) {
          // Fallback: fetch Markdown directly
          try {
            const response = await fetch(bookData.document_url);
            const text = await response.text();
            setContent(text);
          } catch {
            setContent(`"${bookData.title}" by ${bookData.author}\n\nNo content available for this book.`);
          }
        } else {
          setContent(`"${bookData.title}" by ${bookData.author}\n\nNo content available for this book. The administrator needs to process this book for reflow reading.`);
        }
      }
    } catch {
      setContent('Book not found.');
    }
    setLoading(false);
  };

  // Determine if playing (audio or TTS)
  const isPlaying = useTTS ? ttsIsPlaying : audioIsPlaying;

  // Update current word when global time changes and word-level is enabled
  useEffect(() => {
    if (!useWordLevel || !isPlaying) {
      setCurrentWord(null);
      return;
    }
    const word = syncEngine.findCurrentWord(globalTime);
    setCurrentWord(word);
  }, [globalTime, useWordLevel, isPlaying]);

  const handlePlayPause = useCallback(() => {
    if (!content || content.startsWith('No content available')) return;

    if (isPlaying) {
      if (useTTS) {
        ttsEngine.pause();
        setTtsIsPlaying(false);
        stopSync();
      } else {
        audioPause();
        stopSync();
        syncEngine.stop();
      }
    } else {
      startSync();
      if (useTTS) {
        // Start TTS from current position
        const fromIndex = ttsCurrentSentenceIndex >= 0 ? ttsCurrentSentenceIndex + 1 : 0;
        ttsEngine.configure({ rate: audioSettings.playbackSpeed });
        ttsEngine.loadText(content);
        ttsEngine.speak(fromIndex);
        setTtsIsPlaying(true);
        syncEngine.start();
      } else {
        syncEngine.start();
        audioPlay();
      }
    }
  }, [isPlaying, useTTS, content, audioSettings.playbackSpeed, ttsCurrentSentenceIndex, startSync, stopSync, audioPlay, audioPause]);

  const handleSeek = (value: number) => {
    if (useTTS) {
      // For TTS, find the sentence at this time and seek to it
      const timing = ttsEstimatedTimings.find(t => value >= t.start_time && value < t.end_time);
      if (timing) {
        const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        const index = ttsEstimatedTimings.indexOf(timing);
        setTtsCurrentSentenceIndex(index);
        ttsEngine.stop();
        ttsEngine.loadText(content);
        ttsEngine.speak(index);
        setTtsIsPlaying(true);
      }
    } else if (bookSegments.length > 0) {
      // Audio mode: map global time to segment-local time
      let accumulatedTime = 0;
      for (const seg of bookSegments) {
        const segDuration = seg.end_time - seg.start_time;
        if (value >= accumulatedTime && value < accumulatedTime + segDuration) {
          const localTime = value - accumulatedTime;
          setGlobalTime(value);
          audioSeekTo(localTime);
          return;
        }
        accumulatedTime += segDuration;
      }
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = speeds.indexOf(audioSettings.playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    useSettingsStore.setState((s) => ({
      ...s,
      audioSettings: { ...s.audioSettings, playbackSpeed: nextSpeed },
    }));
    
    if (useTTS) {
      ttsEngine.configure({ rate: nextSpeed });
    } else {
      audioSetPlaybackRate(nextSpeed);
    }
  };

  const handleSkipForward = () => {
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    if (useTTS) {
      const nextIndex = Math.min(ttsCurrentSentenceIndex + 1, sentences.length - 1);
      setTtsCurrentSentenceIndex(nextIndex);
      ttsEngine.stop();
      ttsEngine.loadText(content);
      ttsEngine.speak(nextIndex);
    } else {
      const newTime = Math.min(globalTime + 10, totalDuration);
      handleSeek(newTime);
    }
  };

  const handleSkipBackward = () => {
    if (useTTS) {
      const prevIndex = Math.max(ttsCurrentSentenceIndex - 1, 0);
      setTtsCurrentSentenceIndex(prevIndex);
      ttsEngine.stop();
      ttsEngine.loadText(content);
      ttsEngine.speak(prevIndex);
    } else {
      const newTime = Math.max(globalTime - 10, 0);
      handleSeek(newTime);
    }
  };

  // Lock-screen media controls
  useMediaControls({
    title: book?.title || 'Unknown',
    artist: book?.author || 'Unknown',
    album: 'EODH Audiobooks',
    isPlaying,
    onPlay: () => handlePlayPause(),
    onPause: () => handlePlayPause(),
    onNext: handleSkipForward,
    onPrevious: handleSkipBackward,
    onSeek: (position) => handleSeek(position),
    onStop: () => {
      handlePlayPause();
      if (useTTS) {
        setTtsCurrentSentenceIndex(-1);
      }
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
      case 'system':
        return { background: isDark ? '#1a1a1a' : '#FFFFFF', text: isDark ? '#e0e0e0' : '#1a1a1a', highlight: 'rgba(255, 201, 40, 0.3)' };
      default:
        return { background: '#FFFFFF', text: '#1a1a1a', highlight: 'rgba(255, 201, 40, 0.3)' };
    }
  };

  const themeColors = getThemeColors();

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
        <Ionicons name="sync-circle-outline" size={64} color={colors.textMuted} />
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

  // Determine if content is available
  const hasContent = sentences.length > 0 && !content.startsWith('No content available');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['left', 'right']}>
      <StatusBar
        barStyle={readingSettings.theme === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      {showControls && (
        <AnimatedView fadeDelay={50} fadeDuration={300} slideDirection="down" slideDistance={20}>
          <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: colors.border, paddingTop: insets.top + SPACING.sm }]}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
                {book.title}
              </Text>
              {isSyncing && (
                <View style={styles.syncBadge}>
                  <View style={[styles.syncDot, { backgroundColor: useTTS ? '#4CAF50' : colors.primary }]} />
                  <Text style={[styles.syncText, { color: useTTS ? '#4CAF50' : colors.primary }]}>
                    {useTTS ? 'TTS Active' : 'Sync Active'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              {useTTS && (
                <Ionicons name="volume-high" size={18} color={themeColors.text} />
              )}
              <TouchableOpacity onPress={() => setShowSettings(true)}>
                <Ionicons name="settings-outline" size={22} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedView>
      )}

      {/* Content Area */}
      <AnimatedView style={{ flex: 1 }} fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={15}>
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
            { paddingHorizontal: readingSettings.margins, paddingBottom: insets.bottom + SPACING.xxl + 20 },
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
                          color: isCurrentWord ? colors.primary : themeColors.text,
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
                onPress={() => {
                  if (useTTS) {
                    // Tap to start TTS from this sentence
                    setTtsCurrentSentenceIndex(index);
                    ttsEngine.stop();
                    ttsEngine.loadText(content);
                    ttsEngine.speak(index);
                    setTtsIsPlaying(true);
                  }
                }}
              >
                {renderSentenceContent()}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </TouchableOpacity>
      </AnimatedView>

      {/* Bottom Controls */}
      {showControls && (
        <View style={[styles.bottomControls, { backgroundColor: themeColors.background, borderTopColor: colors.border }]}>
          {/* Progress Bar */}
          <View style={styles.progressRow}>
            <Text style={[styles.timeText, { color: themeColors.text }]}>
              {formatTime(useTTS ? (currentSyncPosition?.startTime || 0) : globalTime)}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${totalDuration > 0 ? ((useTTS ? (currentSyncPosition?.startTime || 0) : globalTime) / totalDuration) * 100 : 0}%`,
                    backgroundColor: useTTS ? '#4CAF50' : themeColors.highlight,
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
              disabled={!hasContent}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={56}
                color={!hasContent ? colors.textMuted : (useTTS ? '#4CAF50' : colors.primary)}
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
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.bufferText}>Buffering...</Text>
        </View>
      )}

      {/* No Content Message */}
      {!hasContent && !loading && (
        <View style={styles.noSyncOverlay}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={styles.noSyncTitle}>No Content Available</Text>
          <Text style={styles.noSyncSubtitle}>
            This book needs to be processed for read-along. The administrator can use the "Process All" button
            in the admin dashboard to extract and structure the content.
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
                {(['light', 'dark', 'system'] as const).map((theme) => (
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
                            theme === 'light' ? '#333' : theme === 'dark' ? '#fff' : '#6B7280',
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
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
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
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
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
    borderBottomWidth: 1,
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
    marginRight: 4,
    backgroundColor: '#4CAF50',
  },
  syncText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4CAF50',
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
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noSyncSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.sm,
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
    alignItems: 'center',
  },
  themeButtonActive: {
    borderWidth: 2,
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  themeButtonTextActive: {
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
  },
  bufferContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.sm,
  },
  bufferText: {
    fontSize: 13,
    minWidth: 40,
    textAlign: 'center',
  },
});

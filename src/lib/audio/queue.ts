import { useState, useCallback, useRef } from 'react';
import { AudioSegment } from '@/types';

/**
 * Audio Queue Manager for EODH
 *
 * Manages a queue of audio segments (chapters) for sequential playback.
 * Supports play, pause, skip next, skip previous, and queue reordering.
 * Automatically advances to the next segment when the current one ends.
 *
 * Features:
 * - Queue management (add, remove, clear, reorder)
 * - Sequential playback with auto-advance
 * - Shuffle mode
 * - Repeat mode (none, all, one)
 * - Queue position tracking
 * - Event callbacks for state changes
 *
 * Usage:
 * ```tsx
 * const queue = useAudioQueue();
 *
 * // Add segments to queue
 * queue.enqueueSegments(segments);
 *
 * // Play from queue
 * const current = queue.getCurrentSegment();
 * if (current) {
 *   playAudio(current.url);
 * }
 *
 * // Auto-advance on segment end
 * onPlaybackEnd={() => queue.playNext()};
 * ```
 */

export type RepeatMode = 'none' | 'all' | 'one';

export interface AudioQueueState {
  segments: AudioSegment[];
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  shuffledOrder: number[];
}

export interface AudioQueueCallbacks {
  onSegmentChange?: (segment: AudioSegment | null) => void;
  onQueueEmpty?: () => void;
  onIndexChange?: (index: number) => void;
}

export function useAudioQueue(callbacks?: AudioQueueCallbacks) {
  const [state, setState] = useState<AudioQueueState>({
    segments: [],
    currentIndex: -1,
    isShuffled: false,
    repeatMode: 'none',
    shuffledOrder: [],
  });

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Generate shuffled order using Fisher-Yates algorithm
  const generateShuffledOrder = useCallback((length: number): number[] => {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, []);

  // Get current segment from queue
  const getCurrentSegment = useCallback((): AudioSegment | null => {
    if (state.currentIndex < 0 || state.currentIndex >= state.segments.length) {
      return null;
    }
    
    const actualIndex = state.isShuffled
      ? state.shuffledOrder[state.currentIndex]
      : state.currentIndex;
    
    return state.segments[actualIndex] || null;
  }, [state]);

  // Enqueue segments (chapters)
  const enqueueSegments = useCallback((segments: AudioSegment[], startFromIndex: number = 0) => {
    setState(prev => {
      const newSegments = [...prev.segments, ...segments];
      const newIndex = prev.segments.length + startFromIndex;
      let newShuffledOrder = prev.shuffledOrder;

      if (prev.isShuffled) {
        newShuffledOrder = generateShuffledOrder(newSegments.length);
      }

      const newState = {
        ...prev,
        segments: newSegments,
        currentIndex: newIndex,
        shuffledOrder: newShuffledOrder,
      };

      // Notify callbacks
      const segment = newState.segments[
        newState.isShuffled ? newShuffledOrder[newIndex] : newIndex
      ];
      if (segment && callbacksRef.current?.onSegmentChange) {
        callbacksRef.current.onSegmentChange(segment);
      }
      if (callbacksRef.current?.onIndexChange) {
        callbacksRef.current.onIndexChange(newIndex);
      }

      return newState;
    });
  }, [generateShuffledOrder]);

  // Prepend segments (replace queue)
  const loadQueue = useCallback((segments: AudioSegment[], startIndex: number = 0) => {
    const newState = {
      segments,
      currentIndex: startIndex,
      isShuffled: false,
      repeatMode: 'none' as RepeatMode,
      shuffledOrder: [],
    };

    setState(newState);

    // Notify callbacks
    const segment = segments[startIndex] || null;
    if (segment && callbacksRef.current?.onSegmentChange) {
      callbacksRef.current.onSegmentChange(segment);
    }
    if (callbacksRef.current?.onIndexChange) {
      callbacksRef.current.onIndexChange(startIndex);
    }
  }, [generateShuffledOrder]);

  // Play next segment in queue
  const playNext = useCallback((): AudioSegment | null => {
    setState(prev => {
      if (prev.segments.length === 0) return prev;

      // If repeat one, stay on current
      if (prev.repeatMode === 'one') {
        const actualIndex = prev.isShuffled
          ? prev.shuffledOrder[prev.currentIndex]
          : prev.currentIndex;
        const segment = prev.segments[actualIndex];
        if (segment && callbacksRef.current?.onSegmentChange) {
          callbacksRef.current.onSegmentChange(segment);
        }
        return prev;
      }

      const nextIndex = prev.currentIndex + 1;

      // Check if we've reached the end
      if (nextIndex >= prev.segments.length) {
        if (prev.repeatMode === 'all') {
          // Loop back to beginning
          const actualIndex = prev.isShuffled ? prev.shuffledOrder[0] : 0;
          const segment = prev.segments[actualIndex];
          if (segment && callbacksRef.current?.onSegmentChange) {
            callbacksRef.current.onSegmentChange(segment);
          }
          if (callbacksRef.current?.onIndexChange) {
            callbacksRef.current.onIndexChange(0);
          }
          return { ...prev, currentIndex: 0 };
        } else {
          // Queue empty
          callbacksRef.current?.onQueueEmpty?.();
          return { ...prev, currentIndex: -1 };
        }
      }

      const actualIndex = prev.isShuffled ? prev.shuffledOrder[nextIndex] : nextIndex;
      const segment = prev.segments[actualIndex];
      if (segment && callbacksRef.current?.onSegmentChange) {
        callbacksRef.current.onSegmentChange(segment);
      }
      if (callbacksRef.current?.onIndexChange) {
        callbacksRef.current.onIndexChange(nextIndex);
      }

      return { ...prev, currentIndex: nextIndex };
    });

    return getCurrentSegment();
  }, [getCurrentSegment]);

  // Play previous segment
  const playPrevious = useCallback((): AudioSegment | null => {
    setState(prev => {
      if (prev.segments.length === 0) return prev;

      // If at beginning, go to end (or restart current)
      if (prev.currentIndex <= 0) {
        const actualIndex = prev.isShuffled ? prev.shuffledOrder[0] : 0;
        const segment = prev.segments[actualIndex];
        if (segment && callbacksRef.current?.onSegmentChange) {
          callbacksRef.current.onSegmentChange(segment);
        }
        if (callbacksRef.current?.onIndexChange) {
          callbacksRef.current.onIndexChange(0);
        }
        return { ...prev, currentIndex: 0 };
      }

      const prevIndex = prev.currentIndex - 1;
      const actualIndex = prev.isShuffled ? prev.shuffledOrder[prevIndex] : prevIndex;
      const segment = prev.segments[actualIndex];
      if (segment && callbacksRef.current?.onSegmentChange) {
        callbacksRef.current.onSegmentChange(segment);
      }
      if (callbacksRef.current?.onIndexChange) {
        callbacksRef.current.onIndexChange(prevIndex);
      }

      return { ...prev, currentIndex: prevIndex };
    });

    return getCurrentSegment();
  }, [getCurrentSegment]);

  // Jump to specific segment
  const jumpToIndex = useCallback((index: number) => {
    if (index < 0 || index >= state.segments.length) return;

    setState(prev => ({ ...prev, currentIndex: index }));

    const actualIndex = state.isShuffled ? state.shuffledOrder[index] : index;
    const segment = state.segments[actualIndex];
    if (segment && callbacksRef.current?.onSegmentChange) {
      callbacksRef.current.onSegmentChange(segment);
    }
    if (callbacksRef.current?.onIndexChange) {
      callbacksRef.current.onIndexChange(index);
    }
  }, [state]);

  // Toggle shuffle mode
  const toggleShuffle = useCallback(() => {
    setState(prev => {
      if (!prev.isShuffled) {
        const newOrder = generateShuffledOrder(prev.segments.length);
        return { ...prev, isShuffled: true, shuffledOrder: newOrder };
      } else {
        return { ...prev, isShuffled: false, shuffledOrder: [] };
      }
    });
  }, [generateShuffledOrder]);

  // Cycle repeat mode
  const cycleRepeatMode = useCallback(() => {
    setState(prev => {
      const modes: RepeatMode[] = ['none', 'all', 'one'];
      const currentIndex = modes.indexOf(prev.repeatMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      return { ...prev, repeatMode: nextMode };
    });
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setState({
      segments: [],
      currentIndex: -1,
      isShuffled: false,
      repeatMode: 'none',
      shuffledOrder: [],
    });
    callbacksRef.current?.onSegmentChange?.(null);
  }, []);

  // Remove segment from queue
  const removeSegment = useCallback((index: number) => {
    setState(prev => {
      const newSegments = prev.segments.filter((_, i) => i !== index);
      let newCurrentIndex = prev.currentIndex;

      if (index < prev.currentIndex) {
        newCurrentIndex = prev.currentIndex - 1;
      } else if (index === prev.currentIndex) {
        // Play next segment if current is removed
        newCurrentIndex = Math.min(prev.currentIndex, newSegments.length - 1);
      }

      if (newCurrentIndex < 0) {
        newCurrentIndex = -1;
      }

      const newShuffledOrder = prev.isShuffled
        ? generateShuffledOrder(newSegments.length)
        : [];

      return {
        ...prev,
        segments: newSegments,
        currentIndex: newCurrentIndex,
        shuffledOrder: newShuffledOrder,
      };
    });
  }, [generateShuffledOrder]);

  // Get queue progress
  const getProgress = useCallback((): { current: number; total: number; percent: number } => {
    const total = state.segments.length;
    const current = state.currentIndex + 1;
    const percent = total > 0 ? (current / total) * 100 : 0;
    return { current: Math.max(0, current), total, percent };
  }, [state]);

  return {
    state,
    getCurrentSegment,
    enqueueSegments,
    loadQueue,
    playNext,
    playPrevious,
    jumpToIndex,
    toggleShuffle,
    cycleRepeatMode,
    clearQueue,
    removeSegment,
    getProgress,
  };
}

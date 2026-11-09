import { useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

/**
 * Audio Player Engine for EODH
 *
 * Wraps expo-audio's useAudioPlayer hook to provide real audio playback
 * with position tracking, speed control, and segment-aware playback.
 *
 * Supports:
 * - Remote audio URLs (Supabase Storage signed/public URLs)
 * - Local file URIs (downloaded audiobooks)
 * - Playback speed control (0.5x to 2.0x)
 * - Seek forward/backward
 * - Auto-advance to next segment in playlist
 * - Position tracking for progress saving
 */

export interface AudioPlayerCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onPositionChange?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onBufferingChange?: (isBuffering: boolean) => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * React hook for a complete audio player with status tracking.
 * This is the primary hook used by audio player screens.
 *
 * Uses expo-audio's declarative useAudioPlayer hook which manages
 * the native audio session lifecycle automatically.
 */
export function useCompleteAudioPlayer(
  uri: string | null,
  initialRate: number = 1.0,
  callbacks: AudioPlayerCallbacks = {}
) {
  // Hooks MUST be called unconditionally (Rules of Hooks).
  // Pass null when no URI is available — the player handles null gracefully.
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  // Initialize playback rate
  useEffect(() => {
    if (player && uri) {
      player.playbackRate = initialRate;
    }
  }, [player, uri, initialRate]);

  // Track position changes via status
  const lastTimeRef = useRef<number>(0);
  useEffect(() => {
    if (status?.currentTime != null && status.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = status.currentTime;
      callbacks.onPositionChange?.(status.currentTime);
    }
  }, [status?.currentTime, callbacks]);

  // Track duration changes
  useEffect(() => {
    if (status?.duration != null && status.duration > 0) {
      callbacks.onDurationChange?.(status.duration);
    }
  }, [status?.duration, callbacks]);

  // Track buffering
  useEffect(() => {
    if (status?.isBuffering != null) {
      callbacks.onBufferingChange?.(status.isBuffering);
    }
  }, [status?.isBuffering, callbacks]);

  // Track playback end
  useEffect(() => {
    if (status?.didJustFinish) {
      callbacks.onPlaybackEnd?.();
    }
  }, [status?.didJustFinish, callbacks]);

  // Track errors
  useEffect(() => {
    if (status?.error) {
      callbacks.onError?.(status.error);
    }
  }, [status?.error, callbacks]);

  // Track playing state
  const lastPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    if (status?.playing != null) {
      if (status.playing && !lastPlayingRef.current) {
        callbacks.onPlay?.();
      } else if (!status.playing && lastPlayingRef.current) {
        callbacks.onPause?.();
      }
      lastPlayingRef.current = status.playing;
    }
  }, [status?.playing, callbacks]);

  const play = useCallback(() => {
    player?.play();
  }, [player]);

  const pause = useCallback(() => {
    player?.pause();
  }, [player]);

  const seekTo = useCallback(
    (time: number) => {
      player?.seekTo(time);
      callbacks.onSeek?.(time);
    },
    [player, callbacks]
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (player) {
        player.playbackRate = rate;
      }
    },
    [player]
  );

  return {
    player,
    status,
    isPlaying: status?.playing ?? false,
    isLoaded: status?.isLoaded ?? false,
    isBuffering: status?.isBuffering ?? false,
    currentTime: status?.currentTime ?? 0,
    duration: status?.duration ?? 0,
    playbackRate: status?.playbackRate ?? initialRate,
    error: status?.error ?? null,
    didJustFinish: status?.didJustFinish ?? false,
    play,
    pause,
    seekTo,
    setPlaybackRate,
  };
}

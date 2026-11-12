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
  // expo-audio has a known Android crash when passing null directly,
  // so we pass undefined instead.
  const player = useAudioPlayer(uri ? { uri } : undefined);
  const status = useAudioPlayerStatus(player);

  // Use a ref for callbacks to avoid re-running effects when callbacks change
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Initialize playback rate when the player is created with a URI
  // Also update when the initialRate changes (e.g., user changes speed)
  const initialRateRef = useRef(initialRate);
  initialRateRef.current = initialRate;
  useEffect(() => {
    if (player && uri) {
      player.setPlaybackRate(initialRateRef.current);
    }
  }, [player, uri]);

  // Update playback rate when initialRate changes while playing
  useEffect(() => {
    if (player) {
      player.setPlaybackRate(initialRate);
    }
  }, [player, initialRate]);

  // Track position changes via status
  const lastTimeRef = useRef<number>(0);
  useEffect(() => {
    if (status?.currentTime != null && status.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = status.currentTime;
      callbacksRef.current.onPositionChange?.(status.currentTime);
    }
  }, [status?.currentTime]);

  // Track duration changes
  useEffect(() => {
    if (status?.duration != null && status.duration > 0) {
      callbacksRef.current.onDurationChange?.(status.duration);
    }
  }, [status?.duration]);

  // Track buffering
  useEffect(() => {
    if (status?.isBuffering != null) {
      callbacksRef.current.onBufferingChange?.(status.isBuffering);
    }
  }, [status?.isBuffering]);

  // Track playback end
  useEffect(() => {
    if (status?.didJustFinish) {
      callbacksRef.current.onPlaybackEnd?.();
    }
  }, [status?.didJustFinish]);

  // Track errors
  useEffect(() => {
    if (status?.error) {
      callbacksRef.current.onError?.(status.error);
    }
  }, [status?.error]);

  // Track playing state
  const lastPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    if (status?.playing != null) {
      if (status.playing && !lastPlayingRef.current) {
        callbacksRef.current.onPlay?.();
      } else if (!status.playing && lastPlayingRef.current) {
        callbacksRef.current.onPause?.();
      }
      lastPlayingRef.current = status.playing;
    }
  }, [status?.playing]);

  const play = useCallback(() => {
    player?.play();
  }, [player]);

  const pause = useCallback(() => {
    player?.pause();
  }, [player]);

  const seekTo = useCallback(
    (time: number) => {
      player?.seekTo(time);
      callbacksRef.current.onSeek?.(time);
    },
    [player]
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (player) {
        player.setPlaybackRate(rate);
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

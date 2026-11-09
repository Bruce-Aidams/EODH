import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Media Controls for Lock Screen and Headphone Integration
 *
 * Provides lock-screen media controls and headphone button support
 * for Android audiobook playback.
 *
 * Note: expo-audio does not provide a setMediaControls API.
 * This module provides safe no-op stubs so the audio and sync
 * routes do not crash at startup. Media controls should be
 * implemented using a dedicated library (e.g., react-native-track-player)
 * when lock-screen controls are needed.
 *
 * Features (stubbed):
 * - Lock screen play/pause/skip controls (not implemented)
 * - Headphone button support (not implemented)
 *
 * Usage:
 * ```tsx
 * const mediaControls = useMediaControls({
 *   title: 'Book Title',
 *   artist: 'Author Name',
 *   isPlaying: true,
 *   onPlay: () => {},
 *   onPause: () => {},
 *   onNext: () => {},
 *   onPrevious: () => {},
 *   onSeek: (position) => {},
 * });
 * ```
 */

export interface MediaControlsOptions {
  title: string;
  artist: string;
  album?: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek?: (position: number) => void;
  onStop?: () => void;
}

export interface MediaControlsState {
  isActive: boolean;
  error: string | null;
}

/**
 * Hook for managing lock-screen media controls and headphone integration.
 *
 * Currently a safe no-op stub — expo-audio does not expose a media
 * controls API. Returns isActive: false to indicate controls are
 * not available.
 *
 * @param options - Media controls configuration (ignored)
 * @returns Media controls state with isActive: false
 */
export function useMediaControls(_options: MediaControlsOptions): MediaControlsState {
  const [state, setState] = useState<MediaControlsState>({
    isActive: false,
    error: null,
  });

  useEffect(() => {
    // Media controls are not available via expo-audio.
    // On web, skip entirely.
    if (Platform.OS === 'web') {
      return;
    }

    // No-op: expo-audio has no setMediaControls API.
    // To add real media controls, integrate a library like
    // react-native-track-player or expo-av's legacy media controls.
    setState({ isActive: false, error: null });
  }, []);

  return state;
}

/**
 * Hook for managing headphone button events.
 *
 * Currently a safe no-op stub — headphone controls require a
 * dedicated media session library.
 *
 * @param handlers - Event handlers for headphone buttons (ignored)
 */
export function useHeadphoneControls(_handlers: {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  useEffect(() => {
    // No-op: headphone controls require a dedicated media session library.
    return () => {
      // Cleanup if needed
    };
  }, []);
}

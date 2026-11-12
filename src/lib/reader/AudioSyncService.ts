import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/stores/audioStore';
import { AudioAlignment } from '@/types';

interface AudioSyncServiceState {
  currentAlignment: AudioAlignment | null;
  highlightedText: string;
  currentPage: number;
  autoScroll: boolean;
}

class AudioSyncService {
  private alignments: AudioAlignment[] = [];
  private onSyncUpdate: ((state: AudioSyncServiceState) => void) | null = null;
  private currentState: AudioSyncServiceState = {
    currentAlignment: null,
    highlightedText: '',
    currentPage: 1,
    autoScroll: true,
  };

  // Set alignments data from audio store
  setAlignments(alignments: AudioAlignment[]): void {
    this.alignments = alignments;
  }

  // Register callback for sync updates
  setSyncCallback(callback: (state: AudioSyncServiceState) => void): void {
    this.onSyncUpdate = callback;
  }

  // Find the current alignment based on audio playback time
  findCurrentAlignment(currentTime: number): AudioAlignment | null {
    if (this.alignments.length === 0) return null;

    for (let i = 0; i < this.alignments.length; i++) {
      const alignment = this.alignments[i];
      if (currentTime >= alignment.start_time && currentTime <= alignment.end_time) {
        return alignment;
      }
    }

    // If not found, return the last alignment before current time
    let lastBefore: AudioAlignment | null = null;
    for (const alignment of this.alignments) {
      if (alignment.start_time <= currentTime) {
        lastBefore = alignment;
      } else {
        break;
      }
    }
    return lastBefore;
  }

  // Update sync state based on current audio time
  updateSync(currentTime: number, currentPage: number): void {
    const alignment = this.findCurrentAlignment(currentTime);
    if (alignment) {
      this.currentState = {
        currentAlignment: alignment,
        highlightedText: alignment.text,
        currentPage: alignment.page_number || currentPage,
        autoScroll: this.currentState.autoScroll,
      };
    } else {
      this.currentState = {
        currentAlignment: null,
        highlightedText: '',
        currentPage,
        autoScroll: this.currentState.autoScroll,
      };
    }

    this.onSyncUpdate?.(this.currentState);
  }

  // Toggle auto-scroll
  toggleAutoScroll(): boolean {
    this.currentState.autoScroll = !this.currentState.autoScroll;
    return this.currentState.autoScroll;
  }

  // Set auto-scroll
  setAutoScroll(enabled: boolean): void {
    this.currentState.autoScroll = enabled;
  }

  // Get current state
  getState(): AudioSyncServiceState {
    return this.currentState;
  }

  // Reset state
  reset(): void {
    this.currentState = {
      currentAlignment: null,
      highlightedText: '',
      currentPage: 1,
      autoScroll: true,
    };
  }
}

// Export singleton instance
export const audioSyncService = new AudioSyncService();

// React hook for using the audio sync service
export function useAudioSync() {
  const currentTime = useAudioStore((s) => s.currentTime);
  const alignments = useAudioStore((s) => s.alignments);
  const stateRef = useRef<AudioSyncServiceState>({
    currentAlignment: null,
    highlightedText: '',
    currentPage: 1,
    autoScroll: true,
  });

  // Update alignments when they change
  useEffect(() => {
    audioSyncService.setAlignments(alignments);
  }, [alignments]);

  // Register sync callback
  useEffect(() => {
    audioSyncService.setSyncCallback((state) => {
      stateRef.current = state;
    });
  }, []);

  // Update sync on audio time change
  useEffect(() => {
    if (currentTime > 0) {
      audioSyncService.updateSync(currentTime, stateRef.current.currentPage);
    }
  }, [currentTime]);

  const toggleAutoScroll = useCallback(() => {
    const enabled = audioSyncService.toggleAutoScroll();
    stateRef.current.autoScroll = enabled;
    return enabled;
  }, []);

  const setAutoScroll = useCallback((enabled: boolean) => {
    audioSyncService.setAutoScroll(enabled);
    stateRef.current.autoScroll = enabled;
  }, []);

  return {
    syncState: stateRef.current,
    toggleAutoScroll,
    setAutoScroll,
  };
}


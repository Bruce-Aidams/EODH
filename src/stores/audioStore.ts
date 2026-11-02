import { create } from 'zustand';
import { AudioSegment, AudioAlignment, SyncState } from '@/types';

interface AudioStoreState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  currentBookId: string | null;
  currentChapterId: string | null;
  currentSegment: AudioSegment | null;
  currentAlignment: AudioAlignment | null;
  segments: AudioSegment[];
  alignments: AudioAlignment[];
  bufferStatus: 'buffering' | 'ready' | 'ended';
  sleepTimer: number | null;
  sleepTimerRemaining: number | null;
  
  // Sync state
  isSyncing: boolean;
  highlightedText: string;
  currentPage: number;
  autoScroll: boolean;
  
  // Actions
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setCurrentBook: (bookId: string) => void;
  setSegments: (segments: AudioSegment[]) => void;
  setAlignments: (alignments: AudioAlignment[]) => void;
  setCurrentSegment: (segment: AudioSegment | null) => void;
  setCurrentAlignment: (alignment: AudioAlignment | null) => void;
  setBufferStatus: (status: 'buffering' | 'ready' | 'ended') => void;
  setSleepTimer: (minutes: number | null) => void;
  setSleepTimerRemaining: (seconds: number | null) => void;
  
  // Sync actions
  startSync: () => void;
  stopSync: () => void;
  setHighlightedText: (text: string) => void;
  setCurrentPage: (page: number) => void;
  setAutoScroll: (enabled: boolean) => void;
  updateSyncState: (alignment: AudioAlignment | null, currentTime: number) => void;
  reset: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackSpeed: 1.0,
  currentBookId: null,
  currentChapterId: null,
  currentSegment: null,
  currentAlignment: null,
  segments: [],
  alignments: [],
  bufferStatus: 'ready',
  sleepTimer: null,
  sleepTimerRemaining: null,
  
  isSyncing: false,
  highlightedText: '',
  currentPage: 1,
  autoScroll: true,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  
  seek: (time: number) => {
    const { alignments } = get();
    const alignment = alignments.find(
      a => a.start_time <= time && a.end_time >= time
    );
    
    set({
      currentTime: time,
      currentAlignment: alignment || null,
      highlightedText: alignment?.text || '',
      currentPage: alignment?.page_number || get().currentPage,
    });
  },
  
  setPlaybackSpeed: (speed: number) => {
    if (PLAYBACK_SPEEDS.includes(speed)) {
      set({ playbackSpeed: speed });
    }
  },
  
  setCurrentBook: (bookId: string) => set({ currentBookId: bookId }),
  setSegments: (segments: AudioSegment[]) => set({ segments }),
  setAlignments: (alignments: AudioAlignment[]) => set({ alignments }),
  setCurrentSegment: (segment: AudioSegment | null) => set({ currentSegment: segment }),
  setCurrentAlignment: (alignment: AudioAlignment | null) => set({ currentAlignment: alignment }),
  setBufferStatus: (status: 'buffering' | 'ready' | 'ended') => set({ bufferStatus: status }),
  
  setSleepTimer: (minutes: number | null) => {
    set({ 
      sleepTimer: minutes,
      sleepTimerRemaining: minutes ? minutes * 60 : null,
    });
  },
  setSleepTimerRemaining: (seconds: number | null) => set({ sleepTimerRemaining: seconds }),
  
  startSync: () => set({ isSyncing: true }),
  stopSync: () => set({ isSyncing: false, highlightedText: '' }),
  
  setHighlightedText: (text: string) => set({ highlightedText: text }),
  setCurrentPage: (page: number) => set({ currentPage: page }),
  setAutoScroll: (enabled: boolean) => set({ autoScroll: enabled }),
  
  updateSyncState: (alignment: AudioAlignment | null, currentTime: number) => {
    if (!get().isSyncing) return;
    
    set({
      currentTime,
      currentAlignment: alignment,
      highlightedText: alignment?.text || '',
      currentPage: alignment?.page_number || get().currentPage,
    });
  },
  
  reset: () => set({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentBookId: null,
    currentChapterId: null,
    currentSegment: null,
    currentAlignment: null,
    segments: [],
    alignments: [],
    bufferStatus: 'ready',
    sleepTimer: null,
    sleepTimerRemaining: null,
    isSyncing: false,
    highlightedText: '',
    currentPage: 1,
  }),
}));

import { useAudioStore } from '@/stores/audioStore';
import { AudioAlignment } from '@/types';

describe('AudioStore', () => {
  beforeEach(() => {
    useAudioStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useAudioStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.playbackSpeed).toBe(1.0);
      expect(state.currentBookId).toBeNull();
      expect(state.isSyncing).toBe(false);
      expect(state.highlightedText).toBe('');
      expect(state.currentPage).toBe(1);
      expect(state.autoScroll).toBe(true);
      expect(state.bufferStatus).toBe('ready');
    });
  });

  describe('play and pause', () => {
    it('sets isPlaying to true when play is called', () => {
      useAudioStore.getState().play();
      expect(useAudioStore.getState().isPlaying).toBe(true);
    });

    it('sets isPlaying to false when pause is called', () => {
      useAudioStore.getState().play();
      useAudioStore.getState().pause();
      expect(useAudioStore.getState().isPlaying).toBe(false);
    });
  });

  describe('seek', () => {
    it('updates current time', () => {
      useAudioStore.getState().seek(30);
      expect(useAudioStore.getState().currentTime).toBe(30);
    });

    it('finds alignment for the given time', () => {
      const alignments: AudioAlignment[] = [
        {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'First segment.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 14,
          created_at: new Date().toISOString(),
        },
        {
          id: undefined,
          segment_id: 'seg-2',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Second segment.',
          start_time: 10,
          end_time: 20,
          page_number: 2,
          text_offset_start: 14,
          text_offset_end: 30,
          created_at: new Date().toISOString(),
        },
      ];

      useAudioStore.getState().setAlignments(alignments);
      useAudioStore.getState().seek(5);

      const state = useAudioStore.getState();
      expect(state.currentTime).toBe(5);
      expect(state.currentAlignment?.segment_id).toBe('seg-1');
      expect(state.highlightedText).toBe('First segment.');
      expect(state.currentPage).toBe(1);
    });

    it('handles seek with no alignments', () => {
      useAudioStore.getState().seek(15);
      const state = useAudioStore.getState();
      expect(state.currentTime).toBe(15);
      expect(state.currentAlignment).toBeNull();
      expect(state.highlightedText).toBe('');
    });
  });

  describe('setPlaybackSpeed', () => {
    it('sets valid playback speed', () => {
      useAudioStore.getState().setPlaybackSpeed(1.5);
      expect(useAudioStore.getState().playbackSpeed).toBe(1.5);
    });

    it('ignores invalid playback speed', () => {
      useAudioStore.getState().setPlaybackSpeed(3.0);
      // setPlaybackSpeed only accepts predefined speeds, so 3.0 is ignored
      expect(useAudioStore.getState().playbackSpeed).not.toBe(3.0);
    });

    it('accepts all predefined speeds', () => {
      const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
      speeds.forEach((speed) => {
        useAudioStore.getState().setPlaybackSpeed(speed);
        expect(useAudioStore.getState().playbackSpeed).toBe(speed);
      });
    });
  });

  describe('setCurrentBook', () => {
    it('sets the current book ID', () => {
      useAudioStore.getState().setCurrentBook('book-123');
      expect(useAudioStore.getState().currentBookId).toBe('book-123');
    });
  });

  describe('setSegments', () => {
    it('sets audio segments', () => {
      const segments = [
        {
          id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'First segment.',
          audio_url: 'http://example.com/1.mp3',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          order_index: 1,
          created_at: new Date().toISOString(),
        },
      ];

      useAudioStore.getState().setSegments(segments);
      expect(useAudioStore.getState().segments).toHaveLength(1);
    });
  });

  describe('setAlignments', () => {
    it('sets audio alignments', () => {
      const alignments: AudioAlignment[] = [
        {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 5,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        },
      ];

      useAudioStore.getState().setAlignments(alignments);
      expect(useAudioStore.getState().alignments).toHaveLength(1);
    });
  });

  describe('setBufferStatus', () => {
    it('sets buffer status', () => {
      useAudioStore.getState().setBufferStatus('buffering');
      expect(useAudioStore.getState().bufferStatus).toBe('buffering');

      useAudioStore.getState().setBufferStatus('ready');
      expect(useAudioStore.getState().bufferStatus).toBe('ready');

      useAudioStore.getState().setBufferStatus('ended');
      expect(useAudioStore.getState().bufferStatus).toBe('ended');
    });
  });

  describe('sleep timer', () => {
    it('sets sleep timer and remaining seconds', () => {
      useAudioStore.getState().setSleepTimer(10);
      const state = useAudioStore.getState();
      expect(state.sleepTimer).toBe(10);
      expect(state.sleepTimerRemaining).toBe(600);
    });

    it('clears sleep timer when set to null', () => {
      useAudioStore.getState().setSleepTimer(10);
      useAudioStore.getState().setSleepTimer(null);
      const state = useAudioStore.getState();
      expect(state.sleepTimer).toBeNull();
      expect(state.sleepTimerRemaining).toBeNull();
    });

    it('sets remaining seconds directly', () => {
      useAudioStore.getState().setSleepTimerRemaining(300);
      expect(useAudioStore.getState().sleepTimerRemaining).toBe(300);
    });
  });

  describe('sync actions', () => {
    describe('startSync', () => {
      it('sets isSyncing to true', () => {
        useAudioStore.getState().startSync();
        expect(useAudioStore.getState().isSyncing).toBe(true);
      });
    });

    describe('stopSync', () => {
      it('sets isSyncing to false and clears highlighted text', () => {
        useAudioStore.getState().startSync();
        useAudioStore.getState().setHighlightedText('Some text');
        useAudioStore.getState().stopSync();

        const state = useAudioStore.getState();
        expect(state.isSyncing).toBe(false);
        expect(state.highlightedText).toBe('');
      });
    });

    describe('setHighlightedText', () => {
      it('sets the highlighted text', () => {
        useAudioStore.getState().setHighlightedText('Highlighted sentence.');
        expect(useAudioStore.getState().highlightedText).toBe('Highlighted sentence.');
      });
    });

    describe('setCurrentPage', () => {
      it('sets the current page', () => {
        useAudioStore.getState().setCurrentPage(5);
        expect(useAudioStore.getState().currentPage).toBe(5);
      });
    });

    describe('setAutoScroll', () => {
      it('toggles auto scroll', () => {
        useAudioStore.getState().setAutoScroll(false);
        expect(useAudioStore.getState().autoScroll).toBe(false);

        useAudioStore.getState().setAutoScroll(true);
        expect(useAudioStore.getState().autoScroll).toBe(true);
      });
    });

    describe('updateSyncState', () => {
      it('updates sync state when syncing', () => {
        const alignment: AudioAlignment = {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 5,
          page_number: 2,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        };

        useAudioStore.getState().startSync();
        useAudioStore.getState().updateSyncState(alignment, 3);

        const state = useAudioStore.getState();
        expect(state.currentTime).toBe(3);
        expect(state.currentAlignment?.segment_id).toBe('seg-1');
        expect(state.highlightedText).toBe('Hello world.');
        expect(state.currentPage).toBe(2);
      });

      it('does not update when not syncing', () => {
        const alignment: AudioAlignment = {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 5,
          page_number: 2,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        };

        useAudioStore.getState().updateSyncState(alignment, 3);
        const state = useAudioStore.getState();
        expect(state.currentTime).toBe(0);
        expect(state.highlightedText).toBe('');
      });
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useAudioStore.getState().play();
      useAudioStore.getState().seek(30);
      useAudioStore.getState().setCurrentBook('book-1');
      useAudioStore.getState().startSync();
      useAudioStore.getState().setHighlightedText('Text');

      useAudioStore.getState().reset();
      const state = useAudioStore.getState();

      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.currentBookId).toBeNull();
      expect(state.isSyncing).toBe(false);
      expect(state.highlightedText).toBe('');
      expect(state.currentPage).toBe(1);
      expect(state.segments).toHaveLength(0);
      expect(state.alignments).toHaveLength(0);
    });
  });
});

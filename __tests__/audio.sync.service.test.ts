import { audioSyncService, useAudioSync } from '@/lib/reader/AudioSyncService';
import { AudioAlignment } from '@/types';

describe('AudioSyncService', () => {
  beforeEach(() => {
    audioSyncService.reset();
  });

  afterEach(() => {
    audioSyncService.reset();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = audioSyncService.getState();
      expect(state.currentAlignment).toBeNull();
      expect(state.highlightedText).toBe('');
      expect(state.currentPage).toBe(1);
      expect(state.autoScroll).toBe(true);
    });
  });

  describe('setAlignments', () => {
    it('stores alignments for later lookup', () => {
      const alignments: AudioAlignment[] = [
        {
          id: 'align-1',
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'First paragraph.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 16,
          created_at: new Date().toISOString(),
        },
        {
          id: 'align-2',
          segment_id: 'seg-2',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Second paragraph.',
          start_time: 10,
          end_time: 20,
          page_number: 2,
          text_offset_start: 17,
          text_offset_end: 35,
          created_at: new Date().toISOString(),
        },
      ];

      audioSyncService.setAlignments(alignments);
      // Verify alignments are stored by checking findCurrentAlignment works
      const alignment = audioSyncService.findCurrentAlignment(5);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('First paragraph.');
    });

    it('handles empty alignments array', () => {
      audioSyncService.setAlignments([]);
      const alignment = audioSyncService.findCurrentAlignment(5);
      expect(alignment).toBeNull();
    });
  });

  describe('findCurrentAlignment', () => {
    const alignments: AudioAlignment[] = [
      {
        id: 'align-1',
        segment_id: 'seg-1',
        book_id: 'book-1',
        chapter_id: null,
        text: 'First segment.',
        start_time: 0,
        end_time: 10,
        page_number: 1,
        text_offset_start: 0,
        text_offset_end: 15,
        created_at: new Date().toISOString(),
      },
      {
        id: 'align-2',
        segment_id: 'seg-2',
        book_id: 'book-1',
        chapter_id: null,
        text: 'Second segment.',
        start_time: 10,
        end_time: 20,
        page_number: 2,
        text_offset_start: 16,
        text_offset_end: 32,
        created_at: new Date().toISOString(),
      },
      {
        id: 'align-3',
        segment_id: 'seg-3',
        book_id: 'book-1',
        chapter_id: null,
        text: 'Third segment.',
        start_time: 20,
        end_time: 30,
        page_number: 3,
        text_offset_start: 33,
        text_offset_end: 48,
        created_at: new Date().toISOString(),
      },
    ];

    beforeEach(() => {
      audioSyncService.setAlignments(alignments);
    });

    it('returns the alignment containing the current time', () => {
      const alignment = audioSyncService.findCurrentAlignment(5);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('First segment.');
    });

    it('returns the second alignment for time in the second range', () => {
      const alignment = audioSyncService.findCurrentAlignment(15);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('Second segment.');
    });

    it('returns the last alignment for time in the last range', () => {
      const alignment = audioSyncService.findCurrentAlignment(25);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('Third segment.');
    });

    it('returns the first alignment at exact end boundary (time 10)', () => {
      // First alignment is 0-10, so time 10 matches the first alignment
      const alignment = audioSyncService.findCurrentAlignment(10);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('First segment.');
    });

    it('returns null when no alignments are set', () => {
      audioSyncService.setAlignments([]);
      const alignment = audioSyncService.findCurrentAlignment(5);
      expect(alignment).toBeNull();
    });

    it('returns the last alignment before current time when not in a range', () => {
      // Time 35 is after all alignments end at 30
      const alignment = audioSyncService.findCurrentAlignment(35);
      expect(alignment).not.toBeNull();
      expect(alignment?.text).toBe('Third segment.');
    });

    it('returns null when time is before all alignments', () => {
      const alignment = audioSyncService.findCurrentAlignment(-1);
      expect(alignment).toBeNull();
    });
  });

  describe('updateSync', () => {
    const alignments: AudioAlignment[] = [
      {
        id: 'align-1',
        segment_id: 'seg-1',
        book_id: 'book-1',
        chapter_id: null,
        text: 'Highlighted text here.',
        start_time: 0,
        end_time: 10,
        page_number: 5,
        text_offset_start: 0,
        text_offset_end: 22,
        created_at: new Date().toISOString(),
      },
    ];

    beforeEach(() => {
      audioSyncService.setAlignments(alignments);
    });

    it('updates state with matching alignment', () => {
      let capturedState: any = null;
      audioSyncService.setSyncCallback((state) => {
        capturedState = state;
      });

      audioSyncService.updateSync(5, 1);

      expect(capturedState).not.toBeNull();
      expect(capturedState.highlightedText).toBe('Highlighted text here.');
      expect(capturedState.currentPage).toBe(5);
      expect(capturedState.currentAlignment?.text).toBe('Highlighted text here.');
    });

    it('falls back to last alignment when time is beyond all ranges', () => {
      let capturedState: any = null;
      audioSyncService.setSyncCallback((state) => {
        capturedState = state;
      });

      // Time 100 is beyond the alignment range (0-10), so it falls back to the last alignment
      // The alignment's page_number (5) takes precedence over the passed currentPage (3)
      audioSyncService.updateSync(100, 3);

      expect(capturedState.currentAlignment).not.toBeNull();
      expect(capturedState.currentPage).toBe(5); // alignment.page_number takes precedence
    });

    it('preserves autoScroll state during update', () => {
      audioSyncService.setAutoScroll(false);
      let capturedState: any = null;
      audioSyncService.setSyncCallback((state) => {
        capturedState = state;
      });

      audioSyncService.updateSync(5, 1);

      expect(capturedState.autoScroll).toBe(false);
    });
  });

  describe('setSyncCallback', () => {
    it('calls the callback when state updates', () => {
      const alignments: AudioAlignment[] = [
        {
          id: 'align-1',
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Test text.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 10,
          created_at: new Date().toISOString(),
        },
      ];
      audioSyncService.setAlignments(alignments);

      const callback = jest.fn();
      audioSyncService.setSyncCallback(callback);

      audioSyncService.updateSync(5, 1);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].highlightedText).toBe('Test text.');
    });

    it('overwrites the previous callback', () => {
      const alignments: AudioAlignment[] = [
        {
          id: 'align-1',
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Test text.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 10,
          created_at: new Date().toISOString(),
        },
      ];
      audioSyncService.setAlignments(alignments);

      const callback1 = jest.fn();
      const callback2 = jest.fn();
      audioSyncService.setSyncCallback(callback1);
      audioSyncService.setSyncCallback(callback2);

      audioSyncService.updateSync(5, 1);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoScroll', () => {
    it('toggles autoScroll on and off', () => {
      expect(audioSyncService.getState().autoScroll).toBe(true);

      const result = audioSyncService.toggleAutoScroll();
      expect(result).toBe(false);
      expect(audioSyncService.getState().autoScroll).toBe(false);

      const result2 = audioSyncService.toggleAutoScroll();
      expect(result2).toBe(true);
      expect(audioSyncService.getState().autoScroll).toBe(true);
    });

    it('sets autoScroll to a specific value', () => {
      audioSyncService.setAutoScroll(false);
      expect(audioSyncService.getState().autoScroll).toBe(false);

      audioSyncService.setAutoScroll(true);
      expect(audioSyncService.getState().autoScroll).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state to defaults', () => {
      // Modify state
      audioSyncService.setAutoScroll(false);
      const alignments: AudioAlignment[] = [
        {
          id: 'align-1',
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Test.',
          start_time: 0,
          end_time: 10,
          page_number: 5,
          text_offset_start: 0,
          text_offset_end: 5,
          created_at: new Date().toISOString(),
        },
      ];
      audioSyncService.setAlignments(alignments);
      audioSyncService.updateSync(5, 3);

      // Reset
      audioSyncService.reset();

      const state = audioSyncService.getState();
      expect(state.currentAlignment).toBeNull();
      expect(state.highlightedText).toBe('');
      expect(state.currentPage).toBe(1);
      expect(state.autoScroll).toBe(true);
    });
  });
});

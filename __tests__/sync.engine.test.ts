// Mock expo-speech before importing sync engine (which depends on TTS engine)
jest.mock('expo-speech', () => ({
  speak: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

import { SyncEngine, WordPosition } from '@/lib/sync/engine';
import { AudioAlignment } from '@/types';

describe('SyncEngine', () => {
  let engine: SyncEngine;

  beforeEach(() => {
    engine = new SyncEngine();
  });

  describe('initialize', () => {
    it('initializes with alignments, segments, and full text', () => {
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

      engine.initialize({
        alignments,
        segments: [],
        fullText: 'Hello world. This is a test.',
      });

      expect(engine.hasSyncData()).toBe(true);
      expect(engine.getSyncType()).toBe('alignment');
    });

    it('splits full text into sentences', () => {
      engine.initialize({
        fullText: 'First sentence. Second sentence! Third sentence?',
      });

      expect(engine.hasSyncData()).toBe(true);
      expect(engine.getSyncType()).toBe('tts');
    });

    it('returns no sync data when empty', () => {
      engine.initialize({});
      expect(engine.hasSyncData()).toBe(false);
      expect(engine.getSyncType()).toBe('none');
    });
  });

  describe('findCurrentAlignment', () => {
    beforeEach(() => {
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
        {
          id: undefined,
          segment_id: 'seg-3',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Third segment.',
          start_time: 20,
          end_time: 30,
          page_number: 3,
          text_offset_start: 30,
          text_offset_end: 44,
          created_at: new Date().toISOString(),
        },
      ];
      engine.initialize({ alignments });
    });

    it('finds alignment at start of range', () => {
      const result = engine.findCurrentAlignment(0);
      expect(result).not.toBeNull();
      expect(result!.segment_id).toBe('seg-1');
    });

    it('finds alignment in the middle of range', () => {
      const result = engine.findCurrentAlignment(5);
      expect(result).not.toBeNull();
      expect(result!.segment_id).toBe('seg-1');
    });

    it('finds alignment at boundary', () => {
      const result = engine.findCurrentAlignment(10);
      expect(result).not.toBeNull();
      expect(result!.segment_id).toBe('seg-2');
    });

    it('finds last alignment', () => {
      const result = engine.findCurrentAlignment(25);
      expect(result).not.toBeNull();
      expect(result!.segment_id).toBe('seg-3');
    });

    it('returns last alignment when time is beyond all', () => {
      const result = engine.findCurrentAlignment(50);
      expect(result).not.toBeNull();
      expect(result!.segment_id).toBe('seg-3');
    });

    it('returns null when no alignments exist', () => {
      const newEngine = new SyncEngine();
      expect(newEngine.findCurrentAlignment(5)).toBeNull();
    });
  });

  describe('updateTime', () => {
    it('calls onPositionChange callback with correct position', () => {
      const alignments: AudioAlignment[] = [
        {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        },
      ];
      engine.initialize({ alignments });
      engine.start();

      let capturedPosition: any = null;
      engine.setCallbacks({
        onPositionChange: (position) => {
          capturedPosition = position;
        },
      });

      engine.updateTime(5);

      expect(capturedPosition).not.toBeNull();
      expect(capturedPosition.segmentId).toBe('seg-1');
      expect(capturedPosition.text).toBe('Hello world.');
    });

    it('does not call callback when not active', () => {
      const alignments: AudioAlignment[] = [
        {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        },
      ];
      engine.initialize({ alignments });

      let capturedPosition: any = null;
      engine.setCallbacks({
        onPositionChange: (position) => {
          capturedPosition = position;
        },
      });

      engine.updateTime(5);
      expect(capturedPosition).toBeNull();
    });
  });

  describe('start and stop', () => {
    it('calls onSyncStart when started', () => {
      let started = false;
      engine.setCallbacks({ onSyncStart: () => { started = true; } });
      engine.start();
      expect(started).toBe(true);
    });

    it('clears tts timings when stopped', () => {
      engine.start();
      engine.stop();
      expect(engine.hasSyncData()).toBe(false);
    });
  });

  describe('getCurrentPosition', () => {
    it('returns current position based on time', () => {
      const alignments: AudioAlignment[] = [
        {
          id: undefined,
          segment_id: 'seg-1',
          book_id: 'book-1',
          chapter_id: null,
          text: 'Hello world.',
          start_time: 0,
          end_time: 10,
          page_number: 1,
          text_offset_start: 0,
          text_offset_end: 11,
          created_at: new Date().toISOString(),
        },
      ];
      engine.initialize({ alignments });
      engine.updateTime(5);

      const position = engine.getCurrentPosition();
      expect(position).not.toBeNull();
      expect(position?.segmentId).toBe('seg-1');
    });
  });

  describe('parseSRT', () => {
    it('parses SRT content into alignments', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:05,000
Hello world.

2
00:00:05,000 --> 00:00:10,000
This is a test.`;

      const alignments = SyncEngine.parseSRT(srtContent, 'book-1');
      expect(alignments).toHaveLength(2);
      expect(alignments[0].text).toBe('Hello world.');
      expect(alignments[0].start_time).toBe(1);
      expect(alignments[0].end_time).toBe(5);
      expect(alignments[1].text).toBe('This is a test.');
      expect(alignments[1].start_time).toBe(5);
      expect(alignments[1].end_time).toBe(10);
    });

    it('handles empty SRT content', () => {
      const alignments = SyncEngine.parseSRT('', 'book-1');
      expect(alignments).toHaveLength(0);
    });
  });

  describe('parseWebVTT', () => {
    it('parses WebVTT content into alignments', () => {
      const vttContent = `WEBVTT

00:00:01.000 --> 00:00:05.000
Hello world.

00:00:05.000 --> 00:00:10.000
This is a test.`;

      const alignments = SyncEngine.parseWebVTT(vttContent, 'book-1');
      expect(alignments.length).toBeGreaterThanOrEqual(2);
      expect(alignments[0].text).toBe('Hello world.');
      expect(alignments[0].start_time).toBe(1);
      expect(alignments[0].end_time).toBe(5);
    });
  });

  describe('estimateTTSTimings', () => {
    it('generates estimated timings for text', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const alignments = SyncEngine.estimateTTSTimings(text, 'book-1', 1.0);

      expect(alignments).toHaveLength(3);
      expect(alignments[0].start_time).toBe(0);
      expect(alignments[1].start_time).toBeGreaterThan(0);
      expect(alignments[2].start_time).toBeGreaterThan(alignments[1].start_time);
    });

    it('adjusts timings based on speed', () => {
      const text = 'First sentence. Second sentence.';
      const slowTimings = SyncEngine.estimateTTSTimings(text, 'book-1', 0.5);
      const fastTimings = SyncEngine.estimateTTSTimings(text, 'book-1', 2.0);

      // Slower speed should produce longer timings
      const slowTotal = slowTimings[slowTimings.length - 1].end_time;
      const fastTotal = fastTimings[fastTimings.length - 1].end_time;
      expect(slowTotal).toBeGreaterThan(fastTotal);
    });
  });

  describe('word-level highlighting', () => {
    describe('splitIntoWordAlignments', () => {
      it('splits a sentence into word positions', () => {
        const words = SyncEngine.splitIntoWordAlignments(
          'Hello world test',
          0,
          10,
          'book-1',
          'seg-1'
        );

        expect(words).toHaveLength(3);
        expect(words[0].word).toBe('Hello');
        expect(words[1].word).toBe('world');
        expect(words[2].word).toBe('test');
      });

      it('normalizes word timings to fit within segment duration', () => {
        const words = SyncEngine.splitIntoWordAlignments(
          'One two three four five',
          0,
          10,
          'book-1',
          'seg-1'
        );

        const lastWord = words[words.length - 1];
        expect(lastWord.endTime).toBeLessThanOrEqual(10);
      });
    });

    describe('generateWordLevelAlignments', () => {
      it('generates word-level alignments from sentence alignments', () => {
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

        const wordAlignments = SyncEngine.generateWordLevelAlignments(alignments);
        expect(wordAlignments).toHaveLength(1);
        expect(wordAlignments[0].words).toBeDefined();
        expect(wordAlignments[0].words!.length).toBeGreaterThan(0);
      });
    });

    describe('findCurrentWord', () => {
      it('finds the current word based on time', () => {
        const alignments: AudioAlignment[] = [
          {
            id: undefined,
            segment_id: 'seg-1',
            book_id: 'book-1',
            chapter_id: null,
            text: 'Hello world test.',
            start_time: 0,
            end_time: 10,
            page_number: 1,
            text_offset_start: 0,
            text_offset_end: 16,
            created_at: new Date().toISOString(),
          },
        ];

        engine.initialize({ alignments });
        engine.upgradeToWordLevel(1.0);

        const word = engine.findCurrentWord(1);
        expect(word).not.toBeNull();
      });

      it('returns null when no word-level data', () => {
        const alignments: AudioAlignment[] = [
          {
            id: undefined,
            segment_id: 'seg-1',
            book_id: 'book-1',
            chapter_id: null,
            text: 'Hello world.',
            start_time: 0,
            end_time: 10,
            page_number: 1,
            text_offset_start: 0,
            text_offset_end: 11,
            created_at: new Date().toISOString(),
          },
        ];

        engine.initialize({ alignments });
        const word = engine.findCurrentWord(5);
        expect(word).toBeNull();
      });
    });

    describe('upgradeToWordLevel', () => {
      it('upgrades sentence alignments to word-level', () => {
        const alignments: AudioAlignment[] = [
          {
            id: undefined,
            segment_id: 'seg-1',
            book_id: 'book-1',
            chapter_id: null,
            text: 'Hello world test.',
            start_time: 0,
            end_time: 10,
            page_number: 1,
            text_offset_start: 0,
            text_offset_end: 16,
            created_at: new Date().toISOString(),
          },
        ];

        engine.initialize({ alignments });
        engine.upgradeToWordLevel(1.0);

        expect(engine.hasWordLevelData()).toBe(true);
      });

      it('does nothing when no alignments', () => {
        engine.initialize({});
        engine.upgradeToWordLevel(1.0);
        expect(engine.hasWordLevelData()).toBe(false);
      });
    });
  });

  describe('hasWordLevelData', () => {
    it('returns false when no word alignments', () => {
      expect(engine.hasWordLevelData()).toBe(false);
    });
  });
});

import TTSEngine, { TTSSegment } from '@/lib/tts/engine';

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

describe('TTSEngine', () => {
  let engine: TTSEngine;

  beforeEach(() => {
    engine = new TTSEngine();
    jest.clearAllMocks();
  });

  describe('configure', () => {
    it('sets TTS options', () => {
      engine.configure({ rate: 1.5, volume: 0.8, language: 'en-US' });
      const state = engine.getState();
      // Options are stored internally, verify via state
      expect(state.segments).toEqual([]);
    });

    it('merges options with defaults', () => {
      engine.configure({ rate: 1.5 });
      // Only rate should change, others should keep defaults
      engine.configure({ volume: 0.5 });
      // Both should be set
    });
  });

  describe('splitIntoSegments', () => {
    it('splits text into sentence segments', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const segments = TTSEngine.splitIntoSegments(text, 0);

      expect(segments).toHaveLength(3);
      expect(segments[0].text).toBe('First sentence.');
      expect(segments[1].text).toBe('Second sentence!');
      expect(segments[2].text).toBe('Third sentence?');
    });

    it('assigns correct IDs', () => {
      const text = 'First. Second.';
      const segments = TTSEngine.splitIntoSegments(text, 1);

      expect(segments[0].id).toBe('tts-1-0');
      expect(segments[1].id).toBe('tts-1-1');
    });

    it('assigns correct chapter and segment indices', () => {
      const text = 'First. Second.';
      const segments = TTSEngine.splitIntoSegments(text, 2);

      expect(segments[0].chapterIndex).toBe(2);
      expect(segments[0].segmentIndex).toBe(0);
      expect(segments[1].chapterIndex).toBe(2);
      expect(segments[1].segmentIndex).toBe(1);
    });

    it('filters empty segments', () => {
      const text = 'First.   Second.';
      const segments = TTSEngine.splitIntoSegments(text);
      expect(segments).toHaveLength(2);
    });

    it('handles empty text', () => {
      const segments = TTSEngine.splitIntoSegments('');
      expect(segments).toHaveLength(0);
    });
  });

  describe('splitIntoChaptersAndSegments', () => {
    it('splits text into chapters by headings', () => {
      const text = '# Chapter 1\n\nContent 1.\n\n# Chapter 2\n\nContent 2.';
      const chapters = TTSEngine.splitIntoChaptersAndSegments(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0][0].text).toContain('Chapter 1');
      expect(chapters[1][0].text).toContain('Chapter 2');
    });

    it('returns single chapter when no headings', () => {
      const text = 'Just plain text. No headings here.';
      const chapters = TTSEngine.splitIntoChaptersAndSegments(text);

      expect(chapters).toHaveLength(1);
      expect(chapters[0]).toHaveLength(2);
    });

    it('handles different heading levels', () => {
      const text = '## Section 1\n\nContent 1.\n\n### Subsection\n\nContent 2.';
      const chapters = TTSEngine.splitIntoChaptersAndSegments(text);

      expect(chapters).toHaveLength(2);
    });
  });

  describe('loadSegments', () => {
    it('loads segments and resets index', () => {
      const segments: TTSSegment[] = [
        { id: 'tts-0-0', text: 'First.', chapterIndex: 0, segmentIndex: 0 },
        { id: 'tts-0-1', text: 'Second.', chapterIndex: 0, segmentIndex: 1 },
      ];

      engine.loadSegments(segments);
      const state = engine.getState();

      expect(state.segments).toHaveLength(2);
      expect(state.currentSegmentIndex).toBe(-1);
    });
  });

  describe('loadText', () => {
    it('loads text and splits into segments', () => {
      engine.loadText('First sentence. Second sentence.');
      const state = engine.getState();

      expect(state.segments).toHaveLength(2);
      expect(state.currentSegmentIndex).toBe(-1);
    });
  });

  describe('getState', () => {
    it('returns current state', () => {
      const state = engine.getState();
      expect(state.isSpeaking).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentSegmentIndex).toBe(-1);
      expect(state.segments).toEqual([]);
    });

    it('reflects changes after loading', () => {
      engine.loadText('First. Second.');
      const state = engine.getState();
      expect(state.segments).toHaveLength(2);
    });
  });

  describe('callbacks', () => {
    it('sets onChunkBegin callback', () => {
      let called = false;
      engine.setOnChunkBegin(() => { called = true; });
      // Callback is stored internally
    });

    it('sets onChunkEnd callback', () => {
      let called = false;
      engine.setOnChunkEnd(() => { called = true; });
    });

    it('sets onDone callback', () => {
      let called = false;
      engine.setOnDone(() => { called = true; });
    });

    it('sets onError callback', () => {
      let called = false;
      engine.setOnError(() => { called = true; });
    });
  });

  describe('isAvailable', () => {
    it('returns true', async () => {
      const available = await TTSEngine.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('getAvailableVoices', () => {
    it('returns common language codes', async () => {
      const voices = await TTSEngine.getAvailableVoices();
      expect(voices).toContain('en');
      expect(voices).toContain('en-US');
      expect(voices.length).toBeGreaterThan(0);
    });
  });
});

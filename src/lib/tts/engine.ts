import * as Speech from 'expo-speech';

/**
 * TTS (Text-to-Speech) Engine for EODH
 * 
 * Provides device-based TTS for immediate reading and supports
 * modular TTS provider architecture for future server-generated audio.
 */

export interface TTSSegment {
  id: string;
  text: string;
  chapterIndex: number;
  segmentIndex: number;
}

export interface TTSOptions {
  rate?: number;
  volume?: number;
  language?: string;
}

export interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentSegmentIndex: number;
  segments: TTSSegment[];
}

class TTSEngine {
  private options: TTSOptions = {
    rate: 1.0,
    volume: 1.0,
    language: 'en',
  };

  private onChunkBegin?: (utterance: string, charIndex: number, length: number) => void;
  private onChunkEnd?: (utterance: string, charIndex: number, length: number) => void;
  private onDone?: () => void;
  private onError?: (error: Error) => void;

  private isSpeaking = false;
  private isPaused = false;
  private currentSegmentIndex = -1;
  private segments: TTSSegment[] = [];
  private abortController: AbortController | null = null;

  /**
   * Configure TTS options
   */
  configure(options: Partial<TTSOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Set callback for when a chunk of speech begins
   */
  setOnChunkBegin(callback: (utterance: string, charIndex: number, length: number) => void) {
    this.onChunkBegin = callback;
  }

  /**
   * Set callback for when a chunk of speech ends
   */
  setOnChunkEnd(callback: (utterance: string, charIndex: number, length: number) => void) {
    this.onChunkEnd = callback;
  }

  /**
   * Set callback for when all speech is done
   */
  setOnDone(callback: () => void) {
    this.onDone = callback;
  }

  /**
   * Set callback for errors
   */
  setOnError(callback: (error: Error) => void) {
    this.onError = callback;
  }

  /**
   * Get current TTS state
   */
  getState(): TTSState {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      currentSegmentIndex: this.currentSegmentIndex,
      segments: this.segments,
    };
  }

  /**
   * Split text into manageable speech segments by sentences
   */
  static splitIntoSegments(text: string, chapterIndex: number = 0): TTSSegment[] {
    // Split by sentences
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    return sentences.map((sentence, index) => ({
      id: `tts-${chapterIndex}-${index}`,
      text: sentence.trim(),
      chapterIndex,
      segmentIndex: index,
    }));
  }

  /**
   * Split text into chapters and then into segments
   */
  static splitIntoChaptersAndSegments(text: string): TTSSegment[][] {
    // Detect chapters by headings (#, ##, etc. for markdown)
    const chapterRegex = /^(#+)\s+(.+)$/gm;
    const chapters: { start: number; title: string }[] = [];
    
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      chapters.push({
        start: match.index,
        title: match[2],
      });
    }

    if (chapters.length === 0) {
      // Single chapter
      return [this.splitIntoSegments(text, 0)];
    }

    const segments: TTSSegment[][] = [];
    chapters.forEach((chapter, index) => {
      const nextChapterStart = chapters[index + 1]?.start ?? text.length;
      const chapterText = text.slice(chapter.start, nextChapterStart).trim();
      segments.push(this.splitIntoSegments(chapterText, index));
    });

    return segments;
  }

  /**
   * Load segments for speaking
   */
  loadSegments(segments: TTSSegment[]) {
    this.segments = segments;
    this.currentSegmentIndex = -1;
  }

  /**
   * Load text and automatically split into segments
   */
  loadText(text: string) {
    this.segments = this.splitIntoSegments(text);
    this.currentSegmentIndex = -1;
  }

  /**
   * Start speaking from the beginning or from a specific segment
   */
  async speak(fromIndex: number = 0) {
    // Stop any current speech
    await this.stop();

    this.isSpeaking = true;
    this.isPaused = false;
    this.currentSegmentIndex = fromIndex - 1; // Will be incremented before first segment
    this.abortController = new AbortController();

    const speakSegment = async (index: number): Promise<boolean> => {
      if (index >= this.segments.length) {
        this.isSpeaking = false;
        this.onDone?.();
        return false;
      }

      // Check if stopped
      if (this.abortController?.signal.aborted) {
        return false;
      }

      const segment = this.segments[index];
      this.currentSegmentIndex = index;

      try {
        await Speech.speak(segment.text, {
          language: this.options.language,
          rate: this.options.rate,
          volume: this.options.volume,
          onChunkBegin: (utterance, charIndex, length) => {
            this.onChunkBegin?.(utterance, charIndex, length);
          },
          onChunkEnd: (utterance, charIndex, length) => {
            this.onChunkEnd?.(utterance, charIndex, length);
          },
        });

        // Check if paused
        if (this.isPaused) {
          return true; // Continue to next segment when resumed
        }

        // Check if stopped
        if (this.abortController?.signal.aborted) {
          return false;
        }

        // Continue to next segment
        return await speakSegment(index + 1);
      } catch (error) {
        this.onError?.(error as Error);
        return false;
      }
    };

    await speakSegment(fromIndex);
  }

  /**
   * Pause current speech
   */
  async pause() {
    if (this.isSpeaking && !this.isPaused) {
      this.isPaused = true;
      Speech.pause();
    }
  }

  /**
   * Resume paused speech
   */
  async resume() {
    if (this.isSpeaking && this.isPaused) {
      this.isPaused = false;
      Speech.resume();
    }
  }

  /**
   * Stop current speech
   */
  async stop() {
    this.abortController?.abort();
    this.abortController = null;
    Speech.stop();
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentSegmentIndex = -1;
  }

  /**
   * Check if TTS is available on the device
   */
  static async isAvailable(): Promise<boolean> {
    try {
      // Try a short test
      await Speech.isAvailableAsync();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available voices
   */
  static async getAvailableVoices(): Promise<string[]> {
    try {
      // expo-speech doesn't expose voice list directly
      // Return common language codes
      return ['en', 'en-US', 'en-GB', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'zh'];
    } catch {
      return ['en'];
    }
  }
}

// Export singleton instance
export const ttsEngine = new TTSEngine();

export default TTSEngine;

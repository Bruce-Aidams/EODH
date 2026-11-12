import * as Speech from 'expo-speech';
import {
  generateNeuralTTS,
  generateNeuralTTSBatch,
  NeuralTTSOptions,
  NeuralTTSResult,
} from '@/lib/tts/neuralProvider';

/**
 * TTS (Text-to-Speech) Engine for EODH
 * 
 * Supports two TTS providers:
 * - 'device': Uses expo-speech for immediate device-based TTS (no network required)
 * - 'neural': Uses Google Cloud TTS via Supabase Edge Function for high-quality neural audio
 * 
 * The neural provider generates MP3 audio files cached in Supabase Storage,
 * enabling seekable playback with proper audio controls.
 */

export type TTSProviderType = 'device' | 'neural';

export interface TTSSegment {
  id: string;
  text: string;
  chapterIndex: number;
  segmentIndex: number;
  audioUrl?: string;  // For neural TTS: URL to pre-generated audio
}

export interface TTSOptions {
  rate?: number;
  volume?: number;
  language?: string;
  provider?: TTSProviderType;
  voiceName?: string;  // For neural TTS: Google Cloud voice name
}

export interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentSegmentIndex: number;
  segments: TTSSegment[];
  provider: TTSProviderType;
  isGenerating: boolean;  // True while neural TTS is generating audio
  generatedCount: number;  // Number of segments with generated audio
}

class TTSEngine {
  private options: TTSOptions = {
    rate: 1.0,
    volume: 1.0,
    language: 'en',
    provider: 'device',
  };

  private onChunkBegin?: (utterance: string, charIndex: number, length: number) => void;
  private onChunkEnd?: (utterance: string, charIndex: number, length: number) => void;
  private onDone?: () => void;
  private onError?: (error: Error) => void;
  private onProgress?: (generated: number, total: number) => void;  // Neural TTS progress

  private isSpeaking = false;
  private isPaused = false;
  private currentSegmentIndex = -1;
  private segments: TTSSegment[] = [];
  private abortController: AbortController | null = null;
  private isGenerating = false;

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
   * Set callback for neural TTS generation progress
   */
  setOnProgress(callback: (generated: number, total: number) => void) {
    this.onProgress = callback;
  }

  /**
   * Get current TTS state
   */
  getState(): TTSState {
    const segmentsWithAudio = this.segments.filter(s => s.audioUrl).length;
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      currentSegmentIndex: this.currentSegmentIndex,
      segments: this.segments,
      provider: this.options.provider || 'device',
      isGenerating: this.isGenerating,
      generatedCount: segmentsWithAudio,
    };
  }

  /**
   * Get the current provider type
   */
  getProvider(): TTSProviderType {
    return this.options.provider || 'device';
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
    this.segments = TTSEngine.splitIntoSegments(text);
    this.currentSegmentIndex = -1;
  }

  /**
   * Generate neural TTS audio for all loaded segments.
   * This must be called before speak() when using the 'neural' provider.
   */
  async generateAudioForSegments(): Promise<void> {
    if (this.segments.length === 0) {
      return;
    }

    this.isGenerating = true;
    let generated = 0;
    const total = this.segments.length;

    try {
      const texts = this.segments.map(s => s.text);
      const neuralOptions: NeuralTTSOptions = {
        voiceName: this.options.voiceName,
        languageCode: this.options.language,
      };

      const results = await generateNeuralTTSBatch(texts, neuralOptions);

      // Update segments with audio URLs
      for (let i = 0; i < this.segments.length; i++) {
        if (results.segments[i]?.audioUrl) {
          this.segments[i].audioUrl = results.segments[i].audioUrl;
          generated++;
          this.onProgress?.(generated, total);
        }
      }
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Start speaking from the beginning or from a specific segment
   * Uses the configured provider (device or neural)
   * 
   * For 'device' provider: speaks text using expo-speech
   * For 'neural' provider: returns audio URLs for external playback
   *   (the caller should use the audio player to play the URLs)
   */
  async speak(fromIndex: number = 0) {
    // Stop any current speech
    await this.stop();

    const provider = this.options.provider || 'device';

    if (provider === 'neural') {
      // For neural TTS, the audio URLs are already in segments.
      // The caller (reader screen) should use the audio player to play them.
      // We just track the current segment index for sync purposes.
      this.isSpeaking = true;
      this.isPaused = false;
      this.currentSegmentIndex = fromIndex;
      this.abortController = new AbortController();

      // Check if we have audio URLs
      const firstSegment = this.segments[fromIndex];
      if (!firstSegment?.audioUrl) {
        this.onError?.(new Error('No audio generated for this segment. Call generateAudioForSegments() first.'));
        this.isSpeaking = false;
        return;
      }

      // Signal that playback should start — the reader screen handles actual audio playback
      this.onChunkBegin?.(firstSegment.text, 0, firstSegment.text.length);
    } else {
      await this.speakDevice(fromIndex);
    }
  }

  /**
   * Device-based TTS playback using expo-speech
   */
  private async speakDevice(fromIndex: number = 0) {
    this.isSpeaking = true;
    this.isPaused = false;
    this.currentSegmentIndex = fromIndex - 1;
    this.abortController = new AbortController();

    const speakSegment = async (index: number): Promise<boolean> => {
      if (index >= this.segments.length) {
        this.isSpeaking = false;
        this.onDone?.();
        return false;
      }

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
        });

        if (this.isPaused) {
          return true;
        }

        if (this.abortController?.signal.aborted) {
          return false;
        }

        return await speakSegment(index + 1);
      } catch (error) {
        this.onError?.(error as Error);
        return false;
      }
    };

    await speakSegment(fromIndex);
  }

  /**
   * Get audio URLs for all segments (neural TTS only)
   * Returns an array of audio URLs that can be played by the audio player
   */
  getAudioUrls(): string[] {
    return this.segments
      .map(s => s.audioUrl)
      .filter((url): url is string => url !== undefined);
  }

  /**
   * Get the audio URL for a specific segment (neural TTS only)
   */
  getAudioUrlForSegment(index: number): string | undefined {
    return this.segments[index]?.audioUrl;
  }

  /**
   * Update the current segment index (called by the audio player during neural TTS playback)
   */
  updateCurrentSegment(index: number) {
    if (index >= 0 && index < this.segments.length) {
      this.currentSegmentIndex = index;
      const segment = this.segments[index];
      this.onChunkBegin?.(segment.text, 0, segment.text.length);
    }
  }

  /**
   * Pause current speech
   */
  async pause() {
    if (this.isSpeaking && !this.isPaused) {
      this.isPaused = true;
      const provider = this.options.provider || 'device';
      if (provider !== 'neural') {
        Speech.pause();
      }
      // For neural TTS, the caller handles pausing the audio player
    }
  }

  /**
   * Resume paused speech
   */
  async resume() {
    if (this.isSpeaking && this.isPaused) {
      this.isPaused = false;
      const provider = this.options.provider || 'device';
      if (provider !== 'neural') {
        Speech.resume();
      }
      // For neural TTS, the caller handles resuming the audio player
    }
  }

  /**
   * Stop current speech
   */
  async stop() {
    this.abortController?.abort();
    this.abortController = null;

    const provider = this.options.provider || 'device';
    if (provider !== 'neural') {
      Speech.stop();
    }
    // For neural TTS, the caller handles stopping the audio player

    this.isSpeaking = false;
    this.isPaused = false;
    this.currentSegmentIndex = -1;
  }

  /**
   * Mark playback as complete (called by the audio player when neural TTS finishes)
   */
  markPlaybackComplete() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentSegmentIndex = -1;
    this.onDone?.();
  }

  /**
   * Check if TTS is available on the device
   */
  static async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Check if neural TTS is available (Edge Function is deployed)
   */
  static async isNeuralAvailable(): Promise<boolean> {
    try {
      const { isNeuralTTSAvailable } = await import('@/lib/tts/neuralProvider');
      return await isNeuralTTSAvailable();
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

  /**
   * Get available neural TTS voices
   */
  static async getAvailableNeuralVoices(): Promise<Array<{
    name: string;
    languageCode: string;
    ssmlGender: string;
  }>> {
    try {
      const { getNeuralTTSVoices } = await import('@/lib/tts/neuralProvider');
      return await getNeuralTTSVoices();
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const ttsEngine = new TTSEngine();

export default TTSEngine;

import { AudioAlignment, AudioSegment } from '@/types';
import { TTSSegment, ttsEngine } from '@/lib/tts/engine';

/**
 * Synchronization Engine for EODH
 * 
 * Reusable module that synchronizes audio playback with text highlighting.
 * Independent of PDF and audio player components.
 * 
 * Supports:
 * - Sentence-level synchronization (default)
 * - Word-level highlighting where alignment data supports it
 * - TTS-generated audio with automatic timing
 * - Pre-recorded audio with SRT/WebVTT timing files
 */

export interface SyncPosition {
  segmentId: string;
  text: string;
  pageNumber: number | null;
  textOffsetStart: number | null;
  textOffsetEnd: number | null;
  startTime: number;
  endTime: number;
}

export interface WordPosition {
  word: string;
  startTime: number;
  endTime: number;
  offsetInText: number;
  length: number;
}

export interface WordLevelAlignment extends AudioAlignment {
  words?: WordPosition[];
}

export interface SyncCallbacks {
  onPositionChange?: (position: SyncPosition) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onSyncStart?: () => void;
  onSyncEnd?: () => void;
  onError?: (error: Error) => void;
}

export class SyncEngine {
  private alignments: AudioAlignment[] = [];
  private segments: AudioSegment[] = [];
  private ttsSegments: TTSSegment[] = [];
  private fullText: string = '';
  private sentences: string[] = [];
  
  private currentTime: number = 0;
  private isActive: boolean = false;
  private callbacks: SyncCallbacks = {};
  
  // For TTS-based sync without pre-recorded audio
  private ttsSegmentTimings: Array<{ segment: TTSSegment; startTime: number; endTime: number }> = [];
  
  // Word-level highlighting support
  private wordAlignments: WordLevelAlignment[] = [];
  private currentWordIndex: number = -1;

  /**
   * Initialize the sync engine with alignment data
   */
  initialize(options: {
    alignments?: AudioAlignment[];
    segments?: AudioSegment[];
    fullText?: string;
  }) {
    this.alignments = options.alignments || [];
    this.segments = options.segments || [];
    this.fullText = options.fullText || '';
    
    // Split full text into sentences for TTS-based sync
    if (this.fullText) {
      this.sentences = this.fullText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map(s => s.trim());
    }
  }

  /**
   * Set up TTS-based synchronization
   * Used when there's no pre-recorded audio alignment data
   */
  setupTTSSync(text: string) {
    this.fullText = text;
    this.sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map(s => s.trim());
    
    // Create TTS segments
    this.ttsSegments = TTSEngine.splitIntoSegments(text);
    
    // Set up TTS callbacks for sync
    ttsEngine.setOnChunkBegin((utterance, charIndex, length) => {
      if (!this.isActive) return;
      
      // Find which sentence contains this chunk
      const sentenceIndex = this.findSentenceIndex(utterance);
      if (sentenceIndex >= 0) {
        const position: SyncPosition = {
          segmentId: `tts-${sentenceIndex}`,
          text: this.sentences[sentenceIndex],
          pageNumber: null,
          textOffsetStart: charIndex,
          textOffsetEnd: charIndex + length,
          startTime: this.currentTime,
          endTime: this.currentTime + 1,
        };
        this.callbacks.onPositionChange?.(position);
      }
    });

    ttsEngine.setOnDone(() => {
      this.isActive = false;
      this.callbacks.onSyncEnd?.();
    });
  }

  /**
   * Set synchronization callbacks
   */
  setCallbacks(callbacks: SyncCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Start synchronization
   */
  start() {
    this.isActive = true;
    this.callbacks.onSyncStart?.();
  }

  /**
   * Stop synchronization
   */
  stop() {
    this.isActive = false;
    this.ttsSegmentTimings = [];
  }

  /**
   * Update current playback time
   * Called by audio player on each time update
   */
  updateTime(time: number) {
    if (!this.isActive) return;
    
    this.currentTime = time;
    
    // Find current alignment based on time
    const alignment = this.findCurrentAlignment(time);
    if (alignment) {
      const position: SyncPosition = {
        segmentId: alignment.segment_id,
        text: alignment.text,
        pageNumber: alignment.page_number,
        textOffsetStart: alignment.text_offset_start,
        textOffsetEnd: alignment.text_offset_end,
        startTime: alignment.start_time,
        endTime: alignment.end_time,
      };
      this.callbacks.onPositionChange?.(position);
    }
  }

  /**
   * Find the current alignment based on playback time
   */
  findCurrentAlignment(time: number): AudioAlignment | null {
    if (this.alignments.length === 0) return null;
    
    // Binary search for efficiency
    let start = 0;
    let end = this.alignments.length - 1;
    
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);
      const align = this.alignments[mid];
      
      if (time >= align.start_time && time < align.end_time) {
        return align;
      } else if (time < align.start_time) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    
    // Return the last alignment if time is beyond all alignments
    if (start === this.alignments.length) {
      return this.alignments[this.alignments.length - 1] || null;
    }
    
    return null;
  }

  /**
   * Find which sentence index contains the given text
   */
  private findSentenceIndex(text: string): number {
    const searchText = text.trim().substring(0, 50).toLowerCase();
    
    for (let i = 0; i < this.sentences.length; i++) {
      if (this.sentences[i].toLowerCase().includes(searchText)) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Get the current sync position
   */
  getCurrentPosition(): SyncPosition | null {
    const alignment = this.findCurrentAlignment(this.currentTime);
    if (!alignment) return null;
    
    return {
      segmentId: alignment.segment_id,
      text: alignment.text,
      pageNumber: alignment.page_number,
      textOffsetStart: alignment.text_offset_start,
      textOffsetEnd: alignment.text_offset_end,
      startTime: alignment.start_time,
      endTime: alignment.end_time,
    };
  }

  /**
   * Parse SRT subtitle file content into alignments
   */
  static parseSRT(content: string, bookId: string, chapterId: string | null = null): AudioAlignment[] {
    const alignments: AudioAlignment[] = [];
    const blocks = content.trim().split(/\n\n+/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      
      // Parse timestamp
      const timeMatch = lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;
      
      const startTime = this.parseTimestamp(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.parseTimestamp(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
      
      // Text is the remaining lines
      const text = lines.slice(2).join(' ').trim();
      
      alignments.push({
        id: `srt-${alignments.length}`,
        segment_id: `srt-${alignments.length}`,
        book_id: bookId,
        chapter_id: chapterId,
        text,
        start_time: startTime,
        end_time: endTime,
        page_number: null,
        text_offset_start: null,
        text_offset_end: null,
        created_at: new Date().toISOString(),
      });
    }
    
    return alignments;
  }

  /**
   * Parse WebVTT file content into alignments
   */
  static parseWebVTT(content: string, bookId: string, chapterId: string | null = null): AudioAlignment[] {
    const alignments: AudioAlignment[] = [];
    const blocks = content.trim().split(/\n\n+/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      
      // Find timestamp line
      const timeLineIndex = lines.findIndex(line => line.includes('-->'));
      if (timeLineIndex === -1) continue;
      
      const timeMatch = lines[timeLineIndex].match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (!timeMatch) continue;
      
      const startTime = this.parseTimestamp(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.parseTimestamp(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
      
      // Text is lines after the timestamp
      const text = lines.slice(timeLineIndex + 1).join(' ').trim();
      
      alignments.push({
        id: `vtt-${alignments.length}`,
        segment_id: `vtt-${alignments.length}`,
        book_id: bookId,
        chapter_id: chapterId,
        text,
        start_time: startTime,
        end_time: endTime,
        page_number: null,
        text_offset_start: null,
        text_offset_end: null,
        created_at: new Date().toISOString(),
      });
    }
    
    return alignments;
  }

  /**
   * Parse timestamp components into seconds
   */
  private static parseTimestamp(h: string, m: string, s: string, ms: string): number {
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  }

  /**
   * Generate estimated TTS timings for text segments
   * Uses average reading speed to estimate timing
   */
  static estimateTTSTimings(text: string, bookId: string, speed: number = 1.0): AudioAlignment[] {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map(s => s.trim());
    const alignments: AudioAlignment[] = [];
    
    // Average reading speed: ~150 words per minute at 1x speed
    const wordsPerMinute = 150 * speed;
    let currentTime = 0;
    
    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).length;
      const duration = (wordCount / wordsPerMinute) * 60;
      
      alignments.push({
        id: `tts-est-${alignments.length}`,
        segment_id: `tts-est-${alignments.length}`,
        book_id: bookId,
        chapter_id: null,
        text: sentence,
        start_time: currentTime,
        end_time: currentTime + duration,
        page_number: null,
        text_offset_start: null,
        text_offset_end: null,
        created_at: new Date().toISOString(),
      });
      
      currentTime += duration;
    }
    
    return alignments;
  }

  /**
   * Check if a book has sync data available
   */
  hasSyncData(): boolean {
    return this.alignments.length > 0 || this.ttsSegments.length > 0 || this.sentences.length > 0;
  }

  /**
   * Get the type of sync available
   */
  getSyncType(): 'alignment' | 'tts' | 'none' {
    if (this.alignments.length > 0) return 'alignment';
    if (this.ttsSegments.length > 0 || this.sentences.length > 0) return 'tts';
    return 'none';
  }

  /**
   * Split a sentence into word-level alignments with estimated timings.
   * Used when word-level timing data is not available from the TTS provider.
   * Estimates word duration based on character count and playback speed.
   */
  static splitIntoWordAlignments(
    text: string,
    startTime: number,
    endTime: number,
    bookId: string,
    segmentId: string,
    speed: number = 1.0
  ): WordPosition[] {
    const words = text.split(/(\s+)/).filter(w => w.trim().length > 0);
    if (words.length === 0) return [];
    
    const segmentDuration = endTime - startTime;
    const avgWordDuration = segmentDuration / words.length;
    const wordPositions: WordPosition[] = [];
    let currentTime = startTime;
    let offsetInText = 0;
    
    for (const word of words) {
      // Adjust word duration based on character count
      const charFactor = Math.max(0.5, Math.min(2.0, word.length / 4));
      const wordDuration = avgWordDuration * charFactor;
      
      wordPositions.push({
        word: word.trim(),
        startTime: currentTime,
        endTime: currentTime + wordDuration,
        offsetInText,
        length: word.length,
      });
      
      currentTime += wordDuration;
      offsetInText += word.length + 1; // +1 for space
    }
    
    // Normalize to fit within the segment duration
    if (wordPositions.length > 0) {
      const lastWord = wordPositions[wordPositions.length - 1];
      if (lastWord.endTime > endTime) {
        const scale = (endTime - startTime) / (lastWord.endTime - startTime);
        for (const wp of wordPositions) {
          wp.startTime = startTime + (wp.startTime - startTime) * scale;
          wp.endTime = startTime + (wp.endTime - startTime) * scale;
        }
      }
    }
    
    return wordPositions;
  }

  /**
   * Generate word-level alignments from sentence-level alignments.
   * This creates estimated word timings from existing sentence alignments.
   */
  static generateWordLevelAlignments(
    alignments: AudioAlignment[],
    speed: number = 1.0
  ): WordLevelAlignment[] {
    return alignments.map(alignment => {
      const words = this.splitIntoWordAlignments(
        alignment.text,
        alignment.start_time,
        alignment.end_time,
        alignment.book_id,
        alignment.segment_id,
        speed
      );
      
      return {
        ...alignment,
        words,
      };
    });
  }

  /**
   * Find the current word being spoken based on playback time.
   * Returns the word position or null if no word is currently active.
   */
  findCurrentWord(time: number): WordPosition | null {
    // First find the current sentence alignment
    const alignment = this.findCurrentAlignment(time);
    if (!alignment) return null;
    
    // Check if we have word-level data for this alignment
    const wordAlignment = this.wordAlignments.find(wa => wa.segment_id === alignment.segment_id);
    if (!wordAlignment?.words?.length) return null;
    
    // Find the current word within the alignment
    for (const word of wordAlignment.words) {
      if (time >= word.startTime && time < word.endTime) {
        return word;
      }
    }
    
    return null;
  }

  /**
   * Set word-level alignments for use during sync.
   * Call this after initialize() if word-level highlighting is needed.
   */
  setWordAlignments(wordAlignments: WordLevelAlignment[]) {
    this.wordAlignments = wordAlignments;
  }

  /**
   * Upgrade sentence alignments to word-level alignments automatically.
   * Uses estimated timings based on word count and segment duration.
   */
  upgradeToWordLevel(speed: number = 1.0) {
    if (this.alignments.length === 0) return;
    
    this.wordAlignments = SyncEngine.generateWordLevelAlignments(this.alignments, speed);
  }

  /**
   * Check if word-level highlighting is available
   */
  hasWordLevelData(): boolean {
    return this.wordAlignments.length > 0 && this.wordAlignments.some(wa => wa.words && wa.words.length > 0);
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();

export default SyncEngine;

import { AudioAlignment } from '@/types';

/**
 * PDF Text Extraction Utility for EODH
 *
 * Extracts text from PDF documents for synchronized reading.
 * Provides page-level text data with position information.
 *
 * Note: react-native-pdf-jsi does not expose text extraction directly.
 * This module provides the interface and fallback strategies:
 *
 * 1. For text-based PDFs: uses a Supabase Edge Function to extract text
 *    server-side using pdf-parse or similar.
 * 2. For scanned PDFs: identifies that OCR is required.
 * 3. For admin workflow: provides structure for manual text association.
 *
 * The extracted text is used to generate sync segments for TTS-based
 * synchronized reading when no pre-recorded audio alignment exists.
 */

export interface PdfPageText {
  pageNumber: number;
  text: string;
  sentences: string[];
  wordPositions: Array<{ word: string; offset: number; length: number }>;
}

export interface PdfTextData {
  totalPages: number;
  fullText: string;
  pages: PdfPageText[];
  isScanned: boolean;
  needsOcr: boolean;
}

export interface SyncSegmentFromPdf {
  text: string;
  pageNumber: number;
  textOffsetStart: number;
  textOffsetEnd: number;
  estimatedDuration: number; // seconds, for TTS timing
}

/**
 * PDF Text Extractor class.
 *
 * In production, text extraction should be done server-side via a
 * Supabase Edge Function to handle large files and scanned PDFs.
 * This client-side module coordinates with the backend and provides
 * the data structures needed for synchronization.
 */
export class PdfTextExtractor {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  /**
   * Extract text from a PDF document via Supabase Edge Function.
   *
   * The Edge Function should:
   * 1. Download the PDF from Supabase Storage
   * 2. Use pdf-parse or similar to extract text
   * 3. Return structured text data with page numbers
   * 4. Detect if the PDF is scanned (empty text = needs OCR)
   *
   * @param documentUrl - URL of the PDF document in Supabase Storage
   * @returns PdfTextData with extracted text and metadata
   */
  async extractText(documentUrl: string): Promise<PdfTextData> {
    try {
      // Call the Supabase Edge Function for text extraction
      const response = await fetch(`${this.supabaseUrl}/functions/v1/extract-pdf-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ documentUrl }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extract text: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processExtractedData(data);
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      // Return empty data indicating extraction failed
      return {
        totalPages: 0,
        fullText: '',
        pages: [],
        isScanned: false,
        needsOcr: true,
      };
    }
  }

  /**
   * Process raw extracted data into structured PdfTextData.
   */
  private processExtractedData(rawData: any): PdfTextData {
    const pages: PdfPageText[] = [];
    let fullText = '';

    // Process each page's text
    if (rawData.pages && Array.isArray(rawData.pages)) {
      for (const page of rawData.pages) {
        const text = page.text || '';
        const sentences = this.splitIntoSentences(text);
        const wordPositions = this.extractWordPositions(text);

        pages.push({
          pageNumber: page.pageNumber || pages.length + 1,
          text,
          sentences,
          wordPositions,
        });

        if (text) {
          fullText += text + '\n\n';
        }
      }
    }

    // Detect if PDF is scanned (no text extracted)
    const isScanned = pages.length > 0 && pages.every(p => p.text.trim().length < 10);
    const needsOcr = isScanned || fullText.trim().length === 0;

    return {
      totalPages: rawData.totalPages || pages.length,
      fullText: fullText.trim(),
      pages,
      isScanned,
      needsOcr,
    };
  }

  /**
   * Split text into sentences for TTS segmentation.
   */
  splitIntoSentences(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());
  }

  /**
   * Extract word positions from text for word-level highlighting.
   */
  extractWordPositions(text: string): Array<{ word: string; offset: number; length: number }> {
    const positions: Array<{ word: string; offset: number; length: number }> = [];
    const wordRegex = /\S+/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      positions.push({
        word: match[0],
        offset: match.index,
        length: match[0].length,
      });
    }

    return positions;
  }

  /**
   * Generate sync segments from extracted PDF text.
   *
   * Creates segments that can be used with the TTS engine for
   * synchronized reading. Each segment corresponds to a sentence
   * with its page number and text position.
   *
   * @param textData - Extracted PDF text data
   * @returns Array of sync segments
   */
  generateSyncSegments(textData: PdfTextData): SyncSegmentFromPdf[] {
    const segments: SyncSegmentFromPdf[] = [];
    let globalOffset = 0;

    for (const page of textData.pages) {
      const sentences = this.splitIntoSentences(page.text);

      for (const sentence of sentences) {
        // Find the sentence's position within the page text
        const sentenceStart = page.text.indexOf(sentence);
        const textOffsetStart = sentenceStart >= 0 ? sentenceStart : 0;
        const textOffsetEnd = textOffsetStart + sentence.length;

        // Estimate duration based on word count (average reading speed ~150 wpm)
        const wordCount = sentence.split(/\s+/).length;
        const estimatedDuration = (wordCount / 150) * 60; // Convert to seconds

        segments.push({
          text: sentence,
          pageNumber: page.pageNumber,
          textOffsetStart,
          textOffsetEnd,
          estimatedDuration,
        });
      }

      globalOffset += page.text.length + 2; // +2 for '\n\n'
    }

    return segments;
  }

  /**
   * Generate audio alignments from PDF sync segments.
   *
   * Converts sync segments into AudioAlignment format for use
   * with the sync engine. Uses estimated TTS timing.
   *
   * @param segments - Sync segments from PDF text
   * @param bookId - Book UUID
   * @returns Array of AudioAlignment objects
   */
  generateAlignments(segments: SyncSegmentFromPdf[], bookId: string): AudioAlignment[] {
    const alignments: AudioAlignment[] = [];
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startTime = currentTime;
      const endTime = currentTime + segment.estimatedDuration;

      alignments.push({
        id: undefined,
        segment_id: null,
        book_id: bookId,
        chapter_id: null,
        text: segment.text,
        start_time: startTime,
        end_time: endTime,
        page_number: segment.pageNumber,
        text_offset_start: segment.textOffsetStart,
        text_offset_end: segment.textOffsetEnd,
        created_at: new Date().toISOString(),
      });

      currentTime = endTime;
    }

    return alignments;
  }

  /**
   * Check if a PDF requires OCR processing.
   *
   * A PDF needs OCR if:
   * - No text was extracted (scanned images)
   * - Very little text was extracted relative to page count
   *
   * @param textData - Extracted PDF text data
   * @returns True if OCR is required
   */
  needsOcrProcessing(textData: PdfTextData): boolean {
    // If no text at all
    if (textData.fullText.trim().length === 0) return true;

    // If average text per page is very low (likely scanned)
    const avgTextPerPage = textData.fullText.length / Math.max(textData.totalPages, 1);
    if (avgTextPerPage < 50) return true;

    return false;
  }

  /**
   * Get the text for a specific page.
   *
   * @param textData - Extracted PDF text data
   * @param pageNumber - Page number (1-indexed)
   * @returns Text content of the specified page
   */
  getPageText(textData: PdfTextData, pageNumber: number): string {
    const page = textData.pages.find(p => p.pageNumber === pageNumber);
    return page?.text || '';
  }

  /**
   * Search for text within the PDF.
   *
   * @param textData - Extracted PDF text data
   * @param query - Search query
   * @returns Array of matches with page numbers and positions
   */
  searchText(
    textData: PdfTextData,
    query: string
  ): Array<{ pageNumber: number; text: string; position: number }> {
    const matches: Array<{ pageNumber: number; text: string; position: number }> = [];
    const lowerQuery = query.toLowerCase();

    for (const page of textData.pages) {
      const lowerText = page.text.toLowerCase();
      let index = 0;

      while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
        matches.push({
          pageNumber: page.pageNumber,
          text: page.text.substring(index, index + query.length * 3), // Context
          position: index,
        });
        index += query.length;
      }
    }

    return matches;
  }
}

// Export a singleton instance that will be configured with Supabase credentials
let extractorInstance: PdfTextExtractor | null = null;

/**
 * Get or create the PDF text extractor instance.
 *
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase anon key
 * @returns PdfTextExtractor instance
 */
export function getPdfTextExtractor(supabaseUrl: string, supabaseKey: string): PdfTextExtractor {
  if (!extractorInstance) {
    extractorInstance = new PdfTextExtractor(supabaseUrl, supabaseKey);
  }
  return extractorInstance;
}

/**
 * Split text into sentences (utility function).
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());
}

/**
 * Estimate TTS duration for a text segment.
 *
 * Uses average reading speed of ~150 words per minute.
 *
 * @param text - Text to estimate duration for
 * @param speechRate - Speech rate multiplier (1.0 = normal)
 * @returns Estimated duration in seconds
 */
export function estimateTTSDuration(text: string, speechRate: number = 1.0): number {
  const wordCount = text.split(/\s+/).length;
  const baseDuration = (wordCount / 150) * 60; // seconds at 150 wpm
  return baseDuration / speechRate;
}

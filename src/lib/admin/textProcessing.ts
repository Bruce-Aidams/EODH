import { supabase } from '@/lib/supabase/client';
import { Book, BookChapter, AudioSegment, AudioAlignment } from '@/types';
import { splitIntoSentences, estimateTTSDuration } from '@/lib/pdf/extractor';
import { extractChapters, markdownToPlainText } from '@/lib/markdown/renderer';

/**
 * Admin Text Processing Pipeline for EODH
 * 
 * Processes uploaded documents to:
 * 1. Extract text content
 * 2. Detect chapters and headings
 * 3. Generate document structure
 * 4. Prepare text for TTS
 * 5. Generate synchronization metadata
 * 6. Identify scanned PDFs requiring OCR
 * 
 * This runs on the admin side after document upload.
 */

export interface ProcessingResult {
  success: boolean;
  bookId: string;
  chaptersCreated: number;
  segmentsCreated: number;
  alignmentsCreated: number;
  fullTextLength: number;
  isScanned: boolean;
  needsOcr: boolean;
  error: string | null;
}

export interface ProcessingProgress {
  stage: 'extracting' | 'chapters' | 'segments' | 'alignments' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

/**
 * Process a newly uploaded document.
 * 
 * For Markdown files, text extraction is done client-side.
 * For PDF files, text extraction requires a Supabase Edge Function.
 */
export async function processDocument(
  book: Book,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    bookId: book.id,
    chaptersCreated: 0,
    segmentsCreated: 0,
    alignmentsCreated: 0,
    fullTextLength: 0,
    isScanned: false,
    needsOcr: false,
    error: null,
  };

  try {
    let fullText = '';

    // Stage 1: Extract text
    onProgress?.({
      stage: 'extracting',
      progress: 10,
      message: 'Extracting text from document...',
    });

    if (book.document_type === 'markdown') {
      // For Markdown, fetch and process directly
      const response = await fetch(book.document_url!);
      if (!response.ok) throw new Error(`Failed to fetch document: ${response.status}`);
      
      const rawText = await response.text();
      fullText = markdownToPlainText(rawText);
    } else {
      // For PDF, use the Edge Function
      try {
        const supabaseUrl = (globalThis as any).__supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = (globalThis as any).__supabaseKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        
        const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-pdf-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ documentUrl: book.document_url }),
        });

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          fullText = extractData.fullText || '';
          result.isScanned = extractData.isScanned || false;
          result.needsOcr = extractData.needsOcr || false;
        } else {
          // Edge function not available — mark as needing OCR
          result.needsOcr = true;
          result.error = 'PDF text extraction requires server-side processing. Please configure the extract-pdf-text Edge Function.';
          onProgress?.({
            stage: 'error',
            progress: 0,
            message: result.error,
          });
          return result;
        }
      } catch (err: any) {
        result.needsOcr = true;
        result.error = `PDF extraction failed: ${err?.message || 'Unknown error'}`;
        onProgress?.({
          stage: 'error',
          progress: 0,
          message: result.error,
        });
        return result;
      }
    }

    result.fullTextLength = fullText.length;

    if (!fullText || fullText.trim().length === 0) {
      result.needsOcr = true;
      result.error = 'No text extracted from document. The file may be scanned images requiring OCR.';
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: result.error,
      });
      return result;
    }

    // Stage 2: Detect and create chapters
    onProgress?.({
      stage: 'chapters',
      progress: 30,
      message: 'Detecting chapters and headings...',
    });

    const chapters = extractChapters(fullText);
    let chaptersCreated = 0;

    for (const chapter of chapters) {
      const { error } = await supabase
        .from('book_chapters')
        .insert({
          book_id: book.id,
          title: chapter.title,
          order_index: chapter.order,
        });

      if (!error) {
        chaptersCreated++;
      }
    }

    // If no chapters detected, create a single chapter
    if (chaptersCreated === 0) {
      const { error } = await supabase
        .from('book_chapters')
        .insert({
          book_id: book.id,
          title: 'Full Text',
          order_index: 0,
        });

      if (!error) chaptersCreated = 1;
    }

    result.chaptersCreated = chaptersCreated;

    // Stage 3: Generate segments for TTS
    onProgress?.({
      stage: 'segments',
      progress: 60,
      message: 'Generating text segments for TTS...',
    });

    const sentences = splitIntoSentences(fullText);
    let segmentsCreated = 0;
    let currentTime = 0;
    const speechRate = 1.0;

    // Fetch chapters for association
    const { data: chaptersData } = await supabase
      .from('book_chapters')
      .select('*')
      .eq('book_id', book.id)
      .order('order_index', { ascending: true });

    const chapterList = chaptersData || [];
    let currentChapterIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const estimatedDuration = estimateTTSDuration(sentence, speechRate);
      const startTime = currentTime;
      const endTime = currentTime + estimatedDuration;

      // Determine which chapter this sentence belongs to
      const chapter = chapterList[currentChapterIndex] || null;

      const { error } = await supabase
        .from('audio_segments')
        .insert({
          book_id: book.id,
          chapter_id: chapter?.id || null,
          text: sentence,
          audio_url: null,
          start_time: startTime,
          end_time: endTime,
          page_number: null,
          order_index: i,
        });

      if (!error) {
        segmentsCreated++;
      }

      currentTime = endTime;
    }

    result.segmentsCreated = segmentsCreated;

    // Stage 4: Generate alignments
    onProgress?.({
      stage: 'alignments',
      progress: 85,
      message: 'Generating synchronization alignments...',
    });

    let alignmentsCreated = 0;
    currentTime = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const estimatedDuration = estimateTTSDuration(sentence, speechRate);
      const startTime = currentTime;
      const endTime = currentTime + estimatedDuration;

      // Find text offset in full text
      const textOffsetStart = fullText.indexOf(sentence);
      const textOffsetEnd = textOffsetStart >= 0 ? textOffsetStart + sentence.length : null;

      const { error } = await supabase
        .from('audio_alignments')
        .insert({
          book_id: book.id,
          segment_id: `seg-${book.id}-${i}`,
          chapter_id: null,
          text: sentence,
          start_time: startTime,
          end_time: endTime,
          page_number: null,
          text_offset_start: textOffsetStart >= 0 ? textOffsetStart : null,
          text_offset_end: textOffsetEnd,
        });

      if (!error) {
        alignmentsCreated++;
      }

      currentTime = endTime;
    }

    result.alignmentsCreated = alignmentsCreated;

    // Update book to indicate audio availability
    await supabase
      .from('books')
      .update({
        has_audio: true,
        audio_type: 'tts',
      })
      .eq('id', book.id);

    // Stage 5: Complete
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Processing complete!',
    });

    result.success = true;

  } catch (error: any) {
    result.error = error?.message || 'Processing failed';
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: `Error: ${result.error}`,
    });
  }

  return result;
}

/**
 * Check if a book has been processed.
 */
export async function isBookProcessed(bookId: string): Promise<{
  hasChapters: boolean;
  hasSegments: boolean;
  hasAlignments: boolean;
  isReady: boolean;
}> {
  const { count: chapterCount } = await supabase
    .from('book_chapters')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId);

  const { count: segmentCount } = await supabase
    .from('audio_segments')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId);

  const { count: alignmentCount } = await supabase
    .from('audio_alignments')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId);

  return {
    hasChapters: (chapterCount || 0) > 0,
    hasSegments: (segmentCount || 0) > 0,
    hasAlignments: (alignmentCount || 0) > 0,
    isReady: (chapterCount || 0) > 0 && (segmentCount || 0) > 0,
  };
}

/**
 * Re-process a book's text (clears existing data and re-extracts).
 */
export async function reprocessDocument(
  book: Book,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  // Clear existing data
  await supabase.from('audio_alignments').delete().eq('book_id', book.id);
  await supabase.from('audio_segments').delete().eq('book_id', book.id);
  await supabase.from('book_chapters').delete().eq('book_id', book.id);

  // Re-process
  return processDocument(book, onProgress);
}

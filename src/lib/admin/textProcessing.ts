import { supabase } from '@/lib/supabase/client';
import { Book, BookChapter, AudioSegment, AudioAlignment } from '@/types';
import { splitIntoSentences, estimateTTSDuration } from '@/lib/pdf/extractor';
import { extractChapters, markdownToPlainText } from '@/lib/markdown/renderer';

/**
 * Admin Text Processing Pipeline for EODH
 * 
 * Processes uploaded documents to:
 * 1. Extract text content via unified Edge Function
 * 2. Create chapters with HTML content
 * 3. Generate document structure
 * 4. Prepare text for TTS
 * 5. Generate synchronization metadata
 * 6. Identify scanned PDFs requiring OCR
 * 
 * This runs on the admin side after document upload.
 * All formats (PDF, EPUB, DOCX, Markdown) are processed through the
 * unified process-document Edge Function for consistent output.
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

interface EdgeFunctionChapter {
  title: string;
  order_index: number;
  content: string;
  page_start?: number;
  page_end?: number;
}

interface EdgeFunctionResponse {
  chapters: EdgeFunctionChapter[];
  fullText: string;
  totalPages: number;
  totalChapters: number;
  isScanned?: boolean;
  needsOcr?: boolean;
  error?: string;
}

/**
 * Call the unified process-document Edge Function.
 */
async function callProcessDocument(documentUrl: string): Promise<EdgeFunctionResponse> {
  const supabaseUrl = (globalThis as any).__supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = (globalThis as any).__supabaseKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ documentUrl }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Edge function returned ${response.status}`);
  }

  return response.json();
}

/**
 * Process a newly uploaded document.
 * 
 * All formats (PDF, EPUB, DOCX, Markdown) are routed through the unified
 * process-document Edge Function for consistent chapter extraction and
 * HTML content generation.
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
    let edgeChapters: EdgeFunctionChapter[] = [];
    let totalPages = 0;

    // Stage 1: Extract text via Edge Function
    onProgress?.({
      stage: 'extracting',
      progress: 10,
      message: `Extracting text from ${book.document_type} document...`,
    });

    try {
      const edgeResponse = await callProcessDocument(book.document_url!);
      fullText = edgeResponse.fullText || '';
      edgeChapters = edgeResponse.chapters || [];
      totalPages = edgeResponse.totalPages || 0;
      result.isScanned = edgeResponse.isScanned || false;
      result.needsOcr = edgeResponse.needsOcr || false;
    } catch (err: any) {
      // Fallback: for Markdown, try client-side processing
      if (book.document_type === 'markdown') {
        try {
          const response = await fetch(book.document_url!);
          if (response.ok) {
            const rawText = await response.text();
            fullText = markdownToPlainText(rawText);
            const fallbackChapters = extractChapters(fullText);
            edgeChapters = fallbackChapters.map((c, i) => ({
              title: c.title,
              order_index: i,
              content: `<p>${c.content}</p>`,
            }));
          }
        } catch (fallbackErr: any) {
          result.error = `Text extraction failed: ${fallbackErr?.message || 'Unknown error'}`;
          onProgress?.({
            stage: 'error',
            progress: 0,
            message: result.error,
          });
          return result;
        }
      } else {
        result.error = `Text extraction failed: ${err?.message || 'Unknown error'}`;
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

    // Stage 2: Create chapters with content (batch insert)
    onProgress?.({
      stage: 'chapters',
      progress: 30,
      message: `Creating ${edgeChapters.length} chapters...`,
    });

    const chapterInserts = edgeChapters.map((edgeChapter) => ({
      book_id: book.id,
      title: edgeChapter.title,
      order_index: edgeChapter.order_index,
      content: edgeChapter.content || null,
      page_start: edgeChapter.page_start || null,
      page_end: edgeChapter.page_end || null,
    }));

    const { data: createdChaptersData, error: chaptersError } = await supabase
      .from('book_chapters')
      .insert(chapterInserts)
      .select();

    let chaptersCreated = 0;
    let createdChapters: BookChapter[] = [];

    if (!chaptersError && createdChaptersData) {
      chaptersCreated = createdChaptersData.length;
      createdChapters = createdChaptersData;
    }

    // If no chapters detected, create a single chapter
    if (chaptersCreated === 0) {
      const { data, error } = await supabase
        .from('book_chapters')
        .insert({
          book_id: book.id,
          title: 'Full Document',
          order_index: 0,
          content: `<p>${fullText}</p>`,
        })
        .select();

      if (!error && data) {
        chaptersCreated = 1;
        createdChapters.push(...data);
      }
    }

    result.chaptersCreated = chaptersCreated;

    // Update book metadata
    await supabase
      .from('books')
      .update({
        processing_status: 'completed',
        total_chapters: chaptersCreated,
        total_pages: totalPages || null,
        content_format: book.document_type === 'pdf' ? 'reflow' : 'reflow',
      })
      .eq('id', book.id);

    // Stage 3: Generate segments for TTS (batch insert)
    onProgress?.({
      stage: 'segments',
      progress: 60,
      message: 'Generating text segments for TTS...',
    });

    const sentences = splitIntoSentences(fullText);
    let currentTime = 0;
    const speechRate = 1.0;

    const chapterList = createdChapters.sort((a, b) => a.order_index - b.order_index);

    // Build all segments first
    const segmentInserts = sentences.map((sentence, i) => {
      const estimatedDuration = estimateTTSDuration(sentence, speechRate);
      const startTime = currentTime;
      const endTime = currentTime + estimatedDuration;
      currentTime = endTime;

      // Determine which chapter this sentence belongs to
      let currentChapter = chapterList[0] || null;
      for (const ch of chapterList) {
        if (fullText.indexOf(ch.title) !== -1) {
          currentChapter = ch;
        }
      }

      return {
        book_id: book.id,
        chapter_id: currentChapter?.id || null,
        text: sentence,
        audio_url: null,
        start_time: startTime,
        end_time: endTime,
        page_number: null,
        order_index: i,
      };
    });

    // Batch insert segments in chunks of 100 to avoid payload size limits
    const chunkSize = 100;
    let segmentsCreated = 0;
    for (let i = 0; i < segmentInserts.length; i += chunkSize) {
      const chunk = segmentInserts.slice(i, i + chunkSize) as any[];
      const { error } = await supabase.from('audio_segments').insert(chunk);
      if (!error) {
        segmentsCreated += chunk.length;
      }
    }

    result.segmentsCreated = segmentsCreated;

    // Stage 4: Generate alignments (batch insert)
    onProgress?.({
      stage: 'alignments',
      progress: 85,
      message: 'Generating synchronization alignments...',
    });

    currentTime = 0;

    // Build all alignments first
    const alignmentInserts = sentences.map((sentence) => {
      const estimatedDuration = estimateTTSDuration(sentence, speechRate);
      const startTime = currentTime;
      const endTime = currentTime + estimatedDuration;
      currentTime = endTime;

      // Find text offset in full text
      const textOffsetStart = fullText.indexOf(sentence);
      const textOffsetEnd = textOffsetStart >= 0 ? textOffsetStart + sentence.length : null;

      return {
        book_id: book.id,
        segment_id: null,
        chapter_id: null,
        text: sentence,
        start_time: startTime,
        end_time: endTime,
        page_number: null,
        text_offset_start: textOffsetStart >= 0 ? textOffsetStart : null,
        text_offset_end: textOffsetEnd,
      };
    });

    // Batch insert alignments in chunks of 100
    let alignmentsCreated = 0;
    for (let i = 0; i < alignmentInserts.length; i += chunkSize) {
      const chunk = alignmentInserts.slice(i, i + chunkSize) as any[];
      const { error } = await supabase.from('audio_alignments').insert(chunk);
      if (!error) {
        alignmentsCreated += chunk.length;
      }
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

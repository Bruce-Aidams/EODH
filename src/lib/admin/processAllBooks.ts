import { supabase } from '@/lib/supabase/client';
import { processDocument } from './textProcessing';
import type { Book } from '@/types';
import type { ProcessingProgress } from './textProcessing';

/**
 * Fetch all books that need processing for reflow reading.
 * A book needs processing if it has no chapters or has a failed/pending status.
 */
export async function fetchUnprocessedBooks(): Promise<Book[]> {
  // Get all books with document types that need processing
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, document_type, document_url, processing_status, total_chapters')
    .in('document_type', ['pdf', 'epub', 'docx', 'markdown'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch books:', error);
    return [];
  }

  if (!books) return [];

  // Filter to only books that need processing
  const unprocessed: Book[] = [];

  for (const book of books) {
    // Check if book has chapters
    const { count, error: chapterError } = await supabase
      .from('book_chapters')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', book.id);

    if (chapterError) {
      console.error(`Failed to check chapters for book ${book.id}:`, chapterError);
      continue;
    }

    // Book needs processing if:
    // 1. No chapters exist, OR
    // 2. Processing status is 'failed' or 'pending'
    const needsProcessing = 
      count === 0 || 
      book.processing_status === 'failed' || 
      book.processing_status === 'pending';

    if (needsProcessing) {
      unprocessed.push(book as Book);
    }
  }

  return unprocessed;
}

/**
 * Process all unprocessed books for reflow reading.
 * This is a batch operation that processes books one by one.
 */
export async function processAllBooks(
  onProgress?: (bookIndex: number, totalBooks: number, bookTitle: string, stage: string) => void
): Promise<{ processed: number; failed: number; errors: string[] }> {
  const unprocessedBooks = await fetchUnprocessedBooks();
  const totalBooks = unprocessedBooks.length;

  if (totalBooks === 0) {
    console.log('No books need processing.');
    return { processed: 0, failed: 0, errors: [] };
  }

  console.log(`Found ${totalBooks} books to process.`);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < unprocessedBooks.length; i++) {
    const book = unprocessedBooks[i];
    
    try {
      onProgress?.(i, totalBooks, book.title, 'Starting processing...');

      // Process the document using the existing processDocument function
      const result = await processDocument(book, (progress) => {
        onProgress?.(i, totalBooks, book.title, progress.message);
      });

      if (result.chaptersCreated > 0) {
        processed++;
        onProgress?.(i, totalBooks, book.title, `✓ Processed: ${result.chaptersCreated} chapters`);
      } else {
        failed++;
        errors.push(`${book.title}: No chapters created`);
      }
    } catch (err) {
      failed++;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${book.title}: ${errorMsg}`);
      onProgress?.(i, totalBooks, book.title, `✗ Failed: ${errorMsg}`);
    }
  }

  return { processed, failed, errors };
}

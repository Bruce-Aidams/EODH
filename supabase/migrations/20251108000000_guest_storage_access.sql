-- =====================================================
-- EODH – Guest Access to Uploaded Content
-- Grants anonymous (guest) users read access to storage
-- and ensures all content tables are accessible without auth
-- =====================================================

-- =====================================================
-- 1. GRANT anon role SELECT on storage.objects
-- =====================================================
-- The anon Postgres role is used when accessing Supabase
-- with the anon key (unauthenticated requests).
-- Without this grant, guest users cannot read storage files
-- even if RLS policies allow it.
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT ON storage.objects TO anon;

-- =====================================================
-- 2. Ensure storage buckets are public
-- =====================================================
UPDATE storage.buckets SET public = true WHERE id IN ('covers', 'documents', 'audiobooks');

-- =====================================================
-- 3. Ensure anon role can query content tables
-- =====================================================
-- Grant anon role SELECT on all content-related tables
-- so guest users can browse books, chapters, and audio
GRANT SELECT ON books TO anon;
GRANT SELECT ON book_chapters TO anon;
GRANT SELECT ON book_documents TO anon;
GRANT SELECT ON book_categories TO anon;
GRANT SELECT ON audio_books TO anon;
GRANT SELECT ON audio_segments TO anon;
GRANT SELECT ON audio_transcripts TO anon;
GRANT SELECT ON audio_alignments TO anon;
GRANT SELECT ON book_processing_jobs TO anon;
GRANT SELECT ON profiles TO anon;

-- =====================================================
-- 4. Ensure RLS policies explicitly allow anon access
-- =====================================================
-- For tables where published content should be visible to guests,
-- add explicit policies for the anon role if they don't exist.
-- The existing policies use USING (true) or USING (is_published = true)
-- which work for anon, but we add explicit anon policies as a safeguard.

-- Books: anon can view published books
DROP POLICY IF EXISTS "Guests can view published books" ON books;
CREATE POLICY "Guests can view published books"
  ON books FOR SELECT TO anon USING (is_published = true);

-- Book chapters: anon can view chapters of published books
DROP POLICY IF EXISTS "Guests can view chapters of published books" ON book_chapters;
CREATE POLICY "Guests can view chapters of published books"
  ON book_chapters FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_chapters.book_id AND books.is_published = true)
  );

-- Book documents: anon can view documents of published books
DROP POLICY IF EXISTS "Guests can view documents of published books" ON book_documents;
CREATE POLICY "Guests can view documents of published books"
  ON book_documents FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_documents.book_id AND books.is_published = true)
  );

-- Audio books: anon can view audio of published books
DROP POLICY IF EXISTS "Guests can view audio of published books" ON audio_books;
CREATE POLICY "Guests can view audio of published books"
  ON audio_books FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_books.book_id AND books.is_published = true)
  );

-- Audio segments: anon can view segments of published books
DROP POLICY IF EXISTS "Guests can view segments of published books" ON audio_segments;
CREATE POLICY "Guests can view segments of published books"
  ON audio_segments FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_segments.book_id AND books.is_published = true)
  );

-- Audio transcripts: anon can view transcripts of published books
DROP POLICY IF EXISTS "Guests can view transcripts of published books" ON audio_transcripts;
CREATE POLICY "Guests can view transcripts of published books"
  ON audio_transcripts FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_transcripts.book_id AND books.is_published = true)
  );

-- Audio alignments: anon can view alignments of published books
DROP POLICY IF EXISTS "Guests can view alignments of published books" ON audio_alignments;
CREATE POLICY "Guests can view alignments of published books"
  ON audio_alignments FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_alignments.book_id AND books.is_published = true)
  );

-- Book categories: anon can view all categories
DROP POLICY IF EXISTS "Guests can view categories" ON book_categories;
CREATE POLICY "Guests can view categories"
  ON book_categories FOR SELECT TO anon USING (true);

-- Book processing jobs: anon can view jobs for published books
DROP POLICY IF EXISTS "Guests can view processing jobs" ON book_processing_jobs;
CREATE POLICY "Guests can view processing jobs"
  ON book_processing_jobs FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_processing_jobs.book_id AND books.is_published = true)
  );

-- =====================================================
-- 5. Storage objects: explicit anon read policy
-- =====================================================
-- Allow anon role to read from public storage buckets
DROP POLICY IF EXISTS "Guests can read storage objects" ON storage.objects;
CREATE POLICY "Guests can read storage objects"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id IN ('covers', 'documents', 'audiobooks'));

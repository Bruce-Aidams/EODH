-- =====================================================
-- EODH – Multi-Format Ebook Support Migration
-- Adds EPUB, DOCX support and processing tracking
-- =====================================================

-- =====================================================
-- 1. EXTEND BOOKS TABLE
-- =====================================================

-- Extend document_type CHECK constraint to include 'epub' and 'docx'
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_document_type_check;
ALTER TABLE books ADD CONSTRAINT books_document_type_check
  CHECK (document_type IN ('pdf', 'markdown', 'epub', 'docx'));

-- Add processing_status column
ALTER TABLE books ADD COLUMN IF NOT EXISTS processing_status TEXT
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
  DEFAULT 'pending';

-- Add total_chapters column
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

-- Add total_pages column
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages INTEGER;

-- Add content_format column (original vs reflow default view)
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_format TEXT
  CHECK (content_format IN ('original', 'reflow'))
  DEFAULT 'original';

-- Set existing books to completed processing status
UPDATE books SET processing_status = 'completed' WHERE processing_status IS NULL OR processing_status = 'pending';

-- =====================================================
-- 2. EXTEND BOOK_DOCUMENTS TABLE
-- =====================================================

-- Extend file_type CHECK constraint
ALTER TABLE book_documents DROP CONSTRAINT IF EXISTS book_documents_file_type_check;
ALTER TABLE book_documents ADD CONSTRAINT book_documents_file_type_check
  CHECK (file_type IN ('pdf', 'markdown', 'epub', 'docx'));

-- =====================================================
-- 3. EXTEND BOOK_CHAPTERS TABLE
-- =====================================================

-- Add content column for extracted HTML content
ALTER TABLE book_chapters ADD COLUMN IF NOT EXISTS content TEXT;

-- Add page_start and page_end for PDF page references
ALTER TABLE book_chapters ADD COLUMN IF NOT EXISTS page_start INTEGER;
ALTER TABLE book_chapters ADD COLUMN IF NOT EXISTS page_end INTEGER;

-- =====================================================
-- 4. CREATE BOOK_PROCESSING_JOBS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS book_processing_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  progress_percent DOUBLE PRECISION DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processing_jobs_book ON book_processing_jobs(book_id);
CREATE INDEX idx_processing_jobs_status ON book_processing_jobs(status);

-- =====================================================
-- 5. ROW LEVEL SECURITY FOR NEW TABLE
-- =====================================================

ALTER TABLE book_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Published book processing jobs are readable by everyone (including guests)
CREATE POLICY "Processing jobs viewable with published books"
  ON book_processing_jobs FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_processing_jobs.book_id AND books.is_published = true)
  );

-- Admins can view all processing jobs
CREATE POLICY "Admins can view all processing jobs"
  ON book_processing_jobs FOR SELECT USING (is_admin(auth.uid()));

-- Only admins can insert processing jobs
CREATE POLICY "Admins can insert processing jobs"
  ON book_processing_jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Only admins can update processing jobs
CREATE POLICY "Admins can update processing jobs"
  ON book_processing_jobs FOR UPDATE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Only admins can delete processing jobs
CREATE POLICY "Admins can delete processing jobs"
  ON book_processing_jobs FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- =====================================================
-- 6. INDEXES FOR FREQUENTLY QUERIED COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_books_processing_status ON books(processing_status);
CREATE INDEX IF NOT EXISTS idx_books_content_format ON books(content_format);
CREATE INDEX IF NOT EXISTS idx_chapters_content ON book_chapters USING gin(to_tsvector('english', COALESCE(content, '')));

-- =====================================================
-- EODH – AI Summaries
-- Database table for AI-generated book and chapter summaries
-- =====================================================

-- =====================================================
-- AI SUMMARIES
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('book_overview', 'chapter_summary', 'key_takeaways', 'comprehension_questions', 'flashcards')),
  content JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  token_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id, chapter_id, summary_type)
);

CREATE INDEX idx_ai_summaries_book ON ai_summaries(book_id);
CREATE INDEX idx_ai_summaries_chapter ON ai_summaries(chapter_id);
CREATE INDEX idx_ai_summaries_type ON ai_summaries(summary_type);

-- RLS policies
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- Anyone can read summaries (including guests)
CREATE POLICY "Anyone can view AI summaries"
  ON ai_summaries
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete summaries
CREATE POLICY "Admins can insert AI summaries"
  ON ai_summaries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update AI summaries"
  ON ai_summaries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete AI summaries"
  ON ai_summaries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- BOOK AI STATUS COLUMNS
-- =====================================================
-- Add columns to track AI summary generation status on books
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'has_ai_summary'
  ) THEN
    ALTER TABLE books ADD COLUMN has_ai_summary BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'ai_summary_status'
  ) THEN
    ALTER TABLE books ADD COLUMN ai_summary_status TEXT CHECK (ai_summary_status IN ('pending', 'generating', 'completed', 'failed')) DEFAULT 'pending';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_books_ai_summary ON books(has_ai_summary);

-- =====================================================
-- EODH – Exposition Of Damnable Heresies
-- Supabase PostgreSQL Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    'reader'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. USER ROLES (for fine-grained admin control)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- =====================================================
-- 3. BOOK CATEGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS book_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. BOOKS
-- =====================================================
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES book_categories(id),
  cover_url TEXT,
  document_url TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('pdf', 'markdown')),
  file_size BIGINT,
  language TEXT NOT NULL DEFAULT 'en',
  publication_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  has_audio BOOLEAN NOT NULL DEFAULT false,
  audio_type TEXT CHECK (audio_type IN ('tts', 'prerecorded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_published ON books(is_published);
CREATE INDEX idx_books_category ON books(category_id);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);

-- =====================================================
-- 5. BOOK CHAPTERS
-- =====================================================
CREATE TABLE IF NOT EXISTS book_chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id, order_index)
);

CREATE INDEX idx_chapters_book ON book_chapters(book_id);

-- =====================================================
-- 6. BOOK DOCUMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS book_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'markdown')),
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 7. AUDIO BOOKS
-- =====================================================
CREATE TABLE IF NOT EXISTS audio_books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  audio_type TEXT NOT NULL CHECK (audio_type IN ('tts', 'prerecorded')),
  total_duration DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id)
);

-- =====================================================
-- 8. AUDIO SEGMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS audio_segments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  audio_url TEXT,
  start_time DOUBLE PRECISION NOT NULL,
  end_time DOUBLE PRECISION NOT NULL,
  page_number INTEGER,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segments_book ON audio_segments(book_id);
CREATE INDEX idx_segments_time ON audio_segments(start_time, end_time);

-- =====================================================
-- 9. AUDIO TRANSCRIPTS
-- =====================================================
CREATE TABLE IF NOT EXISTS audio_transcripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  transcript_url TEXT,
  format TEXT CHECK (format IN ('srt', 'vtt', 'txt')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 10. AUDIO ALIGNMENTS (sync data)
-- =====================================================
CREATE TABLE IF NOT EXISTS audio_alignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  segment_id UUID REFERENCES audio_segments(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_time DOUBLE PRECISION NOT NULL,
  end_time DOUBLE PRECISION NOT NULL,
  page_number INTEGER,
  text_offset_start INTEGER,
  text_offset_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alignments_book ON audio_alignments(book_id);
CREATE INDEX idx_alignments_time ON audio_alignments(start_time, end_time);

-- =====================================================
-- 11. BOOKMARKS
-- =====================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  page_number INTEGER,
  text_excerpt TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_book ON bookmarks(book_id);

-- =====================================================
-- 12. HIGHLIGHTS
-- =====================================================
CREATE TABLE IF NOT EXISTS highlights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  page_number INTEGER,
  text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FFC928',
  note TEXT,
  text_offset_start INTEGER,
  text_offset_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_highlights_user ON highlights(user_id);
CREATE INDEX idx_highlights_book ON highlights(book_id);

-- =====================================================
-- 13. NOTES
-- =====================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  page_number INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_book ON notes(book_id);

-- =====================================================
-- 14. READING PROGRESS
-- =====================================================
CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  page_number INTEGER,
  progress_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  text_offset INTEGER,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_reading_progress_user ON reading_progress(user_id);
CREATE INDEX idx_reading_progress_book ON reading_progress(book_id);

-- =====================================================
-- 15. LISTENING PROGRESS
-- =====================================================
CREATE TABLE IF NOT EXISTS listening_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES audio_segments(id) ON DELETE SET NULL,
  current_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  progress_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_listened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_listening_progress_user ON listening_progress(user_id);
CREATE INDEX idx_listening_progress_book ON listening_progress(book_id);

-- =====================================================
-- 16. USER PREFERENCES
-- =====================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  font_family TEXT NOT NULL DEFAULT 'System',
  font_size INTEGER NOT NULL DEFAULT 18,
  line_spacing DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  text_alignment TEXT NOT NULL DEFAULT 'justify' CHECK (text_alignment IN ('left', 'center', 'justify')),
  background_color TEXT NOT NULL DEFAULT '#F6F5FC',
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'sepia', 'system')),
  reading_margins INTEGER NOT NULL DEFAULT 16,
  playback_speed DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  sleep_timer_minutes INTEGER,
  default_voice TEXT NOT NULL DEFAULT 'system',
  enable_background_playback BOOLEAN NOT NULL DEFAULT true,
  reading_settings JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- 17. DOWNLOADS
-- =====================================================
CREATE TABLE IF NOT EXISTS downloads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'audio', 'cover')),
  local_path TEXT,
  is_downloaded BOOLEAN NOT NULL DEFAULT false,
  download_progress DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id, file_type)
);

CREATE INDEX idx_downloads_user ON downloads(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES: Users can read all, update own
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- BOOKS: Published books are readable by all, admins can manage
CREATE POLICY "Published books are viewable by everyone"
  ON books FOR SELECT USING (is_published = true OR is_admin(auth.uid()));

CREATE POLICY "Admins can insert books"
  ON books FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update books"
  ON books FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete books"
  ON books FOR DELETE USING (is_admin(auth.uid()));

-- BOOK CHAPTERS: Viewable with books
CREATE POLICY "Chapters viewable with published books"
  ON book_chapters FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_chapters.book_id AND books.is_published = true)
    OR is_admin(auth.uid())
  );

CREATE POLICY "Admins can manage chapters"
  ON book_chapters FOR ALL USING (is_admin(auth.uid()));

-- AUDIO SEGMENTS: Viewable with published books
CREATE POLICY "Segments viewable with published books"
  ON audio_segments FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_segments.book_id AND books.is_published = true)
    OR is_admin(auth.uid())
  );

CREATE POLICY "Admins can manage segments"
  ON audio_segments FOR ALL USING (is_admin(auth.uid()));

-- AUDIO ALIGNMENTS: Viewable with published books
CREATE POLICY "Alignments viewable with published books"
  ON audio_alignments FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_alignments.book_id AND books.is_published = true)
    OR is_admin(auth.uid())
  );

CREATE POLICY "Admins can manage alignments"
  ON audio_alignments FOR ALL USING (is_admin(auth.uid()));

-- BOOKMARKS: Users can manage their own
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- HIGHLIGHTS: Users can manage their own
CREATE POLICY "Users can view own highlights"
  ON highlights FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON highlights FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON highlights FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON highlights FOR DELETE USING (auth.uid() = user_id);

-- NOTES: Users can manage their own
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE USING (auth.uid() = user_id);

-- READING PROGRESS: Users can manage their own
CREATE POLICY "Users can manage own reading progress"
  ON reading_progress FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- LISTENING PROGRESS: Users can manage their own
CREATE POLICY "Users can manage own listening progress"
  ON listening_progress FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- USER PREFERENCES: Users can manage their own
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DOWNLOADS: Users can manage their own
CREATE POLICY "Users can manage own downloads"
  ON downloads FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- BOOK CATEGORIES: Viewable by all, managed by admins
CREATE POLICY "Categories viewable by everyone"
  ON book_categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories"
  ON book_categories FOR ALL USING (is_admin(auth.uid()));

-- =====================================================
-- SEED DATA (Development only)
-- =====================================================

-- Seed categories
INSERT INTO book_categories (name, description) VALUES
  ('Theology', 'Works on theological topics'),
  ('Philosophy', 'Philosophical works and treatises'),
  ('History', 'Historical accounts and analysis'),
  ('Science', 'Scientific works and research'),
  ('Literature', 'Literary works and essays')
ON CONFLICT (name) DO NOTHING;

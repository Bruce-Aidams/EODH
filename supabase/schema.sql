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
  document_type TEXT NOT NULL CHECK (document_type IN ('pdf', 'markdown', 'epub', 'docx')),
  file_size BIGINT,
  language TEXT NOT NULL DEFAULT 'en',
  publication_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT true,
  has_audio BOOLEAN NOT NULL DEFAULT false,
  audio_type TEXT CHECK (audio_type IN ('tts', 'prerecorded')),
  processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  total_chapters INTEGER DEFAULT 0,
  total_pages INTEGER,
  content_format TEXT CHECK (content_format IN ('original', 'reflow')) DEFAULT 'original',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_published ON books(is_published);
CREATE INDEX idx_books_category ON books(category_id);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_processing_status ON books(processing_status);
CREATE INDEX idx_books_content_format ON books(content_format);

-- =====================================================
-- 5. BOOK CHAPTERS
-- =====================================================
CREATE TABLE IF NOT EXISTS book_chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  content TEXT,
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id, order_index)
);

CREATE INDEX idx_chapters_book ON book_chapters(book_id);

-- =====================================================
-- 5b. BOOK PROCESSING JOBS
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
-- 6. BOOK DOCUMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS book_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'markdown', 'epub', 'docx')),
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
  audio_url TEXT,
  total_duration DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
ALTER TABLE book_processing_jobs ENABLE ROW LEVEL SECURITY;

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

-- PROFILES: Users can read all, update own, admins can delete
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOKS: Published books are readable by everyone (including anonymous/guest users)
-- Admins can manage all books
CREATE POLICY "Published books are viewable by everyone including guests"
  ON books FOR SELECT USING (is_published = true);

CREATE POLICY "Guests can view published books"
  ON books FOR SELECT TO anon USING (is_published = true);

CREATE POLICY "Admins can view all books"
  ON books FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert books"
  ON books FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update books"
  ON books FOR UPDATE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete books"
  ON books FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOK CHAPTERS: Viewable with published books (including guests)
CREATE POLICY "Chapters viewable with published books including guests"
  ON book_chapters FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_chapters.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view chapters of published books"
  ON book_chapters FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_chapters.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage chapters"
  ON book_chapters FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOK DOCUMENTS: Viewable with published books (including guests)
CREATE POLICY "Documents viewable with published books including guests"
  ON book_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_documents.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view documents of published books"
  ON book_documents FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_documents.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage documents"
  ON book_documents FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- AUDIO BOOKS: Viewable with published books (including guests)
CREATE POLICY "Audio books viewable with published books including guests"
  ON audio_books FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_books.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view audio of published books"
  ON audio_books FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_books.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage audio books"
  ON audio_books FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- AUDIO SEGMENTS: Viewable with published books (including guests)
CREATE POLICY "Segments viewable with published books including guests"
  ON audio_segments FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_segments.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view segments of published books"
  ON audio_segments FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_segments.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage segments"
  ON audio_segments FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- AUDIO TRANSCRIPTS: Viewable with published books (including guests)
CREATE POLICY "Transcripts viewable with published books including guests"
  ON audio_transcripts FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_transcripts.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view transcripts of published books"
  ON audio_transcripts FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_transcripts.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage transcripts"
  ON audio_transcripts FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- AUDIO ALIGNMENTS: Viewable with published books (including guests)
CREATE POLICY "Alignments viewable with published books including guests"
  ON audio_alignments FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_alignments.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view alignments of published books"
  ON audio_alignments FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = audio_alignments.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can manage alignments"
  ON audio_alignments FOR ALL USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOKMARKS: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Admins can delete any bookmark" ON bookmarks;

CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any bookmark"
  ON bookmarks FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- HIGHLIGHTS: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can view own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can insert own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can update own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can delete own highlights" ON highlights;
DROP POLICY IF EXISTS "Admins can delete any highlight" ON highlights;

CREATE POLICY "Users can view own highlights"
  ON highlights FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON highlights FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON highlights FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON highlights FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any highlight"
  ON highlights FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- NOTES: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Admins can delete any note" ON notes;

CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any note"
  ON notes FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- READING PROGRESS: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can manage own reading progress" ON reading_progress;
DROP POLICY IF EXISTS "Admins can delete any reading progress" ON reading_progress;

CREATE POLICY "Users can manage own reading progress"
  ON reading_progress FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any reading progress"
  ON reading_progress FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- LISTENING PROGRESS: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can manage own listening progress" ON listening_progress;
DROP POLICY IF EXISTS "Admins can delete any listening progress" ON listening_progress;

CREATE POLICY "Users can manage own listening progress"
  ON listening_progress FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any listening progress"
  ON listening_progress FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- USER PREFERENCES: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Admins can delete any preferences" ON user_preferences;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any preferences"
  ON user_preferences FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- DOWNLOADS: Users can manage their own, admins can delete any
DROP POLICY IF EXISTS "Users can manage own downloads" ON downloads;
DROP POLICY IF EXISTS "Admins can delete any downloads" ON downloads;

CREATE POLICY "Users can manage own downloads"
  ON downloads FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any downloads"
  ON downloads FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOK CATEGORIES: Viewable by all, managed by admins
CREATE POLICY "Categories viewable by everyone"
  ON book_categories FOR SELECT USING (true);

CREATE POLICY "Guests can view categories"
  ON book_categories FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can insert categories"
  ON book_categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update categories"
  ON book_categories FOR UPDATE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete categories"
  ON book_categories FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- USER ROLES: Only admins can manage
CREATE POLICY "Admins can view user roles"
  ON user_roles FOR SELECT USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can insert user roles"
  ON user_roles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update user roles"
  ON user_roles FOR UPDATE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete user roles"
  ON user_roles FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- BOOK PROCESSING JOBS: Published book jobs readable by all, admin-only write
CREATE POLICY "Processing jobs viewable with published books"
  ON book_processing_jobs FOR SELECT USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_processing_jobs.book_id AND books.is_published = true)
  );

CREATE POLICY "Guests can view processing jobs"
  ON book_processing_jobs FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM books WHERE books.id = book_processing_jobs.book_id AND books.is_published = true)
  );

CREATE POLICY "Admins can view all processing jobs"
  ON book_processing_jobs FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert processing jobs"
  ON book_processing_jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update processing jobs"
  ON book_processing_jobs FOR UPDATE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete processing jobs"
  ON book_processing_jobs FOR DELETE USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- =====================================================
-- STORAGE BUCKETS & RLS POLICIES
-- =====================================================
-- Create storage buckets (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('covers', 'covers', true),
  ('documents', 'documents', true),
  ('audiobooks', 'audiobooks', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant anon role access to storage schema and objects
-- This is required for unauthenticated (guest) users to access public storage files
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT ON storage.objects TO anon;

-- Drop existing policies to avoid conflicts on re-apply
DROP POLICY IF EXISTS "Covers are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete covers" ON storage.objects;
DROP POLICY IF EXISTS "Documents are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Audiobooks are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload audiobooks" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update audiobooks" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete audiobooks" ON storage.objects;
-- Also drop old policy names if they exist from previous schema versions
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audiobooks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audiobooks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audiobooks" ON storage.objects;

-- Covers: Public read, admin-only write and delete
CREATE POLICY "Covers are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

CREATE POLICY "Admins can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Documents: Public read, admin-only write and delete
CREATE POLICY "Documents are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Audiobooks: Public read, admin-only write and delete
CREATE POLICY "Audiobooks are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audiobooks');

CREATE POLICY "Admins can upload audiobooks"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audiobooks' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can update audiobooks"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audiobooks' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete audiobooks"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audiobooks' AND auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Guest (anon) access to all public storage buckets
CREATE POLICY "Guests can read storage objects"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id IN ('covers', 'documents', 'audiobooks'));

-- =====================================================
-- SEED DATA (Development only)
-- =====================================================

-- Seed categories
INSERT INTO book_categories (name, description) VALUES
  ('The First Martyr for Malachi 4:5-6', 'The First Martyr for Malachi 4:5-6'),
  ('Book 1 Bars of Interpretations', 'Book 1 Bars of Interpretations'),
  ('Book 2 Mamba Snake At The Jordan', 'Book 2 Mamba Snake At The Jordan'),
  ('Book 3 False Anointed Ones', 'Book 3 False Anointed Ones'),
  ('Book 4 Five Major Doctrinal Divisions - Message Believers', 'Book 4 Five Major Doctrinal Divisions - Message Believers'),
  ('Book 5 Seventh Seal / Seven Thunders Two Schools of Thought', 'Book 5 Seventh Seal / Seven Thunders Two Schools of Thought'),
  ('Book 6 Holiness Message Standards, False Thunders Failed', 'Book 6 Holiness Message Standards, False Thunders Failed'),
  ('Book 7 Twenty First Century Harvest of Souls Versus Unbelief', 'Book 7 Twenty First Century Harvest of Souls Versus Unbelief'),
  ('Book 8 Identifications 7 Thunders Ministry versus Impersonators', 'Book 8 Identifications 7 Thunders Ministry versus Impersonators'),
  ('Book 9 Questions and Answers -Controversies- 7th Seal - 7 Thunders - Godhead - Deity and Resurrection Heresy', 'Book 9 Questions and Answers -Controversies- 7th Seal - 7 Thunders - Godhead - Deity and Resurrection Heresy'),
  ('Book 10 Shepherds - Hirelings - Wolves - Goats & The Sheep', 'Book 10 Shepherds - Hirelings - Wolves - Goats & The Sheep'),
  ('Book 11 7 Seals Related Heresies: What, Who, Why & When? Versus The True Revelation - Questions and Answers', 'Book 11 7 Seals Related Heresies: What, Who, Why & When? Versus The True Revelation - Questions and Answers'),
  ('Book 12 7 Thunders Heresies Versus The Real Program of God', 'Book 12 7 Thunders Heresies Versus The Real Program of God'),
  ('Book 13 7 Thunders Questions & Answers & More - "EODH Challenged', 'Book 13 7 Thunders Questions & Answers & More - "EODH Challenged'),
  ('Book 14 The Final Outpouring Of The Holy Ghost For Rapture Power', 'Book 14 The Final Outpouring Of The Holy Ghost For Rapture Power'),
  ('Book 15 Pentecostalism, 100 years, Versus Pentecost - The Final Outpouring of The Holy Ghost For Rapture Power', 'Book 15 Pentecostalism, 100 years, Versus Pentecost - The Final Outpouring of The Holy Ghost For Rapture Power'),
  ('Book 16 Pentecostalism Under The Message Versus The Joshua Generation', 'Book 16 Pentecostalism Under The Message Versus The Joshua Generation'),
  ('Book 17 Final Preparation For The Final Outpouring & Rapturing Power', 'Book 17 Final Preparation For The Final Outpouring & Rapturing Power'),
  ('Book 18 7 Church Age Book - Heresies Injected, Dr. Vayle’s & Kocourek’s Heresies Exposed', 'Book 18 7 Church Age Book - Heresies Injected, Dr. Vayle’s & Kocourek’s Heresies Exposed'),
  ('Book 19 Self And Satanic Delusions: Pride, Ambition & Demon Possession – Bethel & G.C.C. Experiences', 'Book 19 Self And Satanic Delusions: Pride, Ambition & D Possession – Bethel & G.C.C. Experiences'),
  ('Book 20 John Tay & James Andah, EODH Exposition of Their Heresies', 'Book 20 John Tay & James Andah, EODH Exposition of Their Heresies')
ON CONFLICT (name) DO NOTHING;

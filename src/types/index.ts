// Core entity types for the EODH application

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: 'reader' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category_id: string | null;
  cover_url: string | null;
  document_url: string | null;
  document_type: 'pdf' | 'markdown' | 'epub' | 'docx';
  file_size: number | null;
  language: string;
  publication_date: string | null;
  is_published: boolean;
  has_audio: boolean;
  audio_type: 'tts' | 'prerecorded' | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  total_chapters: number | null;
  total_pages: number | null;
  content_format: 'original' | 'reflow' | null;
  created_at: string;
  updated_at: string;
}

export interface BookCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface BookChapter {
  id: string;
  book_id: string;
  title: string;
  order_index: number;
  content: string | null;
  page_start: number | null;
  page_end: number | null;
  created_at: string;
}

export interface AudioSegment {
  id: string;
  book_id: string;
  chapter_id: string | null;
  text: string;
  audio_url: string | null;
  start_time: number;
  end_time: number;
  page_number: number | null;
  order_index: number;
  created_at: string;
}

export interface AudioAlignment {
  id: string | undefined;
  segment_id: string | null;
  book_id: string;
  chapter_id: string | null;
  text: string;
  start_time: number;
  end_time: number;
  page_number: number | null;
  text_offset_start: number | null;
  text_offset_end: number | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  page_number: number | null;
  text_excerpt: string | null;
  note: string | null;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  page_number: number | null;
  text: string;
  color: string;
  note: string | null;
  text_offset_start: number | null;
  text_offset_end: number | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  page_number: number | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  page_number: number | null;
  progress_percent: number;
  text_offset: number | null;
  last_read_at: string;
  updated_at: string;
}

export interface ListeningProgress {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  segment_id: string | null;
  current_time: number;
  progress_percent: number;
  last_listened_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  font_family: string;
  font_size: number;
  line_spacing: number;
  text_alignment: 'left' | 'center' | 'justify';
  background_color: string;
  theme: 'light' | 'dark' | 'system';
  reading_margins: number;
  playback_speed: number;
  sleep_timer_minutes: number | null;
  updated_at: string;
}

export interface BookProcessingJob {
  id: string;
  book_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  progress_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Download {
  id: string;
  user_id: string;
  book_id: string;
  file_type: 'document' | 'audio' | 'cover';
  local_path: string | null;
  is_downloaded: boolean;
  download_progress: number;
  created_at: string;
  updated_at: string;
}

// UI Types
export type TabRoute = 'index' | 'library' | 'audio' | 'notes' | 'more';

export type BookCardProps = {
  book: Book;
  progress?: ReadingProgress | ListeningProgress;
  onPress: (book: Book) => void;
};

export type ReadingSettings = {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  textAlign: 'left' | 'center' | 'justify';
  backgroundColor: string;
  theme: 'light' | 'dark' | 'system' | 'blue';
  margins: number;
};

export type AudioPlaybackState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  currentSegment: AudioSegment | null;
  currentAlignment: AudioAlignment | null;
  bufferStatus: 'buffering' | 'ready' | 'ended';
};

export type SyncState = {
  isSyncing: boolean;
  currentAlignment: AudioAlignment | null;
  highlightedText: string;
  currentPage: number;
  autoScroll: boolean;
};

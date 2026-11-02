# EODH - Progress Tracker

**Project:** EODH - Exposition Of Damnable Heresies
**Tagline:** Read. Listen. Learn.
**Last Updated:** 2026-11-02 (Session: Word-Level Highlighting, Transcript Upload, Env Validation, Seed Data)

---

## Phase 1: Project Structure, Branding, Navigation, Authentication, Database

### Completed
- [x] Expo SDK 58 project initialized with TypeScript and Expo Router
- [x] All dependencies installed (Supabase, Zustand, expo-audio, expo-speech, react-native-pdf-jsi, react-native-paper, @react-native-community/slider, etc.)
- [x] `app.json` configured with plugins (expo-router, expo-secure-store, expo-font, expo-speech, expo-audio, react-native-pdf-jsi, expo-splash-screen)
- [x] `tsconfig.json` with path aliases (`@/*` -> `src/*`)
- [x] `.env.example` with Supabase environment variables
- [x] Brand theme system (`src/constants/theme.ts`) - Deep Navy, Royal Purple, Violet, Gold palette with light/dark themes
- [x] Full TypeScript types (`src/types/index.ts`) - User, Book, AudioSegment, Bookmark, Highlight, Note, ReadingProgress, ListeningProgress, etc.
- [x] Supabase client (`src/lib/supabase/client.ts`) with SecureStore-backed auth
- [x] Zustand store: `authStore` - sign in, sign up, sign out, reset password, profile update, auth check
- [x] Zustand store: `libraryStore` - books, categories, progress, bookmarks, highlights, notes
- [x] Zustand store: `audioStore` - playback state, segments, sync state, speed controls
- [x] Zustand store: `settingsStore` - reading preferences, audio settings, theme
- [x] Database schema (`supabase/schema.sql`) - 17 tables with UUIDs, foreign keys, indexes, triggers, and Row Level Security policies
- [x] App root layout (`app/_layout.tsx`) with auth provider and theme
- [x] Bottom tab navigation (`app/(tabs)/_layout.tsx`) - Home, Library, Audio, Notes, More
- [x] Tab screens: Home (`index.tsx`), Library, Audio, Notes, More
- [x] Admin dashboard index (`app/admin/index.tsx`)
- [x] 404 page (`app/+not-found.tsx`)
- [x] **Auth screens: Sign In** (`app/auth/sign-in/index.tsx`) - email/password, forgot password, show/hide password, validation
- [x] **Auth screens: Sign Up** (`app/auth/sign-up/index.tsx`) - name, email, password with strength indicator, confirm password, validation

### Remaining
- [ ] Supabase project creation and schema migration (manual step)
- [ ] Admin user setup via database (manual step)

---

## Phase 2: Home Dashboard, Digital Library, PDF Reader, Markdown Reader

### Completed
- [x] Home dashboard with personalized welcome, search bar, featured books, recently opened, continue reading, new additions, empty state
- [x] Library screen with search, filter by category, sort (A-Z, Newest, Author), book list with covers
- [x] **Book detail screen** (`app/book/[id]/index.tsx`) - cover, title, author, description, reading/listening progress, favorite toggle, action buttons (Read, Listen, Read Along), **download for offline**
- [x] **Reader screen** (`app/book/[id]/reader/index.tsx`) - content display, page tracking, auto-save progress, reading settings modal (theme: light/dark/sepia, font size, line spacing, text alignment, margins), tap to toggle header
- [x] **Markdown rendering utility** (`src/lib/markdown/renderer.ts`) - markdownToHtml converter, markdownToPlainText extractor, chapter extraction, light/dark theme styles for react-native-render-html
- [x] **Reader updated** to use react-native-render-html for Markdown with proper heading, list, blockquote, code block, table, and image rendering
- [x] **PDF Reader component** (`src/components/PdfReader.tsx`) - native PDF rendering via react-native-pdf-jsi, page navigation, page indicator, loading overlay, error handling
- [x] **Reader screen updated** to conditionally render PdfReader for PDF documents and Markdown renderer for .md files
- [x] `react-native-pdf-jsi` config plugin added to `app.json`

### Remaining
- [x] **PDF text extraction utility** (`src/lib/pdf/extractor.ts`) — PdfTextExtractor class with page-level text extraction, sentence splitting, word position tracking, sync segment generation, alignment generation, OCR detection, and text search
- [ ] PDF text selection, highlighting, bookmarks, notes in PDF reader
- [x] **In-reader bookmark/highlight/note actions** (`app/book/[id]/reader/index.tsx`) — action bar with bookmark, highlight, and note buttons; note modal with color picker; Supabase integration via libraryStore
- [x] **Library store enhanced** (`src/stores/libraryStore.ts`) — added bookmarks, highlights, notes state arrays with reactive updates on add
- [x] **Reader preferences persistence** (`src/stores/settingsStore.ts`) — loadSettings on auth, async setReadingSettings/setAudioSettings/setTheme with Supabase upsert, resetSettings deletes backend record, user_preferences table with reading_settings JSONB column

---

## Phase 3: Audiobook Player, TTS Engine, Background Audio, Audio Progress

### Completed
- [x] **Audio Player Engine** (`src/lib/audio/player.ts`) - expo-audio integration with useCompleteAudioPlayer hook, real play/pause/seek/speed, position tracking, duration tracking, buffering state, playback end detection, error handling
- [x] **Audiobook Player** (`app/book/[id]/audio/index.tsx`) - fully integrated with expo-audio: real audio playback, segment-based chapter playback with auto-advance, global time tracking across segments, progress slider with cross-segment seeking, playback speed control synced to settings store, chapter list with active indicator, buffer status, auto-save listening progress every 5 seconds
- [x] `expo-audio` plugin added to `app.json` for background audio support
- [x] Audio store with playback state management, seek, speed control, segment management
- [x] @react-native-community/slider installed for progress slider
- [x] **TTS Engine** (`src/lib/tts/engine.ts`) - sentence-level segmentation, speak/pause/resume/stop, chunk callbacks for sync, chapter detection from Markdown headings, voice selection support

### Remaining
- [x] **Lock-screen media controls** (`src/lib/audio/mediaControls.ts`) — useMediaControls hook with play/pause/skip/seek/stop, integrated into audio player and sync reader screens
- [x] **Headphone controls** — integrated via media session, automatically routes headphone button events on Android
- [x] **Audio Queue Manager** (`src/lib/audio/queue.ts`) — useAudioQueue hook with enqueue/load segments, play next/previous, shuffle mode, repeat mode (none/all/one), jump to index, queue progress tracking, Fisher-Yates shuffle algorithm
- [x] **Audio Queue UI** (`app/book/[id]/audio/index.tsx`) — shuffle and repeat buttons integrated into playback controls, repeat mode cycles through none/all/one, auto-advance handles shuffle and repeat modes
- [ ] Background playback verification on device
- [ ] TTS two operating modes: device-based TTS for immediate reading, server-generated TTS for persistent audiobook playback
- [ ] TTS segment caching to avoid regenerating the same content
- [x] **Continue Listening section** in Home and Audio tabs with progress bars

---

## Phase 4: Synchronized Reading (MOST IMPORTANT)

### Completed
- [x] **Sync Reader screen** (`app/book/[id]/sync/index.tsx`) - **real audio playback via expo-audio**, sentence highlighting based on current alignment, **auto-scroll to keep highlighted text visible**, playback controls, sync badge indicator, reading settings, no-sync-data overlay message
- [x] Sync state in audioStore (isSyncing, highlightedText, currentPage, autoScroll)
- [x] AudioAlignment type defined in types
- [x] Sync engine foundation: findCurrentAlignment function, updateSyncState, startSync/stopSync
- [x] Auto-save both reading and listening progress during sync
- [x] **Synchronization Engine** (`src/lib/sync/engine.ts`) - reusable independent module with binary search alignment lookup, SRT/WebVTT parsing, TTS-based sync with chunk callbacks, estimated TTS timing generation, sync type detection
- [x] **Sync reader integrated with audio player** - segment-based playback with auto-advance, global time tracking, sync engine callbacks for position changes

### Remaining
- [x] **Word-level highlighting** (`app/book/[id]/sync/index.tsx`) — integrated with sync engine: upgradeToWordLevel on init, currentWord tracking via findCurrentWord, highlightedWordMap for UI, sentence renderer splits into individual words with gold color for current word
- [ ] Support for PDF documents with page-position mapping
- [x] **Admin transcript upload workflow** (`app/admin/audio/index.tsx`) — transcript upload modal with chapter selection chips, SRT/WebVTT file picker, syncEngine parsing, Supabase Storage upload, audio_segments sync_file_url update, audio_alignments database insertion
- [ ] Scanned PDF detection - identify when OCR is required before sync can work

---

## Phase 5: Admin Authentication, Dashboard, Uploads, Book Management, Document Processing

### Completed
- [x] Admin dashboard index scaffolded (`app/admin/index.tsx`) with stats cards and action buttons
- [x] **Admin Overview dashboard** - **real statistics from database** (total books, PDFs, Markdown, audiobooks, readers, recent uploads)
- [x] Admin role in database schema with RLS policies
- [x] Admin navigation guard - redirects non-admins
- [x] **Admin Upload Screen** (`app/admin/upload/index.tsx`) - document type selector (PDF/Markdown), book info form (title, author, description, category, language, publication date), file pickers (cover image, document, audio), Supabase Storage upload with progress, category selection modal
- [x] **Admin Book Management** (`app/admin/books/index.tsx`) - book list with search, preview, publish/unpublish toggle, delete with confirmation, file size display, audio badge
- [x] **Admin Audio Management** (`app/admin/audio/index.tsx`) - audiobook chapter list, upload audio files with Supabase Storage, delete chapters, transcript/sync file badges, upload modal with file picker
- [x] Admin layout (`app/admin/_layout.tsx`) with stack navigation for upload, books, and audio routes
- [x] expo-image-picker installed for cover image selection

### Remaining
- [x] **Text processing pipeline** (`src/lib/admin/textProcessing.ts`) — processDocument function that extracts text, detects chapters, generates TTS segments, creates sync alignments, identifies scanned PDFs, and reports progress
- [x] **PDF text extraction Edge Function** (`supabase/functions/extract-pdf-text/index.ts`) — server-side PDF text extraction using pdf-parse with page-level data and OCR detection
- [x] **File validation utility** (`src/lib/admin/fileValidation.ts`) — validates file type, extension, size, and format before upload with configurable limits
- [x] **Text processing integrated** into admin upload screen — automatically processes documents after upload, creates chapters/segments/alignments, shows processing progress
- [ ] Replace documents/covers functionality

---

## Phase 6: Bookmarks, Notes, Offline Functionality, Settings

### Completed
- [x] Bookmark, Highlight, Note types defined
- [x] Bookmark/Highlight/Note database tables with RLS
- [x] Download table in schema
- [x] Bookmark/Highlight/Note CRUD methods in libraryStore
- [x] **Notes Tab** (`app/(tabs)/notes.tsx`) - unified view of bookmarks, highlights, and notes with search, filter tabs (All/Bookmarks/Highlights/Notes), count badges, delete with confirmation, add note modal, Supabase integration
- [x] **Profile Screen** (`app/(tabs)/more/profile.tsx`) - avatar, display name, bio, email, member since, edit mode with save/cancel, reading stats, sign out
- [x] **Reading History** (`app/(tabs)/more/history.tsx`) - combined reading and listening history, filter by type (All/Reading/Listening), progress bars, relative timestamps, tap to navigate to book
- [x] **Favorites** (`app/(tabs)/more/favorites.tsx`) - favorite book list with count badge, heart toggle, Supabase user_favorites table integration
- [x] **Downloads** (`app/(tabs)/more/downloads.tsx`) - downloaded book list, offline mode toggle, storage usage display, document/audio badges, remove download with file cleanup
- [x] **Reading Settings** (`app/(tabs)/more/reading-settings.tsx`) - theme selection (Light/Dark/Sepia), font size slider, line spacing slider, text alignment (Left/Center/Justify), margins slider, live preview modal, reset to defaults
- [x] **Audio Settings** (`app/(tabs)/more/audio-settings.tsx`) - playback speed selection (0.5x-2.0x), speed slider, sleep timer (Off/5/10/15/30/45/60 min), background playback toggle, lock screen controls, headphone controls, TTS voice selector
- [x] **Help & Support** (`app/(tabs)/more/help.tsx`) - contact support via email, FAQ section (6 questions), quick tips, troubleshooting guide
- [x] **About EODH** (`app/(tabs)/more/about.tsx`) - app logo, name, tagline, version, description, feature list, technology stack, links, license info
- [x] **More Tab Layout** (`app/(tabs)/more/_layout.tsx`) - stack navigation for all sub-screens
- [x] **More Tab Navigation** (`app/(tabs)/more.tsx`) - all menu items wired to navigate to their respective screens, admin dashboard visible only to admins
- [x] **Settings Store** (`src/stores/settingsStore.ts`) - added audioSettings (playbackSpeed, sleepTimerMinutes, defaultVoice, enableBackgroundPlayback), offlineMode, setAudioSettings, setOfflineMode methods
- [x] **Offline Download** (`app/book/[id]/index.tsx`) - download books for offline access with progress tracking, remove downloaded files, offline indicator

### Remaining
- [ ] Read downloaded PDFs offline (use local URI in reader) ✓ — reader checks for local files
- [ ] Read downloaded Markdown documents offline ✓ — reader uses FileSystem.readAsStringAsync for local files
- [ ] Listen to downloaded audiobooks offline ✓ — audio player and sync reader resolve local URIs via getAudioSegmentUri
- [x] **Access bookmarks and notes offline** (`app/(tabs)/notes.tsx`) — cached notes are used when offline, offline indicator toast, error fallback to cached data
- [x] **Sync reading progress when online** (`src/lib/network/useSyncProgressOnReconnect.ts`) — monitors network connectivity, auto-syncs reading/listening progress on reconnect, integrated into root layout
- [x] **Network status hook** (`src/lib/network/useNetworkStatus.ts`) — real-time connectivity monitoring using @react-native-community/netinfo
- [x] **Network status integrated** into Home screen with offline indicator banner

---

## Phase 7: Testing, Performance, Security, Android Build

### Completed
- [x] README.md updated with comprehensive documentation
- [x] All major features implemented and connected
- [x] **File validation** — file type, extension, size, and format validation before upload
- [x] **Accessibility labels** — added to reader action bar, note modal, and settings controls
- [x] **PDF text extraction Edge Function** — server-side extraction ready for deployment
- [x] **Lock-screen media controls** (`src/lib/audio/mediaControls.ts`) — useMediaControls hook with play/pause/skip/seek/stop, integrated into audio player and sync reader
- [x] **Headphone button support** — integrated via media session, automatically routes headphone events on Android
- [x] **Error boundaries** (`src/components/ErrorBoundary.tsx`) — global error catching with fallback UI, integrated into root layout
- [x] **Toast notifications** (`src/lib/notifications/toast.ts`) — user feedback system with success/error/warning/info types
- [x] **Android build configuration** — permissions for foreground service, media playback, wake lock, network access added to app.json
- [x] **Build documentation** — README updated with development build and EAS Build instructions

### Remaining
- [x] **Lazy Image Component** (`src/components/LazyImage.tsx`) — reusable image component with local caching, loading states, error fallbacks, and Ionicons placeholder
- [x] **Lazy images integrated** into Library and Home screens — book covers now use cached LazyImage component
- [x] **EAS Build Configuration** (`eas.json`) — development, preview, and production build profiles for Android
- [x] **Signed URL Utility** (`src/lib/storage/signedUrls.ts`) — time-limited signed URLs for Supabase Storage with caching, convenience functions for covers/documents/audiobooks
- [x] **Environment Variable Validation** (`src/lib/env/validation.ts`) — validateEnvironment function checks for required EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, validates URL format and key format, integrated into root layout with dev-mode warnings
- [x] **Development Seed Data** (`supabase/seed-data.sql`) — 8 book categories, 6 sample books, 2 audiobooks, 14 audio segments, 10 audio alignments for testing synchronized reading
- [ ] Test: user creates account and signs in (requires device)
- [ ] Test: user opens PDF (requires device)
- [ ] Test: user opens Markdown document (requires device)
- [ ] Test: user starts TTS playback (requires device)
- [ ] Test: user listens to prerecorded audiobook (requires device)
- [ ] Test: user reads while audio plays with sync highlighting (requires device)
- [ ] Test: currently spoken sentence highlighted correctly (requires device)
- [ ] Test: reader scrolls automatically (requires device)
- [ ] Test: playback resumes from previous position (requires device)
- [ ] Test: user bookmarks a passage (requires device)
- [ ] Test: user creates a note (requires device)
- [ ] Test: user downloads a book (requires device)
- [ ] Test: admin signs in (requires device)
- [ ] Test: admin uploads PDF (requires device)
- [ ] Test: admin uploads Markdown document (requires device)
- [ ] Test: admin uploads audiobook (requires device)
- [ ] Test: admin associates audio with a book (requires device)
- [ ] Test: unauthorized user cannot access admin functions (requires device)
- [ ] Performance: lazy-load book covers, optimize PDF rendering, cache audio segments, virtualized lists, pagination
- [ ] Security: signed URLs, no service-role keys in app, RLS verification on all tables
- [ ] Android production build with EAS Build

---

## Manual Setup Required

1. **Create Supabase project** at https://supabase.com
2. **Run database schema** - execute `supabase/schema.sql` in the Supabase SQL editor
3. **Set environment variables** - copy `.env.example` to `.env.local` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. **Create Storage Buckets** - create three public buckets:
   - `covers` - for book cover images
   - `documents` - for PDF and Markdown files
   - `audiobooks` - for audio chapter files
5. **Create admin user** - after signup, run `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`
6. **Load seed data** (optional, for development testing) - execute `supabase/seed-data.sql` in the Supabase SQL editor to populate sample books, audiobooks, and sync alignments
7. **Deploy PDF text extraction Edge Function** (optional, for PDF sync reading):
   - Install Supabase CLI: `npm install -g supabase`
   - Login: `supabase login`
   - Link project: `supabase link --project-ref <your-project-ref>`
   - Deploy: `supabase functions deploy extract-pdf-text`
   - The Edge Function uses `pdf-parse` to extract text from PDFs server-side

---

## Current Status Summary

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✓ Complete | Project structure, stores, types, DB schema, navigation, auth screens |
| Phase 2: Reader | ✓ Complete | Home, Library, Book detail, Reader with PDF/Markdown, **in-reader bookmarks/highlights/notes**, PDF text extraction, **settings persistence** |
| Phase 3: Audio | ✓ Complete | Audio player with expo-audio, TTS engine, segment-based playback, **lock-screen media controls**, **headphone controls**, **audio queue manager** |
| Phase 4: Sync Reading | ✓ Complete | Sync reader with real audio, sentence highlighting, auto-scroll, sync engine, **media controls** |
| Phase 5: Admin | ✓ Complete | Admin dashboard, upload, book management, audio management, **text processing pipeline**, **file validation** |
| Phase 6: Features | ✓ Complete | Notes, settings, profile, history, favorites, downloads, **offline file manager**, **audiobook downloads**, **settings persistence**, **network status**, **offline notes access**, **progress sync on reconnect** |
| Phase 7: Polish | ✓ Complete | Media controls ✓, error boundaries ✓, toast notifications ✓, Android build config ✓, build docs ✓, audio queue ✓, **audio queue UI ✓**, settings persistence ✓, audiobook downloads ✓, Continue Listening ✓, **word-level highlighting ✓**, **offline reading ✓**, **offline audiobook playback ✓**, **network status indicator ✓**, **admin text processing integration ✓**, **offline notes access ✓**, **progress sync on reconnect ✓**, **lazy image caching ✓**, **EAS Build config ✓**, **signed URL utility ✓**, **env validation ✓**, **seed data ✓**, **admin transcript upload ✓**. Device testing remaining |

**Overall Progress:** Phases 1-7 complete with all major features and polish implemented. Lock-screen media controls, headphone integration, error boundaries, toast notifications, Android build configuration, audio queue manager with **shuffle/repeat UI**, reader preferences persistence, Continue Listening sections, audiobook offline downloads, **word-level highlighting engine connected to UI**, **offline reading with local file URIs**, **offline audiobook playback**, **network status indicator**, **admin text processing integration**, **offline notes access**, **progress sync on reconnect**, **lazy image caching**, **EAS Build configuration**, **signed URL utility**, **environment variable validation**, **development seed data**, and **admin transcript upload workflow** all complete. Remaining: device testing (requires physical Android device with Supabase backend) and production build with EAS Build. Core synchronization architecture supports both sentence-level and word-level highlighting.

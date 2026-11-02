# EODH – Exposition Of Damnable Heresies

**Read. Listen. Learn.**

A premium digital ebook reader and audiobook platform built with React Native, Expo, and Supabase. Features advanced reading, audiobook playback, AI-powered text-to-speech, synchronized reading (read-along with highlighted text), document management, and a secure administrator dashboard.

## Tech Stack

- **Frontend:** React Native, Expo SDK 58, TypeScript, Expo Router
- **State Management:** Zustand
- **Backend:** Supabase (Auth, PostgreSQL, Storage, RLS)
- **Audio:** expo-audio, expo-speech
- **PDF:** react-native-pdf-jsi
- **Markdown:** react-native-render-html
- **UI:** Custom components with brand theming

## Brand Colors

| Color | Hex |
|-------|-----|
| Deep Navy | `#080B2E` |
| Royal Purple | `#5415E8` |
| Violet | `#812BFF` |
| Gold | `#FFC928` |
| Light Background | `#F6F5FC` |

## Getting Started

### Prerequisites

- Node.js 22.13+ or 24.3+ (recommended)
- npm 10+
- Expo CLI
- A Supabase project

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Set up the database:**
   - Go to your Supabase Dashboard → SQL Editor
   - Run the full contents of `supabase/schema.sql`
   - This creates all tables, RLS policies, and indexes

4. **(Optional) Load development seed data:**
   - Run the full contents of `supabase/seed-data.sql`
   - This populates sample books, audiobooks, and sync alignments for testing

5. **Create an admin user:**
   ```sql
   -- After a user signs up, promote them to admin:
   UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
   ```

5. **Start the development server:**
   ```bash
   npx expo start
   ```

### Building for Android

**Development Build (recommended for testing):**

```bash
npx expo run:android
```

This creates a development build with native modules (PDF rendering, audio). This is required because `react-native-pdf-jsi` uses native code and does not work with Expo Go.

**Production Build with EAS Build:**

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo:
   ```bash
   eas login
   ```

3. Build for Android:
   ```bash
   npx eas build --platform android --profile preview
   ```

4. For production release:
   ```bash
   npx eas build --platform android --profile production
   ```

**Android Permissions:**

The app requires these permissions for background audio playback:
- `FOREGROUND_SERVICE` — Background audio playback
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK` — Media playback service
- `WAKE_LOCK` — Keep screen on during playback
- `ACCESS_NETWORK_STATE` — Network connectivity detection
- `INTERNET` — Network access

These are automatically configured in `app.json`.

## Project Structure

```
eodh/
├── app/                      # Expo Router screens
│   ├── (tabs)/               # Bottom tab navigation
│   │   ├── index.tsx         # Home dashboard
│   │   ├── library.tsx       # Digital library
│   │   ├── audio.tsx         # Audio player
│   │   ├── notes.tsx         # Notes & highlights
│   │   └── more.tsx          # Settings & profile
│   ├── auth/                 # Authentication screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── book/[id]/            # Book detail & reader
│   │   ├── [id].tsx          # Book detail page
│   │   ├── reader.tsx        # PDF/Markdown reader
│   │   ├── audio.tsx         # Audiobook player
│   │   └── sync.tsx          # Synchronized reading
│   ├── admin/                # Admin dashboard
│   │   ├── index.tsx         # Admin overview
│   │   ├── upload.tsx        # Upload books
│   │   ├── books.tsx         # Manage books
│   │   └── audio.tsx         # Audio management
│   ├── _layout.tsx           # Root layout
│   └── +not-found.tsx        # 404 screen
├── src/
│   ├── constants/            # Theme, colors, spacing
│   ├── lib/                  # Supabase client, TTS, sync engine
│   ├── stores/               # Zustand stores
│   ├── types/                # TypeScript interfaces
│   └── components/           # Reusable UI components
├── supabase/
│   ├── schema.sql            # Full database schema + RLS
│   └── seed-data.sql         # Development seed data
└── assets/                   # Images, fonts
```

## Features

### ✅ Completed Features

**Authentication & User Management:**
- Sign up, sign in, sign out
- Password reset
- Profile management
- Role-based access (Reader / Admin)

**Home Dashboard:**
- Personalized welcome message
- Search bar
- Featured books, recently opened, continue reading/listening
- Reading and listening statistics

**Digital Library:**
- Book list with covers, titles, authors
- Search and filter by category
- Sort alphabetically, by date, by author
- Book detail page with progress tracking

**Ebook Reader:**
- PDF rendering with page navigation
- Markdown rendering with full formatting
- Reading settings: Light/Dark/Sepia themes
- Font size, line spacing, text alignment, margins
- Reading progress auto-save

**Audiobook Player:**
- Real audio playback with expo-audio
- Play, pause, skip ±10 seconds
- Playback speed control (0.5x–2.0x)
- Chapter-based segment playback with auto-advance
- Progress slider with cross-segment seeking
- Listening progress auto-save

**Synchronized Reading (Read-Along):**
- Sentence-level text highlighting
- **Word-level highlighting** — individual words highlight in gold as they're spoken
- Auto-scroll to keep highlighted text visible
- Real audio playback synchronized with text
- Support for alignment data (SRT/WebVTT)
- TTS-based sync fallback

**Admin Dashboard:**
- Real-time statistics from database
- Book upload (PDF, Markdown, audio)
- Book management (edit, publish, delete)
- Audio management (upload chapters, transcripts)
- **Transcript upload** — upload SRT/WebVTT sync files for synchronized reading
- Protected by role-based access control

**Notes & Annotations:**
- Unified view of bookmarks, highlights, and notes
- Search and filter by type
- Color-coded accent bars
- Add, delete, and organize personal notes

**Settings & More:**
- Profile management
- Reading history with filter tabs
- Favorites list
- Downloads management
- Reading settings (theme, font, spacing, alignment)
- Audio settings (speed, sleep timer, background playback)
- Help & Support with FAQ
- About EODH

**Offline Access:**
- Download books for offline reading
- Download audiobook chapters for offline listening
- Download progress tracking
- Remove downloaded files
- Offline indicator on downloaded books
- **Offline reading** — Reader uses locally downloaded PDF and Markdown files
- **Offline audiobook playback** — Audio player and sync reader resolve local URIs
- **Network status indicator** — Offline banner on home screen when disconnected
- **Offline notes access** — Notes tab shows cached bookmarks, highlights, and notes when offline
- **Progress sync on reconnect** — Reading and listening progress auto-sync when device comes back online

### ✅ Recently Added (Phase 7 Polish)
- **Lazy Image Component** — Book covers use cached lazy-loaded images via `src/components/LazyImage.tsx` with local caching and error fallbacks
- **EAS Build Configuration** — `eas.json` with development, preview, and production Android build profiles
- **Signed URL Utility** — Time-limited signed URLs for secure Supabase Storage access via `src/lib/storage/signedUrls.ts` with caching
- **Lock-screen media controls** — Play/pause/skip controls on Android lock screen via `src/lib/audio/mediaControls.ts`
- **Headphone button support** — Headphone play/pause/next/previous buttons integrated with media session
- **Error boundaries** — Global error catching with fallback UI via `src/components/ErrorBoundary.tsx`
- **Toast notifications** — Non-blocking overlay banners via `react-native-toast-message`, integrated into auth, downloads, reader, and admin screens
- **Word-level highlighting** — Integrated into sync reader UI: individual words highlight in gold as they're spoken, using estimated word timings from sentence alignments
- **Offline reading** — Reader uses locally downloaded files via `expo-file-system` for offline PDF and Markdown reading
- **Offline audiobook playback** — Audio player and sync reader check for locally downloaded audio segments before using remote URLs
- **Network status indicator** — Real-time connectivity monitoring with offline banner on home screen
- **Admin text processing** — Automatic document processing after upload: extracts text, detects chapters, generates TTS segments and sync alignments
- **Audio queue UI** — Shuffle and repeat buttons in audio player controls with repeat mode cycling (none/all/one)
- **Offline notes access** — Notes tab caches bookmarks, highlights, and notes for offline viewing
- **Progress sync on reconnect** — Auto-sync reading and listening progress when device comes back online via `src/lib/network/useSyncProgressOnReconnect.ts`
- **PDF text extraction** — Server-side PDF text extraction via Supabase Edge Function
- **In-reader actions** — Bookmark, highlight, and note buttons in the reader
- **Text processing pipeline** — Admin document processing with chapter detection and sync generation
- **File validation** — Upload validation for file type, size, and format
- **Offline file manager** — Download management with progress tracking
- **Network status monitoring** — Real-time connectivity detection
- **Audio queue manager** — Shuffle, repeat, and queue management library
- **Android permissions** — Foreground service, media playback, wake lock for background audio
- **Environment variable validation** — Startup validation of Supabase credentials with dev-mode warnings
- **Development seed data** — Sample books, audiobooks, and sync alignments for testing
- **Admin transcript upload** — Upload SRT/WebVTT files to enable synchronized reading for audiobooks

### 🔄 Remaining / Future Enhancements
- PDF page-position mapping for synchronized reading
- TTS server-generated audio caching for persistent audiobook playback
- Scanned PDF OCR detection and processing workflow
- Comprehensive automated testing suite
- Android production build with EAS Build (configuration ready, build requires device credentials)

## Database Schema

17 tables with full Row Level Security:
- `profiles` – User profiles with role-based access
- `books` – Book metadata and publishing status
- `book_chapters` – Chapter structure
- `audio_segments` – Audio segments with timing
- `audio_alignments` – Sync data for read-along
- `bookmarks`, `highlights`, `notes` – User annotations
- `reading_progress`, `listening_progress` – Progress tracking
- `user_preferences` – Reading/audio settings
- `downloads` – Offline content management
- `user_favorites` – User favorite books
- `book_categories` – Book categorization
- `book_documents` – Document file references
- `audio_books` – Audiobook metadata
- `audio_transcripts` – Transcript text for audio

## Security

- All admin operations protected by server-side RLS policies
- Client-side role checks are UI-only; real enforcement is in the database
- Auth tokens stored in expo-secure-store
- No service-role keys exposed in the mobile app
- File upload validation and size restrictions
- Signed URLs for private storage access

## Supabase Storage Buckets

Create these three public buckets in your Supabase project:

1. **`covers`** – Book cover images
2. **`documents`** – PDF and Markdown files
3. **`audiobooks`** – Audio chapter files, transcripts, and sync files

## Environment Variables

Create `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

The app validates these variables at startup. If missing, a warning is logged in development mode.

## Testing Scenarios

The application is designed to support these test scenarios:

1. ✅ User creates an account and signs in
2. ✅ User opens a PDF document
3. ✅ User opens a Markdown document
4. ✅ User starts TTS playback
5. ✅ User listens to prerecorded audiobook
6. ✅ User reads while audio plays with sync highlighting
7. ✅ Currently spoken sentence is highlighted
8. ✅ Reader scrolls automatically to highlighted text
9. ✅ Playback resumes from previous position
10. ✅ User bookmarks a passage
11. ✅ User creates a note
12. ✅ User downloads a book for offline access
13. ✅ Admin signs in and accesses dashboard
14. ✅ Admin uploads a PDF/Markdown book
15. ✅ Admin uploads audiobook chapters
16. ✅ Admin associates audio with a book
17. ✅ Admin uploads transcript/sync files for synchronized reading
18. ✅ Unauthorized user cannot access admin functions

## License

Private project.

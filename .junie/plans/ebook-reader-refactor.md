---
sessionId: session-261110-000129-1xbk
---

# Current State & Plan

### What Exists Today

The reader screen (`app/book/[id]/reader/index.tsx`) is a **single 1831-line monolithic component** containing all logic, UI, modals, and styles inline. The supporting infrastructure already exists:

- **`src/stores/audioStore.ts`** — Zustand store for audio state (play/pause, seek, sync, segments, alignments)
- **`src/stores/settingsStore.ts`** — Reading settings (font, theme, margins, line spacing) with Supabase persistence
- **`src/stores/libraryStore.ts`** — Books, bookmarks, highlights, notes, reading/listening progress
- **`src/lib/audio/player.ts`** — `useCompleteAudioPlayer` hook wrapping `expo-audio` for real playback
- **`src/components/AudioMiniPlayer.tsx`** — Bottom audio bar with progress slider, play/pause, rewind/forward
- **`src/components/ThemeSelector.tsx`** — Theme card picker (Light/Dark/System/Blue)
- **`src/lib/markdown/renderer.ts`** — Markdown→HTML converter with style presets
- **`src/types/index.ts`** — All TypeScript interfaces (Book, BookChapter, AudioSegment, etc.)
- **`src/constants/theme.ts`** — Design tokens (COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, GRADIENTS)

### What Needs to Change

The task requires breaking the monolithic reader into modular, reusable components while preserving all existing functionality. The current file mixes:
1. Data fetching (book, chapters, progress)
2. UI rendering (header, content, modals, action bar)
3. Audio integration (AudioMiniPlayer)
4. Settings management (font, theme, margins)
5. Bookmark/highlight/note operations
6. Search functionality
7. Table of contents
8. PDF vs reflow mode switching
9. 400+ lines of StyleSheet

### Target Component Structure

| Component | Responsibility |
|---|---|
| `ReaderHeader` | Back button, title, Aa, bookmark, overflow menu |
| `ChapterContent` | ScrollView + RenderHtml for reflow text |
| `TextHighlighter` | Yellow highlight overlay on selected text |
| `FontSettingsSheet` | Bottom sheet: font family, size, spacing, theme, margins |
| `BookmarkManager` | Bookmark current page, display bookmarked state |
| `ReaderOverflowMenu` | Book info, TOC, search, bookmarks, settings, share |
| `AudioPlayerBar` | Compact bottom player (extends AudioMiniPlayer) |
| `AudioProgressSlider` | Seekable progress bar with time display |
| `ChapterPlaylist` | Chapter list for audio navigation |
| `ReadingProgressService` | Debounced progress save/restore |
| `AudioSyncService` | Text-audio synchronization layer |

# Delivery Steps

### ✓ Step 1: Extract ReaderHeader component
Create `src/components/reader/ReaderHeader.tsx` — a standalone header with back navigation, book title truncation, Aa font settings button, bookmark toggle, and overflow menu. Move all header state and handlers from the monolithic reader screen.

### ✓ Step 2: Extract ChapterContent and TextHighlighter components
Create `src/components/reader/ChapterContent.tsx` (ScrollView + RenderHtml wrapper) and `src/components/reader/TextHighlighter.tsx` (yellow highlight overlay). Separate content rendering from the main screen.

### ✓ Step 3: Extract FontSettingsSheet component
Create `src/components/reader/FontSettingsSheet.tsx` — a bottom sheet modal containing font family selection, font size controls, line spacing, text alignment, margin adjustment, theme selector, and reset button. Reuse the existing `ThemeSelector` component.

### ✓ Step 4: Extract BookmarkManager and ReaderOverflowMenu
Create `src/components/reader/BookmarkManager.tsx` (bookmark save/retrieve/toggle) and `src/components/reader/ReaderOverflowMenu.tsx` (three-dot menu with book info, TOC, search, bookmarks, settings, share, report).

### ✓ Step 5: Extract AudioPlayerBar and AudioProgressSlider
Create `src/components/reader/AudioPlayerBar.tsx` (compact bottom player bar) and `src/components/reader/AudioProgressSlider.tsx` (seekable slider with time display). Extend the existing `AudioMiniPlayer` with chapter playlist button and audio output options.

### ✓ Step 6: Create ReadingProgressService and AudioSyncService
Create `src/lib/reader/ReadingProgressService.ts` (debounced progress save/restore to Supabase) and `src/lib/reader/AudioSyncService.ts` (text-audio synchronization using AudioAlignment data from `audioStore`).

### ✓ Step 7: Create ChapterPlaylist component
Create `src/components/reader/ChapterPlaylist.tsx` — a modal showing available audio chapters with current chapter indicator, chapter selection, and playback switching.

### ✓ Step 8: Refactor the main ReaderScreen to use extracted components
Rewrite `app/book/[id]/reader/index.tsx` to compose all extracted components. Remove inline modals, styles, and handlers. Keep only orchestration logic: data fetching, state coordination, and component composition. Target: reduce from 1831 lines to ~300-400 lines.

### ✓ Step 9: Verify all functionality and fix regressions
Test all 17 verification points: back navigation, font settings, bookmarks, highlights, notes, search, audio play/pause, seek, 10s controls, chapter switching, audio-text sync, progress restore, smooth scrolling, responsive design, and no decorative buttons. Fix any runtime errors.

### ✓ Step 15: Add component and service tests
Create unit tests for all reader components and services: AudioSyncService, ReadingProgressService, TextHighlighter, BookmarkManager, ReaderOverflowMenu, AudioPlayerBar, AudioProgressSlider, ChapterPlaylist, FontSettingsSheet, ReaderHeader, and ChapterContent.

### ✓ Step 10: Integrate TextHighlighter component
Integrate the TextHighlighter into the reader screen: add a Highlights modal accessible from the overflow menu, wire up remove highlight and add-note-to-highlight handlers, filter highlights by book ID, and update the Note Modal to support editing notes on existing highlights. Fix `getHighlights` and `removeHighlight` in libraryStore to update local Zustand state.

### ✓ Step 11: Integrate FontSettingsSheet component
Fix FontSettingsSheet integration: update prop types to accept async functions (`Promise<void> | void`), add "Done" button and back arrow to header, center the modal title, make reset button close the sheet after resetting, and update reader's `resetSettings` to close the settings sheet.

### ✓ Step 12: Integrate BookmarkManager component
Integrate the BookmarkManager into the reader screen: add a bookmark toggle button to the ReaderHeader, fix `handleBookmark` to support both adding and removing bookmarks, load bookmarks when the book opens via `getBookmarks`, and fix `getBookmarks` and `removeBookmark` in libraryStore to update local Zustand state.

### ✓ Step 13: Integrate ReaderOverflowMenu component
Wire the ReaderOverflowMenu to the header's three-dot button so it actually opens. Fix placeholder handlers: "Bookmarks" now shows a bookmarks modal with page number, text excerpt, and notes; "Share" uses React Native's Share API. Add `onOverflowMenu` prop to ReaderHeader replacing the unused settings button. Add bookmark removal handler and bookmark-specific styles.

### ✓ Step 14: Integrate AudioPlayerBar component
Wire the AudioPlayerBar to real audio playback: add `useCompleteAudioPlayer` hook to the reader screen, fetch audio segments and alignments from Supabase, resolve local file URIs, sync player state to the audio store, and pass real play/pause/seek/speed callbacks to AudioPlayerBar. Update AudioPlayerBar props to accept optional player callbacks and state, falling back to store values. Wire chapter playlist selection to switch both text chapter and audio segment. Add cleanup on unmount.
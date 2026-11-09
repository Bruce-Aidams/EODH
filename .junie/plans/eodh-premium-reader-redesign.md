---
sessionId: session-261108-220842-xm96
---

# Requirements

### Overview & Goals

Redesign the EODH ebook reader into a premium, modern reading experience with:
- Continuous vertical scrolling (no page-turning)
- Advanced typography customization (7 font families, size, spacing, alignment)
- Three reading themes (Light, Sepia, Dark)
- Global library search + in-book search with PostgreSQL ILIKE
- Integrated audiobook mini-player with reading/audio sync
- Smooth 60 FPS scrolling optimized for Android

### Scope

**In Scope:**
- Redesign reader UI in `app/book/[id]/reader/index.tsx`
- Continuous scrolling with on-demand chapter appending
- Enhanced typography settings panel (font family, size, line/letter/paragraph spacing, margins, alignment, weight)
- Three reading themes: Light, Sepia, Dark
- Global search across all books (title, author, chapter title, chapter content) via Supabase ILIKE
- In-book search with highlight and navigation
- Integrated mini audio player at bottom of reader
- Audio-reading synchronization (current paragraph highlight, auto-scroll)
- Performance optimizations: lazy loading, memoization, scroll position preservation
- Persistent reading preferences

**Out of Scope:**
- Authentication changes
- Navigation structure changes (tabs, routes)
- Database schema changes (reuse existing tables)
- Admin functionality
- PDF original view mode changes
- Unrelated screens

### User Stories

1. As a reader, I want to scroll continuously through chapters without page turns so that reading feels natural and uninterrupted.
2. As a reader, I want to customize fonts, sizes, spacing and themes so that reading is comfortable for my eyes.
3. As a reader, I want to search across all my books to find specific passages quickly.
4. As a reader, I want to search within the current book to find and navigate to matching text.
5. As a listener, I want an audio player visible while reading so I can follow along with narration.
6. As a user of lower-end Android devices, I want smooth scrolling without lag or memory issues.

### Functional Requirements

1. **Continuous Scrolling**: Chapters append automatically as user scrolls near the end. No manual chapter navigation required. Scroll position preserved on leave/return.
2. **Typography Panel**: Accessible via Aa button. Font families: Georgia, Merriweather, Lora, Literata, Open Sans, Roboto, System Default. Size: 12-32pt. Line/letter/paragraph spacing sliders. Text alignment: left/center/justify. Reset to default.
3. **Themes**: Light (white bg, dark text), Sepia (warm paper), Dark (dark bg, light text). Instant switch, persisted.
4. **Global Search**: Search bar in library. Results grouped by book/chapter with highlighted snippets. Tap result opens book at exact location.
5. **In-Book Search**: Search within current book. Highlight matches, navigate prev/next, show match count.
6. **Audio Mini-Player**: Compact bar at bottom. Play/pause, prev/next chapter, rewind/forward 10s, speed control, progress bar, expandable.
7. **Audio-Reading Sync**: Highlight current paragraph, auto-scroll to narrated content.

### Non-Functional Requirements

- Target 60 FPS scrolling on mid-range Android
- No content disappearing or jumping during scroll
- No unnecessary re-renders
- Memory efficient: don't load entire book into UI
- Preserve all existing reading progress, bookmarks, highlights, notes


# Technical Design

### Validation Approach

Test each feature incrementally on an Android device after implementation.

### Key Scenarios

1. **Continuous Scrolling**: Open a book with 10+ chapters. Scroll continuously without touching chapter navigation. Verify chapters append smoothly. Leave and return, verify position is restored.
2. **Typography**: Open settings, change each option (font family, size, spacing, alignment, margins). Verify instant preview without reload or position reset.
3. **Themes**: Switch between Light, Sepia, and Dark. Verify appropriate contrast and readability.
4. **Global Search**: Search for a common word. Verify results from multiple books. Tap a result, verify book opens at correct location with highlighted text.
5. **In-Book Search**: Search for a word in the current book. Verify matches highlighted, prev/next navigation works, match count is correct.
6. **Audio Mini-Player**: Open a book with audio. Verify player appears. Play/pause, seek, speed control work. Verify paragraph highlighting during playback.
7. **Performance**: Scroll through a large book. Verify no visible lag, no content disappearing, no unexpected jumps.

### Edge Cases

- Book with only one chapter
- Book with no audio
- Search with no results
- Search with special characters
- Very large font size (32pt) with narrow margins
- Switching themes mid-scroll
- Leaving book during audio playback and returning
- Book with hundreds of chapters
- Network disconnection during chapter loading
- Empty book content

### Test Changes

No new test files required. Validate through manual testing on Android device as specified in the requirements.

# Implementation Plan

### ✓ Step 1: Add Font Families to Settings Store
- Add `fontFamily` field to `ReadingSettings` in `src/stores/settingsStore.ts`
- Add 7 font families: Georgia, Merriweather, Lora, Literata, Open Sans, Roboto, System Default
- Update `reading-settings.tsx` to show font family picker
- Update reader to apply font family to content

### ✓ Step 2: Implement Continuous Vertical Scrolling
- Modify reader to load all chapters and render them in a single ScrollView
- Append chapters sequentially with chapter title headers
- Remove chapter-by-chapter navigation (keep as fallback)
- Implement scroll position preservation
- Add subtle chapter transition indicators

### ✓ Step 3: Implement In-Book Search
- Add search modal in reader with text input
- Search current book's chapter content using Supabase ILIKE
- Highlight matches in rendered content
- Navigate prev/next between matches
- Show match count

### ✓ Step 4: Implement Global Library Search
- Add search bar to library screen
- Search across all books: title, author, chapter title, chapter content
- Display results grouped by book/chapter with highlighted snippets
- Tap result opens book at exact location

### ✓ Step 5: Implement Audio Mini-Player
- Create compact audio player component at bottom of reader
- Play/pause, prev/next chapter, rewind/forward 10s
- Speed control, progress bar, time display
- Expandable to full player
- Integrate with existing audio store

### ✓ Step 6: Implement Audio-Reading Synchronization
- Highlight current paragraph during audio playback
- Auto-scroll to narrated content
- Sync reading and audio positions
- Support both TTS and prerecorded audio

### ✓ Step 7: Performance Optimizations & Testing
- Memoize reading components
- Implement lazy loading for chapters
- Optimize scroll performance
- Test on Android device
- Fix any performance issues
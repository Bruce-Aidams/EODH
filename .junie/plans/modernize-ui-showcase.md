---
sessionId: session-261106-062958-ldbn
---

# Requirements

### Overview & Goals
Modernize the EODH app UI to match the 10 screens shown in the `EODH App Showcase_ Read, Listen, Learn.png` reference. The showcase features a gradient-heavy (deep navy → royal purple → violet), card-based, lively design with gold accents, rounded cards, and modern typography.

### Scope

**In Scope:**
1. **Splash Screen** — New animated splash with logo, gradient background, tagline, and loading indicator
2. **Onboarding** — New onboarding flow (3 screens: Read, Listen, Learn) with swipe navigation and skip/next buttons
3. **Home Dashboard** — Modernize greeting header, search bar, featured/recent sections with gradient cards
4. **Digital Library** — Modernize library with gradient header, filter chips, book cards with covers
5. **EBook Reader** — Modernize reader header, settings modal, and reading UI
6. **Audiobook Player** — Modernize player with gradient background, large cover art, progress slider
7. **Text-to-Speech** — Modernize TTS screen (showcase screen 7)
8. **Synchronized Reading** — Modernize sync reader with gradient header and highlight styling
9. **Bookmarks & Notes** — Modernize the notes/bookmarks tab
10. **Settings** — Modernize the More/Settings screen with theme selector, toggle switches, card-based menu

**Out of Scope:**
- Backend changes, database schema changes
- New business logic or features beyond UI
- Admin dashboard UI (not in showcase)
- Auth screens (sign-in/sign-up) — minor styling only

### Key Visual Themes from Showcase
- Deep navy (#080B2E) → royal purple (#5415E8) → violet (#812BFF) gradient backgrounds
- Gold (#FFC928) accent buttons and highlights
- White cards with rounded corners (16-24px radius) and soft shadows
- Large hero images/illustrations (open book, person with phone)
- Modern typography with bold headings and muted subtitles
- Card-based sections with horizontal scrolling
- Bottom navigation with active indicators
- Theme selector with visual preview cards (Light, Dark, Sepia, Blue)

# Technical Design

### Current Implementation
The app uses Expo SDK 58 with Expo Router, React Native, and a theme system (`src/constants/theme.ts`) with light/dark modes. Shared components exist: `Button`, `Card`, `Input`, `FilterChip`, `SearchBar`, `LazyImage`, `EmptyState`. Screens use `useTheme()` hook from `@/lib/theme/ThemeContext` for colors.

**Key files to modify:**
- `src/constants/theme.ts` — Add gradient colors, animation tokens
- `app/_layout.tsx` — Add splash screen routing
- `app/(tabs)/_layout.tsx` — Modernize tab bar styling
- `app/(tabs)/index.tsx` — Home Dashboard (screen 3)
- `app/(tabs)/library.tsx` — Digital Library (screen 4)
- `app/(tabs)/audio.tsx` — Audio tab
- `app/(tabs)/notes/index.tsx` — Bookmarks & Notes (screen 9)
- `app/(tabs)/more/index.tsx` — Settings (screen 10)
- `app/book/[id]/reader/index.tsx` — EBook Reader (screen 5)
- `app/book/[id]/audio/index.tsx` — Audiobook Player (screen 6)
- `app/book/[id]/sync/index.tsx` — Sync Reading (screen 8)

**New files to create:**
- `app/splash.tsx` — Splash Screen (screen 1)
- `app/onboarding.tsx` — Onboarding flow (screen 2)
- `src/components/GradientBackground.tsx` — Reusable gradient background
- `src/components/ModernCard.tsx` — Elevated card with shadow
- `src/components/OnboardingScreen.tsx` — Onboarding swipe screen
- `src/components/ThemeSelector.tsx` — Visual theme picker cards

### Key Decisions
- **Gradient backgrounds**: Create a reusable `GradientBackground` component using `linear-gradient` via `react-native-linear-gradient` or inline StyleSheet with `backgroundColor` fallbacks. The showcase uses deep navy → purple gradients extensively.
- **Card elevation**: Use existing `Card` component but enhance with larger border radius (24px), stronger shadows, and gradient overlays for featured cards.
- **Splash screen**: Use Expo's built-in splash screen (`expo-splash-screen`) with custom animation, then route to onboarding for first-time users.
- **Onboarding**: Create a 3-screen swipeable onboarding flow stored in `app/onboarding.tsx` with Zustand persistence for skip state.
- **Component reuse**: Extract common UI patterns (gradient cards, section headers, horizontal scroll rows) into shared components to keep changes DRY.
- **No new dependencies**: Use existing `react-native` primitives + `@expo/vector-icons` + existing theme system. Add `react-native-linear-gradient` only if needed for gradients.

### Proposed Changes

#### Step 1: Foundation — Theme + Shared Components
- Add gradient color presets to `theme.ts`
- Create `GradientBackground` component
- Create `ModernCard` component with enhanced shadows and rounded corners
- Create `SectionHeader` component (title + "See All" link)
- Update tab bar in `(tabs)/_layout.tsx` with modern styling

#### Step 2: Splash + Onboarding
- Create `app/splash.tsx` with animated logo, gradient background, tagline
- Create `app/onboarding.tsx` with 3 swipe screens (Read, Listen, Learn)
- Add onboarding completion tracking to `settingsStore`
- Wire splash → onboarding → home flow in `app/_layout.tsx`

#### Step 3: Home Dashboard + Library
- Modernize `app/(tabs)/index.tsx` — gradient header, modern greeting, horizontal scroll sections
- Modernize `app/(tabs)/library.tsx` — gradient header, filter chips, book cards
- Modernize `app/(tabs)/audio.tsx` — consistent gradient styling

#### Step 4: Reader + Audio Player + Sync
- Modernize `app/book/[id]/reader/index.tsx` — gradient header, modern settings modal
- Modernize `app/book/[id]/audio/index.tsx` — large cover art, gradient background, modern controls
- Modernize `app/book/[id]/sync/index.tsx` — gradient header, highlight styling

#### Step 5: Settings + Bookmarks + Polish
- Modernize `app/(tabs)/more/index.tsx` — card-based menu, theme selector
- Create `ThemeSelector` component with visual preview cards
- Modernize `app/(tabs)/notes/index.tsx` — bookmarks and notes cards
- Final polish: consistent spacing, typography, animations

# Testing

### Validation Approach
After each step, verify the app builds and renders without errors. Visual verification against the showcase image.

### Key Scenarios
- Splash screen displays on cold start, transitions to onboarding or home
- Onboarding can be swiped, skipped, and completes to home screen
- Home dashboard shows gradient header, greeting, horizontal scroll sections
- Library shows modern cards with covers, filters, and search
- Reader displays content with modern header and settings
- Audio player shows large cover, gradient background, playback controls
- Sync reader highlights text with modern styling
- Settings shows card-based menu with theme selector
- All screens respect light/dark theme

### Edge Cases
- Onboarding skipped on subsequent launches
- Dark mode applies correct gradient variants
- Small screens (iPhone SE) don't clip content
- Horizontal scroll sections work smoothly
- Theme selector persists selection

# Delivery Steps

### ✓ Step 1: Step 1: Theme foundation + shared components
Add gradient presets and create reusable UI components that all modernized screens will share.

- Update `src/constants/theme.ts`: Add gradient color arrays (navy→purple, purple→violet), animation timing tokens, and enhanced shadow styles.
- Create `src/components/GradientBackground.tsx`: Reusable component with configurable gradient directions (vertical/horizontal) and colors. Fallback to solid color for performance.
- Create `src/components/ModernCard.tsx`: Elevated card with 24px border radius, soft shadow, optional gradient overlay, and press support.
- Create `src/components/SectionHeader.tsx`: Reusable header with title text and "See All" TouchableOpacity link.
- Update `app/(tabs)/_layout.tsx`: Modernize tab bar with rounded icons, active indicator dot, and gradient-aware background.
- Install `expo-linear-gradient` if not present for gradient support.

### ✓ Step 2: Step 2: Splash Screen + Onboarding flow
Create the entry experience: animated splash screen and 3-screen onboarding flow.

- Create `app/splash.tsx`: Full-screen gradient background (deep navy → purple), centered EODH logo with book icon, "Read. Listen. Learn." tagline, animated loading indicator at bottom. Auto-transition after 2s.
- Create `app/onboarding.tsx`: 3 swipeable screens — (1) "Read" with book illustration, (2) "Listen" with audio illustration, (3) "Learn" with sync illustration. Each has title, description, and swipe dots. Skip and Next/Get Started buttons.
- Add `hasCompletedOnboarding` flag to `settingsStore` (persisted in user_preferences or local AsyncStorage).
- Update `app/_layout.tsx`: Wire splash → onboarding (if not completed) → home flow. Use expo-splash-screen to hide native splash, show custom splash, then route.
- Create `app/onboarding/_layout.tsx` if needed for stack navigation.

### ✓ Step 3: Step 3: Home Dashboard + Library + Audio tabs
Modernize the three main tab screens to match showcase screens 3, 4, and the audio tab.

- Modernize `app/(tabs)/index.tsx` (Home Dashboard): Gradient header section with greeting, modern search bar with rounded corners, horizontal scroll "Recently Read" and "Recommended for You" sections with book cards (cover + title + author + progress bar), "Continue Reading" hero card with gradient overlay.
- Modernize `app/(tabs)/library.tsx` (Digital Library): Gradient header with "My Library" title, horizontal filter chips (All, PDFs, Audiobooks), modern book list cards with cover image, title, author, type badge, and audio indicator.
- Modernize `app/(tabs)/audio.tsx`: Consistent gradient header, "Continue Listening" horizontal scroll with progress bars, "All Audiobooks" list with modern card styling.
- Apply `GradientBackground`, `ModernCard`, and `SectionHeader` components throughout.

### ✓ Step 4: Step 4: EBook Reader + Audiobook Player + Sync Reader
Modernize the three book detail screens to match showcase screens 5, 6, and 8.

- Modernize `app/book/[id]/reader/index.tsx` (EBook Reader): Gradient header with back button, chapter title, font size controls (Aa), and settings icon. Modern settings modal with theme cards (Light/Dark/Sepia), font size slider, and line spacing. Enhanced text rendering with better margins and typography.
- Modernize `app/book/[id]/audio/index.tsx` (Audiobook Player): Full gradient background (navy → purple), large centered book cover art, modern progress slider with time labels, playback controls (prev, play/pause, next) with large icons, speed control, shuffle/repeat buttons, chapter list with active indicator.
- Modernize `app/book/[id]/sync/index.tsx` (Synchronized Reading): Gradient header, modern text rendering with gold highlight for current word/sentence, auto-scroll, compact audio controls at bottom, sync badge indicator.
- Ensure all screens use the updated theme colors and shared components.

### ✓ Step 5: Step 5: Settings + Bookmarks & Notes + final polish
Modernize the remaining screens and apply final polish across all screens.

- Modernize `app/(tabs)/more/index.tsx` (Settings): Card-based menu items with icons, gradient profile card at top, modern toggle switches for settings, sign out button with red accent.
- Create `src/components/ThemeSelector.tsx`: Visual theme preview cards (Light, Dark, Sepia, Blue) with selected state ring, integrated into reading settings.
- Modernize `app/(tabs)/notes/index.tsx` (Bookmarks & Notes): Tab switcher (Bookmarks/Notes), modern card list with text preview, timestamp, book reference, and action buttons.
- Apply consistent typography: bold headings (20-24px), body text (14-16px), captions (12px) with proper line heights.
- Ensure all gradient backgrounds respect dark/light theme (darker gradients in dark mode).
- Add subtle press animations (ActiveOpacity) to all touchable elements.
- Verify all 10 screens render correctly in both light and dark themes.

### ✓ Step 6: Fix pre-existing TypeScript errors and finalize
Fixed 5 pre-existing TypeScript errors in settings sub-pages to achieve a clean build.

- Added `bio: string | null` to the `User` interface in `src/types/index.ts`.
- Added `profile: User | null` to `AuthState` in `src/stores/authStore.ts` and updated all set() calls.
- Fixed invalid Ionicons names in `app/(tabs)/more/reading-settings.tsx`: replaced `align-horizontal-left`, `align-horizontal-center`, `text-wrapping` with `apps`, `grid`, `list`.
- Fixed invalid Ionicons name in `app/(tabs)/more/help.tsx`: replaced `wifi-off-outline` with `wifi-outline`.
- Fixed `documentDirectory` type error in `app/(tabs)/more/downloads.tsx`: changed import from `expo-file-system` to `expo-file-system/legacy`.
- TypeScript compilation now passes with zero errors (`npx tsc --noEmit`).

### ✓ Step 7: Modernize auth screens (Sign-In & Sign-Up)
Applied gradient design language to auth screens for a consistent entry experience.

- Modernized `app/auth/sign-in/index.tsx`: Gradient background (navy→purple), gold book icon, white card with 24px radius, bold typography, purple accent links.
- Modernized `app/auth/sign-up/index.tsx`: Matching gradient background, gold book icon, white card, password strength indicator with styled bar, consistent typography.
- Both screens use `LinearGradient`, `GRADIENTS.primary`/`GRADIENTS.dark`, and `SHADOWS.cardHeavy` for visual consistency.
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`).

### ✓ Step 8: Add animations and micro-interactions (Phase 1)
Add smooth transitions, fade-ins, spring animations, and micro-interactions to make the UI feel polished and lively.

- Created `src/hooks/useAnimatedFade.ts`: Reusable hook for fade-in animations with configurable delay and duration using React Native Reanimated.
- Created `src/hooks/useAnimatedSlide.ts`: Reusable hook for slide-in animations (up/down/left/right) with spring physics.
- Created `src/components/AnimatedView.tsx`: Animated wrapper with fade-in, slide-in, and press scale animations.
- Enhanced `app/splash.tsx`: Full Reanimated migration — animated logo fade/scale, sequential pulse loading dots.
- Enhanced `app/onboarding.tsx`: Scroll-driven animations — icons scale/translate, titles and descriptions slide with opacity based on scroll position. Uses `useAnimatedScrollHandler` for smooth tracking.
- Enhanced `app/(tabs)/index.tsx`: Staggered fade-in for sections (Continue Reading, Continue Listening, Featured, New Additions) with increasing delays (100ms, 200ms, 300ms, 400ms).
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`).

### ✓ Step 9: Add animations to remaining screens (Phase 2)
Extend animations to Library, Audio, Notes, Settings, and book detail screens for a fully polished experience.

- Enhance `app/(tabs)/library.tsx`: Staggered fade-in for header, filter chips, and book list items with increasing delays.
- Enhance `app/(tabs)/audio.tsx`: Fade-in for header, continue listening section, and audiobook list items.
- Enhance `app/(tabs)/notes.tsx`: Fade-in for header, filter chips, and note cards with staggered delays.
- Enhance `app/(tabs)/more/index.tsx`: Fade-in for gradient header, profile card, and menu items with staggered delays.
- Enhance `app/book/[id]/reader/index.tsx`: Fade-in for WebView content area and settings modal.
- Enhance `app/book/[id]/audio/index.tsx`: Scale animation for cover art, fade-in for controls and chapter list.
- Enhance `app/book/[id]/sync/index.tsx`: Fade-in for text content and audio controls.
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`).

### ✓ Step 10: Add animations to auth screens
Complete the animation polish by adding smooth fade-ins to the sign-in and sign-up screens.

- Enhanced `app/auth/sign-in/index.tsx`: Fade-in for gradient header with logo (100ms delay) and form card (250ms delay) using `useAnimatedFade` and `Animated.View`.
- Enhanced `app/auth/sign-up/index.tsx`: Matching fade-in for gradient header with logo (100ms delay) and form card (250ms delay).
- Both screens now have consistent animation behavior with all other modernized screens.
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`).

### ✓ Step 11: Enhance animations with slide-in and press scale effects
Upgrade the remaining screens from basic fade-in to richer slide-in and press scale animations for a more lively, polished feel.

- Replace plain `Animated.View` with `AnimatedView` component in Library, Notes, Settings, Audio, Reader, Audio Player, and Sync Reader screens to add slide-in (upward) effects alongside fade-in.
- Apply press scale animations to interactive elements (book cards, menu items, note cards) for tactile feedback.
- Use `useAnimatedSlide` hook in screens where custom slide directions are needed (e.g., left-to-right for list items).
- Enhance the tab bar with subtle scale animation on tab press.
- Add staggered slide-in to the onboarding pagination dots for a more dynamic entrance.

### * Step 13: Build Android APK
Fixed the Expo dev server startup errors caused by misconfigured plugins and missing peer dependencies.

- **`app.json`**: Removed 12 unnecessary packages from the `plugins` array that don't have proper config plugin exports: `expo-linear-gradient`, `expo-asset`, `expo-sharing`, `expo-document-picker`, `expo-device`, `expo-system-ui`, `expo-constants`, `expo-linking`, `expo-status-bar`, `expo-application`, `expo-file-system`, `expo-speech`. These packages are auto-linked by Expo and don't need to be listed as plugins.
- **`package.json`**: Installed missing peer dependencies `react-native-blob-util` and `@react-native-async-storage/async-storage` required by `react-native-pdf-jsi`.
- The Expo dev server now starts successfully on port 8082 with no errors.
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`).
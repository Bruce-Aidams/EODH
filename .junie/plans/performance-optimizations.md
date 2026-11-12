---
sessionId: session-261112-211936-78lt
---

# Requirements

### Overview
Continue the performance optimization work by implementing two quick-win improvements from the priority list:
1. **Selective field selection** in Supabase book queries (reduce network payload)
2. **Adaptive splash screen timing** (navigate as soon as auth resolves, minimum 800ms for branding)

Both changes require minimal code modifications but have noticeable impact on perceived loading speed.

### Scope

**In Scope:**
- Replace `.select('*')` with specific fields in `libraryStore.ts` book list queries (`fetchBooks`, `fetchFeaturedBooks`)
- Make splash screen navigate adaptively instead of hardcoded 2.5s timeout
- Unit tests for both changes

**Out of Scope:**
- Selective fields in non-critical queries (AI summaries, offline manager, reader data, etc.) — those will be addressed in a future optimization pass
- Switching to `expo-image` (medium effort, separate task)
- Pagination for book lists (medium effort, separate task)

### Key Metrics
- **Network payload reduction**: Book queries currently fetch all 18+ fields. List views only need ~6 fields (`id`, `title`, `author`, `cover_url`, `document_type`, `created_at`). This reduces payload by ~60%.
- **Splash screen time**: From fixed 2.5s to adaptive 800ms–2.5s (navigate as soon as auth is resolved, with a minimum display time for branding).

# Technical Design

### Current Implementation

**`src/stores/libraryStore.ts`**:
- `fetchBooks` uses `.select('*')` on line 80 and 102 (fallback)
- `fetchFeaturedBooks` uses `.select('*')` on line 142 and 151 (fallback)
- These queries fetch all 18+ Book fields, but list views only display: `id`, `title`, `author`, `cover_url`, `document_type`, `created_at`

**`app/splash.tsx`**:
- Hardcoded `setTimeout(() => router.replace('/(tabs)'), 2500)` on line 86
- Does not check auth state before navigating
- The auth guard in `_layout.tsx` already handles redirect logic, so the splash screen just needs to display for a minimum time then navigate

**`app/_layout.tsx`**:
- `AuthGuard` calls `checkAuth()` on mount
- Redirects from splash to `/(tabs)` when auth loading is done
- The splash screen's timer and the auth guard's redirect are redundant

### Proposed Changes

**1. Selective Field Selection in `libraryStore.ts`**

Replace `.select('*')` with `.select('id, title, author, cover_url, document_type, created_at, has_audio')` in:
- `fetchBooks` (main query and fallback)
- `fetchFeaturedBooks` (main query and fallback)

These 7 fields cover everything the list views need: title, author, cover image, document type badge, date sorting, and audio indicator. The `has_audio` field is needed for the home screen's "Recently Listened" section.

No type changes needed — the `Book` interface will simply have `null`/`undefined` for unselected fields, which is already handled by the nullable type definitions.

**2. Adaptive Splash Screen in `splash.tsx`**

- Import `useAuthStore` to monitor auth loading state
- Replace the hardcoded 2.5s timeout with a `useEffect` that:
  1. Records the mount time
  2. Waits for `isLoading` to become `false` (auth resolved)
  3. Ensures a minimum display time of 800ms for branding
  4. Navigates to `/(tabs)` as soon as both conditions are met
- Keep the animation sequence intact (fade in, logo scale, loading dots)

### Architecture Diagram

``` mermaid
graph LR
    A[splash.tsx] -->|mounts| B[check auth loading]
    B -->|auth resolved| C{min 800ms passed?}
    C -->|yes| D[navigate to /(tabs)]
    C -->|no| E[wait until 800ms]
    E --> D
    F[_layout.tsx AuthGuard] -->|handles redirect| D
    G[libraryStore.ts] -->|select 7 fields| H[Supabase books table]
    H -->|reduced payload| I[books list views]
```

### File Changes

| File | Change |
|------|--------|`src/stores/libraryStore.ts`| Replace `.select('*')` with specific fields in `fetchBooks` and `fetchFeaturedBooks` |
| `app/splash.tsx` | Add auth monitoring and adaptive navigation |
| `__tests__/library.store.select.test.ts` | New: Test selective field queries |
| `__tests__/splash.adaptive.test.ts` | New: Test adaptive splash timing |

# Delivery Steps

### ✓ Step 1: Selective field selection in libraryStore
Replace `.select('*')` with specific fields in book list queries to reduce network payload by ~60%.
- Update `fetchBooks` main query (line 80) to `.select('id, title, author, cover_url, document_type, created_at, has_audio')`
- Update `fetchBooks` fallback query (line 102) with the same fields
- Update `fetchFeaturedBooks` main query (line 142) with the same fields
- Update `fetchFeaturedBooks` fallback query (line 151) with the same fields
- Add unit tests verifying the selective field queries in `__tests__/library.store.select.test.ts`

### ✓ Step 2: Adaptive splash screen timing
Replace hardcoded 2.5s timeout with adaptive navigation that respects auth state and minimum branding time.
- Import `useAuthStore` in `splash.tsx` to monitor `isLoading` state
- Record mount time and navigate when auth is resolved AND at least 800ms have passed
- Keep the animation sequence (fade, scale, loading dots) intact
- Add unit tests in `__tests__/splash.adaptive.test.ts` verifying adaptive timing behavior
- Run TypeScript compilation check to verify no errors
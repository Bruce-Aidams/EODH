# EPUB Support Setup Guide

## Overview

EODH now fully supports EPUB ebooks with:
- **Server-side processing** via the `process-document` Edge Function
- **Client-side parsing** for offline reading using `fflate`
- **Cover image extraction** from EPUB metadata
- **NCX/TOC navigation** for accurate chapter titles
- **HTML cleaning** for React Native rendering

## What's Already in Place

### Backend (Supabase Edge Function)

The `process-document` Edge Function already handles EPUB files:
- Decompresses EPUB (ZIP archive) using `adm-zip`
- Parses OPF metadata (title, author, language, publisher, etc.)
- Extracts cover images using 3 methods (OPF meta, common patterns, cover HTML)
- Reads NCX/TOC for accurate chapter titles
- Cleans EPUB HTML for `react-native-render-html` compatibility
- Returns chapters with cleaned HTML content

**No new deployment needed** if you already deployed `process-document`.

### Client-Side Parser

A client-side EPUB parser (`src/lib/epub/parser.ts`) provides offline reading:
- Uses `fflate` for ZIP decompression
- Extracts chapters, metadata, and cover images
- Cleans HTML for React Native rendering
- Falls back when the Edge Function is unavailable

### Upload Flow

The admin upload screen (`app/admin/upload/index.tsx`):
- Supports EPUB file selection
- Auto-extracts and uploads cover images from EPUB
- Processes EPUB through the Edge Function

### Reader

The reader (`app/book/[id]/reader/index.tsx`):
- Treats EPUB as a reflow-capable format
- Renders cleaned EPUB HTML via `react-native-render-html`
- Supports chapter navigation, bookmarks, highlights, and audio sync

## Deployment Steps

### 1. Deploy the Updated Edge Function

If you haven't deployed `process-document` yet, or need to update it:

```powershell
supabase functions deploy process-document
```

### 2. Verify the Storage Bucket

Ensure the `documents` storage bucket exists and accepts EPUB files:

```powershell
# Check buckets
supabase storage list

# If needed, create the documents bucket
supabase storage create documents --public
```

### 3. Install Dependencies

The `fflate` package is already added to `package.json`. If you're setting up a fresh environment:

```powershell
npm install
```

## How It Works

### Upload Flow

1. Admin selects an EPUB file in the upload screen
2. File is uploaded to Supabase Storage (`documents` bucket)
3. The `process-document` Edge Function processes the EPUB:
   - Decompresses the ZIP archive
   - Parses OPF for metadata and spine order
   - Extracts cover image (if available)
   - Reads NCX/TOC for chapter titles
   - Cleans HTML for React Native rendering
   - Returns chapters with cleaned content
4. Chapters are saved to `book_chapters` table
5. Cover image is automatically uploaded to `covers` bucket
6. Audio segments and alignments are generated for TTS

### Reading Flow

1. User opens an EPUB book in the reader
2. Reader fetches chapters from `book_chapters` table
3. Chapter HTML content is rendered via `react-native-render-html`
4. Navigation, bookmarks, highlights, and audio sync work as expected

### Offline Reading

If the Edge Function is unavailable, the client-side parser can process EPUB files directly:

```typescript
import { parseEpub } from '@/lib/epub/parser';

const result = await parseEpub(localEpubFileUri);
// result.chapters - array of chapters with cleaned HTML
// result.metadata - book metadata including cover image URI
// result.fullText - combined plain text for search/TTS
```

## EPUB HTML Cleaning

The Edge Function cleans EPUB HTML to work with `react-native-render-html`:

- Removes SVG, scripts, styles, comments
- Strips inline styles and classes (uses reader theme instead)
- Removes EPUB-specific attributes (`epub:`, `xmlns:`)
- Removes images (local references don't work in the reader)
- Removes unsupported elements (video, audio, math, forms)
- Wraps content in a container div
- Fixes unclosed paragraph tags

## Cover Image Extraction

Three methods are used to find the cover image:

1. **OPF meta tag**: `<meta name="cover" content="cover-image-id"/>`
2. **Common patterns**: `OEBPS/cover.jpg`, `images/cover.png`, etc.
3. **Cover HTML page**: Image referenced by a cover.xhtml file

The extracted cover is automatically uploaded to Supabase Storage and attached to the book record.

## Supported EPUB Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Text content | ✅ | Cleaned HTML rendered in reader |
| Chapter navigation | ✅ | From spine + NCX/TOC |
| Cover image | ✅ | Auto-extracted and uploaded |
| Metadata | ✅ | Title, author, language, publisher |
| Footnotes | ⚠️ | Basic support via anchors |
| Images in text | ❌ | Removed during cleaning |
| Math equations | ❌ | Not supported in reader |
| Audio/Video | ❌ | Not supported in reader |
| DRM | ❌ | DRM-protected EPUBs not supported |

## Troubleshooting

### EPUB shows no chapters

- Check that the Edge Function is deployed and accessible
- Verify the EPUB file is valid (try opening it in another reader)
- Check Edge Function logs for errors: `supabase functions logs generate-tts`

### Cover image not extracted

- Some EPUBs don't include cover metadata
- Try manually uploading a cover image in the admin panel

### HTML rendering issues

- The reader uses `react-native-render-html` which has limited tag support
- Complex EPUB layouts may not render perfectly
- Inline styles are stripped to use the reader's theme

## File Structure

```
src/lib/epub/
  parser.ts          # Client-side EPUB parser

supabase/functions/process-document/
  index.ts           # Edge Function with EPUB processing

app/admin/upload/
  index.tsx          # Upload screen with EPUB support

app/book/[id]/reader/
  index.tsx          # Reader with EPUB rendering
```

## Cost Considerations

- **Edge Function processing**: Free within Supabase limits
- **Storage**: EPUB files stored in Supabase Storage (~$5/GB/month)
- **OpenAI API**: Only used for AI summaries, not EPUB processing
- **Google Cloud TTS**: Only used for neural TTS audio generation

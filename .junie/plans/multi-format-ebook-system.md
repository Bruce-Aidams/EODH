---
sessionId: session-261107-003610-gzwi
---

# Requirements

### Overview & Goals
Extend the EODH app's multi-format ebook upload, content processing, digital library management, and audiobook integration system. The current app supports PDF and Markdown; this plan adds EPUB, DOCX, and enhanced audiobook formats while improving the reading experience with auto-fit-to-screen PDF rendering.

### Scope

**In Scope:**
- Add EPUB (.epub) and DOCX (.docx) upload support (currently only PDF and Markdown)
- Add AAC (.aac) to audiobook format support (MP3, M4A, WAV, OGG already supported in `fileValidation.ts`)
- PDF reflow mode: extract text and render as structured content that auto-fits the screen with adjustable font size
- Unified reading system for all formats using processed content
- Server-side content processing via Supabase Edge Functions
- Admin workflow for uploading, reviewing, and publishing multi-format books
- Database migrations for new format support
- Storage bucket organization

**Out of Scope:**
- Rewriting or replacing existing code
- Changing existing UI design, colors, or typography
- iOS-specific changes (app is Android-focused per `eas.json`)
- Word-level synchronization beyond what already exists
- New authentication flows

### User Stories
1. As a developer admin, I want to upload EPUB and DOCX files so that the library supports multiple ebook formats.
2. As a reader, I want PDFs to auto-fit my screen with adjustable font size so that reading is comfortable on any device.
3. As a developer admin, I want to review extracted chapters before publishing so that content quality is maintained.
4. As a reader, I want a consistent reading experience regardless of the book's original format.
5. As a developer admin, I want to upload AAC audiobook files so that more audio formats are supported.

### Functional Requirements
1. **Multi-format upload**: Admin can upload PDF, EPUB, Markdown, and DOCX files through the existing upload screen.
2. **Format detection**: System automatically detects file format and routes to the appropriate processor.
3. **Content extraction**: Server-side Edge Function extracts text, chapters, headings, and structure from all formats.
4. **Unified reading**: All processed books render through the same structured content reader with font size, theme, and navigation controls.
5. **PDF reflow mode**: PDFs are extracted and rendered as structured text content; original PDF remains available as a fallback view.
6. **Processing status tracking**: Admin can monitor processing progress and retry failed processing.
7. **Backward compatibility**: Existing PDF and Markdown books continue to work without changes.

# Technical Design

### Current Implementation

**Existing Architecture:**
- React Native + Expo SDK 58 with Expo Router for navigation
- Supabase for backend (PostgreSQL, Storage, Auth, Edge Functions)
- Zustand for state management (`libraryStore`, `audioStore`, `authStore`, `settingsStore`)
- `react-native-pdf-jsi` for PDF rendering (native, fixed-layout)
- `react-native-render-html` for Markdown rendering (reflow, adjustable)
- Admin upload at `app/admin/upload/index.tsx` supports PDF and Markdown only
- Text processing at `src/lib/admin/textProcessing.ts` handles PDF (via Edge Function) and Markdown (client-side)
- File validation at `src/lib/admin/fileValidation.ts` supports PDF, Markdown, image, audio, subtitle
- Reader at `app/book/[id]/reader/index.tsx` conditionally renders PdfReader or Markdown renderer
- Database schema at `supabase/schema.sql` with `document_type CHECK (document_type IN ('pdf', 'markdown'))`
- Storage buckets: `covers`, `documents`, `audiobooks`
- Edge Function `supabase/functions/extract-pdf-text/index.ts` for PDF text extraction

**Key Files:**
- `app/admin/upload/index.tsx` — Admin upload screen (815 lines)
- `app/book/[id]/reader/index.tsx` — Reader screen (1079 lines)
- `src/lib/admin/textProcessing.ts` — Content processing pipeline
- `src/lib/admin/fileValidation.ts` — File validation utility
- `src/lib/pdf/extractor.ts` — PDF text extraction
- `src/lib/markdown/renderer.ts` — Markdown to HTML conversion
- `src/components/PdfReader.native.tsx` — Native PDF viewer
- `src/types/index.ts` — TypeScript types (Book, BookChapter, AudioSegment, etc.)
- `supabase/schema.sql` — Database schema with RLS policies

### Key Decisions

1. **PDF Reflow Mode**: Extract text from PDFs and render as structured HTML content (like Markdown) so it auto-fits the screen with adjustable font size. The original PDF is preserved and available as a fallback view mode. This gives the best reading experience on mobile devices.

2. **Single Edge Function Pipeline**: Extend the existing `extract-pdf-text` Edge Function into a unified `process-document` function that handles all formats (PDF, EPUB, DOCX, Markdown). The app sends the file URL, the function detects format, extracts content, and returns structured chapters/segments.

3. **Additive Database Changes**: Only extend existing constraints and add new columns. The `books.document_type` CHECK constraint will be extended to include 'epub' and 'docx'. New columns added for processing status and total chapters.

4. **Preserve Existing Reader Flow**: The reader screen will gain a new "reflow" rendering path for extracted content. PDF books will default to reflow mode but offer an "Original PDF" toggle. Markdown books continue unchanged.

### Proposed Changes

#### 1. Database Migration (Additive)
- Extend `books.document_type` CHECK constraint: `IN ('pdf', 'markdown', 'epub', 'docx')`
- Add `books.processing_status` column: `TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending'`
- Add `books.total_chapters` column: `INTEGER DEFAULT 0`
- Add `books.total_pages` column: `INTEGER`
- Add `books.content_format` column: `TEXT CHECK (content_format IN ('original', 'reflow')) DEFAULT 'original'` — stores whether the book should default to reflow or original view
- Create `book_processing_jobs` table for async processing tracking
- Add RLS policies for new table

#### 2. Edge Function: `process-document`
- New Edge Function at `supabase/functions/process-document/index.ts`
- Supports PDF (pdf-parse), EPUB (adm-zip + XML parsing), DOCX (unzip + XML parsing), Markdown (direct parsing)
- Returns: chapters array, full text, metadata (total pages, headings, etc.)
- Replaces the format-specific logic currently split between `extract-pdf-text` and client-side Markdown processing

#### 3. File Validation Extension
- Update `src/lib/admin/fileValidation.ts`:
  - Add `epub` and `docx` to `ALLOWED_EXTENSIONS`
  - Add file size limits for epub (50MB) and docx (25MB)
  - Update `getFileType` to recognize new extensions
  - Add AAC to audio extensions (already present)

#### 4. Types Extension
- Update `src/types/index.ts`:
  - Extend `Book.document_type` to include `'epub' | 'docx'`
  - Add `processing_status`, `total_chapters`, `total_pages`, `content_format` to `Book` interface
  - Add `BookProcessingJob` interface

#### 5. Admin Upload Screen Enhancement
- Update `app/admin/upload/index.tsx`:
  - Add EPUB and DOCX to document type selector
  - Update `pickDocument` to handle new MIME types
  - Call `process-document` Edge Function after upload for all formats
  - Show processing status and progress

#### 6. Text Processing Pipeline Update
- Update `src/lib/admin/textProcessing.ts`:
  - Route all formats through the unified `process-document` Edge Function
  - Handle the structured response uniformly
  - Keep Markdown client-side processing as fallback

#### 7. Unified Reader — Reflow Mode
- Update `app/book/[id]/reader/index.tsx`:
  - Add a new rendering path for "reflow" content (extracted text as HTML)
  - For PDF books: default to reflow mode, fetch extracted content from `book_chapters`
  - Add "View Original PDF" toggle for PDF books
  - Use `react-native-render-html` (already used for Markdown) for reflow content
  - Maintain all existing features: font size, themes, bookmarks, highlights, notes, TOC

#### 8. Storage Organization
- Extend existing `documents` bucket with subdirectories:
  - `documents/pdf/`
  - `documents/epub/`
  - `documents/docx/`
  - `documents/md/`
  - `documents/extracted/` — for extracted text content as JSON

### Architecture Diagram

```
graph LR
  A[Admin Upload Screen] --> B[File Validation]
  B --> C[Supabase Storage]
  C --> D[process-document Edge Function]
  D --> E{Format Detection}
  E -->|PDF| F[pdf-parse]
  E -->|EPUB| G[adm-zip + XML]
  E -->|DOCX| H[unzip + XML]
  E -->|MD| I[Direct Parse]
  F --> J[Structured Output]
  G --> J
  H --> J
  I --> J
  J --> K[book_chapters DB]
  J --> L[audio_segments DB]
  J --> M[audio_alignments DB]
  K --> N[Reader - Reflow Mode]
  C --> O[Reader - Original PDF]
  N --> P[react-native-render-html]
```

### File Structure

**New Files:**
- `supabase/migrations/20251107000000_multi_format_support.sql` — Additive database migration
- `supabase/functions/process-document/index.ts` — Unified document processing Edge Function
- `supabase/config.toml` — Supabase CLI configuration
- `supabase/functions/process-document/.env` — Edge Function environment variables (gitignored)

**Modified Files:**
- `src/types/index.ts` — Extend Book type
- `src/lib/admin/fileValidation.ts` — Add EPUB/DOCX support
- `src/lib/admin/textProcessing.ts` — Route through unified Edge Function
- `app/admin/upload/index.tsx` — Add format selectors and processing
- `app/book/[id]/reader/index.tsx` — Add reflow mode and PDF toggle
- `supabase/schema.sql` — Document schema changes (reference only)

### Risks
1. **EPUB/DOCX parsing complexity**: These formats use ZIP-compressed XML internally. The Edge Function needs robust parsing. Mitigation: use well-tested Node.js libraries (adm-zip for EPUB, unzipper for DOCX).
2. **Large PDF extraction timeout**: Edge Functions have a 5-minute timeout. Very large PDFs may timeout. Mitigation: chunk processing and return partial results.
3. **Reflow mode loses PDF formatting**: Images, tables, and complex layouts may not render perfectly in reflow mode. Mitigation: keep original PDF view as fallback.
4. **Existing book compatibility**: Changing the `document_type` CHECK constraint requires an ALTER TABLE. Mitigation: use `DROP CONSTRAINT` + `ADD CONSTRAINT` pattern in migration.

# Testing

### Validation Approach
Verify that all changes work correctly without breaking existing functionality by testing each format path independently.

### Key Scenarios
1. **EPUB Upload Flow**: Admin uploads an EPUB file → file validates → uploads to storage → Edge Function processes → chapters created → book appears in library → reader shows reflow content.
2. **DOCX Upload Flow**: Admin uploads a DOCX file → same pipeline as EPUB → structured content rendered in reader.
3. **PDF Reflow Mode**: Existing PDF book opens in reader → defaults to reflow mode with extracted text → font size adjustment works → "View Original PDF" toggle switches to native PDF viewer.
4. **Markdown Compatibility**: Existing Markdown books continue to work exactly as before.
5. **Processing Status**: Admin can see processing status (pending/processing/completed/failed) for uploaded books.
6. **Format Detection**: Uploading a file with wrong extension shows a validation error.
7. **Large File Handling**: Uploading a large PDF (>50MB) shows progress and completes without timeout.

### Edge Cases
1. **Corrupt EPUB/DOCX**: Edge Function returns error, processing_status set to 'failed', admin sees error message.
2. **Scanned PDF in reflow mode**: Text extraction returns empty content, falls back to original PDF view with a message.
3. **EPUB with embedded images**: Images are extracted and included in reflow content where possible.
4. **DOCX with complex tables**: Tables converted to HTML tables in reflow content.
5. **Network interruption during processing**: Processing can be retried from admin dashboard.
6. **Book with no chapters detected**: System creates a single "Full Document" chapter.

### Test Changes
- No existing tests are modified
- Manual device testing required for all format paths
- Edge Function testing via Supabase CLI local development

# Delivery Steps

### ✓ Step 1: Database migration for multi-format support
Create an additive SQL migration that extends the database schema to support EPUB and DOCX formats.

- Create `supabase/migrations/20251107000000_multi_format_support.sql`
- Extend `books.document_type` CHECK constraint to include 'epub' and 'docx'
- Add `books.processing_status` column (pending/processing/completed/failed)
- Add `books.total_chapters` column (INTEGER DEFAULT 0)
- Add `books.total_pages` column (INTEGER)
- Add `books.content_format` column (original/reflow, DEFAULT 'original')
- Create `book_processing_jobs` table with columns: id, book_id, status, error_message, started_at, completed_at
- Add RLS policies for `book_processing_jobs` (admin-only write, published-book read)
- Add indexes for frequently queried columns
- Update `supabase/schema.sql` to reflect changes for documentation

### ✓ Step 2: Unified process-document Edge Function
Create a single Edge Function that handles content extraction for all supported formats.

- Create `supabase/functions/process-document/index.ts`
- Implement format detection based on file extension/MIME type
- PDF processing: use pdf-parse to extract text with page numbers and heading detection
- EPUB processing: use adm-zip to unzip, parse container.xml, content.opf, and chapter HTML files
- DOCX processing: use unzipper to extract, parse document.xml for headings and paragraphs
- Markdown processing: direct text parsing (existing logic from textProcessing.ts)
- Return structured output: chapters array with title, order_index, content (HTML), full text, metadata (totalPages, totalChapters)
- Handle errors gracefully with status tracking
- Add CORS headers for app access
- Keep the existing `extract-pdf-text` Edge Function for backward compatibility

### ✓ Step 3: Extend file validation and types
Update the file validation utility and TypeScript types to support new formats.

- Update `src/lib/admin/fileValidation.ts`:
  - Add 'epub' and 'docx' to ALLOWED_EXTENSIONS
  - Add file size limits: epub 50MB, docx 25MB
  - Update getFileType to recognize new extensions
  - Add MIME type validation for epub (application/epub+zip) and docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- Update `src/types/index.ts`:
  - Extend Book.document_type: 'pdf' | 'markdown' | 'epub' | 'docx'
  - Add processing_status, total_chapters, total_pages, content_format to Book interface
  - Add BookProcessingJob interface
- Update `src/lib/admin/textProcessing.ts`:
  - Route PDF, EPUB, and DOCX through the unified process-document Edge Function
  - Keep Markdown client-side processing as fallback
  - Handle the unified structured response format
  - Update ProcessingResult and ProcessingProgress types

### ✓ Step 4: Enhance admin upload screen for multi-format
Update the admin upload screen to support EPUB and DOCX uploads with processing status tracking.

- Update `app/admin/upload/index.tsx`:
  - Add EPUB and DOCX options to the document type selector (currently only PDF/Markdown)
  - Update documentType state type to include 'epub' | 'docx'
  - Update pickDocument to handle new MIME types via expo-document-picker
  - After upload, call process-document Edge Function for all formats (not just PDF)
  - Show processing progress with stage indicators
  - Display processing status (pending/processing/completed/failed)
  - Show extracted chapter count and metadata after processing
  - Add retry button for failed processing
  - Update file validation call to use new format types
- Update `app/admin/books/index.tsx`:
  - Display processing status badge on each book
  - Show total chapters and pages in book list
  - Add filter by processing status

### ✓ Step 5: Implement PDF reflow mode in reader
Add reflow rendering mode to the reader so PDFs auto-fit the screen with adjustable font size.

- Update `app/book/[id]/reader/index.tsx`:
  - Add a `viewMode` state: 'reflow' | 'original' (default 'reflow' for PDF books)
  - For PDF books: fetch processed chapter content from book_chapters table
  - Render reflow content using react-native-render-html (same as Markdown path)
  - Add "View Original PDF" / "View Reflow" toggle button in the reader header
  - When in reflow mode: use extracted HTML content with existing font size, theme, and spacing settings
  - When in original PDF mode: use existing PdfReader component
  - Preserve all existing reader features in both modes: bookmarks, highlights, notes, TOC, progress tracking
  - For reflow mode: map scroll position to progress percentage
  - For EPUB and DOCX books: default to reflow mode (no original view toggle needed)
  - For Markdown books: no change, continue as before
- Update chapter navigation to work with reflow content: load chapter HTML by order_index
- Ensure Table of Contents works with reflow content by using extracted chapters

### ✓ Step 6: Storage organization and integration testing
Organize storage buckets and verify the complete end-to-end flow for all formats.

- Update storage upload paths in `app/admin/upload/index.tsx`:
  - Upload PDFs to `documents/pdf/{uuid}.{ext}`
  - Upload EPUBs to `documents/epub/{uuid}.{ext}`
  - Upload DOCXs to `documents/docx/{uuid}.{ext}`
  - Upload Markdown to `documents/md/{uuid}.{ext}`
  - Store extracted content JSON in `documents/extracted/{book_id}.json`
- Verify storage RLS policies cover new subdirectories (existing policies use bucket-level, so no change needed)
- End-to-end verification:
  - Test EPUB upload → processing → reflow reading
  - Test DOCX upload → processing → reflow reading
  - Test PDF upload → processing → reflow reading + original PDF toggle
  - Test Markdown upload → continues working as before
  - Test processing failure handling and retry
  - Test large file upload with progress indicator
  - Verify existing books are not affected
  - Verify admin-only access to upload and processing
  - Verify reader font size, themes, and navigation work in reflow mode

### ✓ Step 7: Deploy Edge Function and database migration
Deploy the process-document Edge Function and apply database migrations to the Supabase project.

- Create `supabase/config.toml` via `supabase init`
- Create `supabase/functions/process-document/.env` with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Deploy Edge Function: `supabase functions deploy process-document` — confirmed deployed
- Apply database migration: `supabase db push` — confirmed applied
- Set SUPABASE_SERVICE_ROLE_KEY in .env and redeployed
- Verify deployment at Supabase Dashboard

### ✓ Step 8: System testing and verification
Verify all components work correctly end-to-end.

- TypeScript compilation: passes with zero errors
- Edge Function: deployed and responding (tested with service role key auth)
- Edge Function validation: returns `{"error":"documentUrl is required"}` for missing params — correct
- Edge Function processing: returns `{"error":"Failed to download document: 404"}` for invalid URLs — correct structured response
- Database migration: applied successfully via `supabase db push`
- All modified files reviewed: admin upload, reader, text processing, file validation, types
- Admin upload screen: 4-format selector (PDF/EPUB/DOCX/MD) with proper MIME types
- Reader: reflow mode with PDF toggle, chapter navigation, and HTML rendering
- Storage paths: format-specific subdirectories (pdf/, epub/, docx/, md/)
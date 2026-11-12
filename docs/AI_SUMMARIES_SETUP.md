# AI Summaries Setup Guide

AI-powered summaries bring intelligent insights to your EODH ebook reader. This feature generates book overviews, key takeaways, comprehension questions, and study flashcards using OpenAI's GPT models.

## What You Get

- **Book Overview**: Comprehensive summary with themes, key points, reading level, and target audience
- **Key Takeaways**: Important insights with quotes and action items
- **Comprehension Questions**: Multiple-choice, short-answer, and discussion questions with answers
- **Study Flashcards**: Interactive flashcards for active learning and review

## Prerequisites

1. An OpenAI API key ([get one here](https://platform.openai.com/api-keys))
2. Supabase CLI installed and linked to your project
3. The EODH codebase with the AI summaries migration

## Setup Steps

### 1. Run the Database Migration

Push the migration to create the `ai_summaries` table:

```powershell
supabase db push
```

This creates:
- `ai_summaries` table with RLS policies (public read, admin write)
- `has_ai_summary` and `ai_summary_status` columns on the `books` table

### 2. Set Your OpenAI API Key

Set the API key as a Supabase Edge Function secret:

```powershell
supabase secrets set OPENAI_API_KEY='sk-proj-your-key-here'
```

### 3. Deploy the Edge Function

```powershell
supabase functions deploy generate-summary
```

### 4. Verify Deployment

```powershell
supabase functions list
```

You should see `generate-summary` listed alongside `generate-tts` and `process-document`.

## Usage

### In the Reader

1. Open any book in the reader
2. Tap the **⋮** (more options) button in the header
3. Select **"AI Insights"** from the menu
4. The AI Summary panel opens with tabs for Overview, Takeaways, Questions, and Flashcards
5. Tap **"Generate"** to create AI-powered insights for the book
6. Pull down to regenerate at any time

### For Admins (Batch Generation)

After uploading a book, the admin can generate all summaries programmatically using the client library:

```typescript
import { generateAllBookSummaries, generateAllChapterSummaries } from '@/lib/ai/summaries';

// Generate book-level summaries
await generateAllBookSummaries(bookId, fullText, bookTitle);

// Generate chapter-level summaries
await generateAllChapterSummaries(bookId, chapters);
```

## Cost Estimates

OpenAI's GPT-4o-mini pricing:
- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens

A typical ebook (50,000 words ≈ 12,500 tokens):
- Book overview: ~$0.02
- Key takeaways: ~$0.02
- Comprehension questions: ~$0.02
- Flashcards: ~$0.02
- **Total per book**: ~$0.08

Chapter summaries add ~$0.02 per chapter.

## Model Options

The default model is `gpt-4o-mini` (fast and cost-effective). You can use any OpenAI chat model by setting the `model` parameter:

```typescript
await generateSummary(bookId, 'book_overview', content, title, {
  model: 'gpt-4o',  // Higher quality, more expensive
});
```

## Content Limits

To stay within API token limits, content is intelligently truncated:

| Summary Type | Max Characters |
|--------------|----------------|
| Book Overview | 40,000 |
| Chapter Summary | 30,000 |
| Key Takeaways | 30,000 |
| Questions | 25,000 |
| Flashcards | 25,000 |

For longer content, the system keeps the beginning, a middle sample, and the end to preserve context.

## Troubleshooting

### "OpenAI API key not configured"
- Make sure you ran `supabase secrets set OPENAI_API_KEY='sk-...'`
- Verify with `supabase functions logs generate-summary`

### "Failed to generate summary"
- Check your OpenAI API credits at [platform.openai.com](https://platform.openai.com)
- Verify the Edge Function is deployed: `supabase functions list`
- Check logs: `supabase functions logs generate-summary`

### Summaries not showing in the reader
- Ensure the database migration was applied: `supabase db push`
- Check that the book has content (`rawContent` is not empty)
- Try generating manually in the AI Insights panel

## Architecture

```
Reader (AISummaryPanel)
    ↓
Client Library (src/lib/ai/summaries.ts)
    ↓
Supabase Edge Function (generate-summary)
    ↓
OpenAI API (GPT-4o-mini)
    ↓
Response stored in ai_summaries table
    ↓
Cached for future reads (no additional API cost)
```

Summaries are cached in the database after generation, so you only pay for the API call once per book per summary type.

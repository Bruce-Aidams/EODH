/**
 * AI Summaries client library for EODH
 * 
 * Fetches and generates AI-powered summaries, key takeaways,
 * comprehension questions, and flashcards via Supabase Edge Functions.
 */

import { supabase } from '@/lib/supabase/client';

// =====================================================
// Types
// =====================================================

export type SummaryType = 'book_overview' | 'chapter_summary' | 'key_takeaways' | 'comprehension_questions' | 'flashcards';

export interface BookOverview {
  overview: string;
  themes: string[];
  keyPoints: string[];
  readingLevel: string;
  estimatedReadTime: string | null;
  targetAudience: string;
}

export interface ChapterSummary {
  summary: string;
  keyPoints: string[];
  importantTerms: string[];
  connectionToPrevious: string | null;
  preview: string | null;
}

export interface KeyTakeaway {
  title: string;
  description: string;
  quote: string | null;
  importance: 'high' | 'medium' | 'low';
}

export interface KeyTakeaways {
  takeaways: KeyTakeaway[];
  bigIdea: string;
  actionItems: string[];
}

export interface ComprehensionQuestion {
  question: string;
  type: 'multiple_choice' | 'short_answer' | 'discussion';
  difficulty: 'easy' | 'medium' | 'hard';
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface ComprehensionQuestions {
  questions: ComprehensionQuestion[];
}

export interface Flashcard {
  front: string;
  back: string;
  category: 'Definition' | 'Concept' | 'Quote' | 'Fact';
}

export interface Flashcards {
  flashcards: Flashcard[];
}

export type SummaryContent = BookOverview | ChapterSummary | KeyTakeaways | ComprehensionQuestions | Flashcards;

export interface AISummary {
  id: string;
  book_id: string;
  chapter_id: string | null;
  summary_type: SummaryType;
  content: SummaryContent;
  model: string;
  token_count: number;
  generated_at: string;
}

export interface GenerateSummaryOptions {
  model?: string;
  forceRegenerate?: boolean;
}

// =====================================================
// Fetch Summaries
// =====================================================

/**
 * Fetch all summaries for a book
 */
export async function getBookSummaries(bookId: string): Promise<Record<SummaryType, AISummary | null>> {
  const { data, error } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('book_id', bookId)
    .is('chapter_id', null);

  if (error) {
    console.error('Failed to fetch book summaries:', error);
    return {
      book_overview: null,
      chapter_summary: null,
      key_takeaways: null,
      comprehension_questions: null,
      flashcards: null,
    };
  }

  const summaries: Record<SummaryType, AISummary | null> = {
    book_overview: null,
    chapter_summary: null,
    key_takeaways: null,
    comprehension_questions: null,
    flashcards: null,
  };

  for (const summary of (data || [])) {
    summaries[summary.summary_type as SummaryType] = summary as AISummary;
  }

  return summaries;
}

/**
 * Fetch a specific summary for a book
 */
export async function getBookSummary(bookId: string, type: SummaryType): Promise<AISummary | null> {
  const { data, error } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('book_id', bookId)
    .eq('summary_type', type)
    .is('chapter_id', null)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Failed to fetch summary:', error);
    return null;
  }

  return (data || null) as AISummary | null;
}

/**
 * Fetch chapter summary for a specific chapter
 */
export async function getChapterSummary(bookId: string, chapterId: string): Promise<AISummary | null> {
  const { data, error } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('book_id', bookId)
    .eq('chapter_id', chapterId)
    .eq('summary_type', 'chapter_summary')
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to fetch chapter summary:', error);
    return null;
  }

  return (data || null) as AISummary | null;
}

/**
 * Fetch all chapter summaries for a book
 */
export async function getAllChapterSummaries(bookId: string): Promise<AISummary[]> {
  const { data, error } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('book_id', bookId)
    .eq('summary_type', 'chapter_summary')
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch chapter summaries:', error);
    return [];
  }

  return (data || []) as AISummary[];
}

// =====================================================
// Generate Summaries
// =====================================================

/**
 * Generate a summary via the Edge Function
 */
export async function generateSummary(
  bookId: string,
  summaryType: SummaryType,
  content: string,
  title?: string,
  options: GenerateSummaryOptions = {}
): Promise<{ summaryId: string; content: SummaryContent; tokenCount: number }> {
  const { model } = options;

  const { data, error } = await supabase.functions.invoke('generate-summary', {
    body: {
      bookId,
      chapterId: null,
      summaryType,
      content,
      title,
      model: model || 'gpt-4o-mini',
    },
  });

  if (error) {
    throw new Error(`Failed to generate summary: ${error.message}`);
  }

  return {
    summaryId: data.summaryId,
    content: data.content,
    tokenCount: data.tokenCount,
  };
}

/**
 * Generate a chapter summary via the Edge Function
 */
export async function generateChapterSummary(
  bookId: string,
  chapterId: string,
  content: string,
  title?: string,
  options: GenerateSummaryOptions = {}
): Promise<{ summaryId: string; content: ChapterSummary; tokenCount: number }> {
  const { model } = options;

  const { data, error } = await supabase.functions.invoke('generate-summary', {
    body: {
      bookId,
      chapterId,
      summaryType: 'chapter_summary' as const,
      content,
      title,
      model: model || 'gpt-4o-mini',
    },
  });

  if (error) {
    throw new Error(`Failed to generate chapter summary: ${error.message}`);
  }

  return {
    summaryId: data.summaryId,
    content: data.content as ChapterSummary,
    tokenCount: data.tokenCount,
  };
}

/**
 * Generate all book-level summaries at once
 */
export async function generateAllBookSummaries(
  bookId: string,
  fullText: string,
  title: string,
  options: GenerateSummaryOptions = {}
): Promise<Array<{ type: SummaryType; summaryId: string; tokenCount: number }>> {
  const types: SummaryType[] = ['book_overview', 'key_takeaways', 'comprehension_questions', 'flashcards'];
  const results = [];

  for (const type of types) {
    try {
      const result = await generateSummary(bookId, type, fullText, title, options);
      results.push({ type, summaryId: result.summaryId, tokenCount: result.tokenCount });
    } catch (error) {
      console.error(`Failed to generate ${type}:`, error);
    }
  }

  return results;
}

/**
 * Generate summaries for all chapters of a book
 */
export async function generateAllChapterSummaries(
  bookId: string,
  chapters: Array<{ id: string; title: string; content: string }>,
  options: GenerateSummaryOptions = {}
): Promise<Array<{ chapterId: string; summaryId: string; tokenCount: number }>> {
  const results = [];

  // Process chapters sequentially to avoid rate limiting
  for (const chapter of chapters) {
    try {
      const result = await generateChapterSummary(
        bookId,
        chapter.id,
        chapter.content,
        chapter.title,
        options
      );
      results.push({ chapterId: chapter.id, summaryId: result.summaryId, tokenCount: result.tokenCount });
    } catch (error) {
      console.error(`Failed to generate summary for chapter ${chapter.id}:`, error);
    }
  }

  return results;
}

/**
 * Check if AI summaries are available (Edge Function is deployed)
 */
export async function isAISummaryAvailable(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('generate-summary', {
      body: {
        bookId: 'test',
        summaryType: 'book_overview',
        content: 'test',
      },
    });

    // 500 error for missing API key means the function is deployed
    // 400/404 means it's not deployed
    return !error || error.status === 500;
  } catch {
    return false;
  }
}

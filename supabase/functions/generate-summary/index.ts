// Supabase Edge Function: generate-summary
//
// Generates AI-powered summaries, key takeaways, comprehension questions,
// and flashcards using OpenAI's GPT API.
//
// Deployment:
// 1. Link your project: supabase link --project-ref <your-project-ref>
// 2. Set OpenAI API key:
//    supabase secrets set OPENAI_API_KEY='sk-...'
// 3. Deploy: supabase functions deploy generate-summary
//
// Request body:
//   {
//     "bookId": "uuid",
//     "chapterId": "uuid",              // optional, null for book-level summaries
//     "summaryType": "book_overview",   // book_overview | chapter_summary | key_takeaways | comprehension_questions | flashcards
//     "content": "The text content...", // the book/chapter text to summarize
//     "title": "Chapter Title",         // optional, the book/chapter title for context
//     "model": "gpt-4o-mini"            // optional, defaults to gpt-4o-mini
//   }
//
// Response:
//   {
//     "summaryId": "uuid",
//     "content": { ... },               // structured summary data
//     "tokenCount": 1234,
//     "model": "gpt-4o-mini"
//   }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SummaryRequest {
  bookId: string;
  chapterId?: string | null;
  summaryType: 'book_overview' | 'chapter_summary' | 'key_takeaways' | 'comprehension_questions' | 'flashcards';
  content: string;
  title?: string;
  model?: string;
}

// =====================================================
// Prompt Templates
// =====================================================

function getSystemPrompt(summaryType: string, title?: string): string {
  const context = title ? ` about "${title}"` : '';
  
  switch (summaryType) {
    case 'book_overview':
      return `You are an expert literary analyst. Generate a comprehensive book overview${context}. 
Return a JSON object with this exact structure:
{
  "overview": "A 3-5 paragraph summary covering the main themes, arguments, and narrative arc",
  "themes": ["Theme 1", "Theme 2", "Theme 3"],
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "readingLevel": "Beginner | Intermediate | Advanced",
  "estimatedReadTime": "Estimated reading time in minutes",
  "targetAudience": "Who would benefit most from this book"
}`;

    case 'chapter_summary':
      return `You are an expert literary analyst. Generate a concise chapter summary${context}.
Return a JSON object with this exact structure:
{
  "summary": "A 2-3 paragraph summary of this chapter's main content",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "importantTerms": ["Term 1", "Term 2"],
  "connectionToPrevious": "How this chapter connects to what came before (or null if first chapter)",
  "preview": "What to expect in the next chapter (if apparent from context)"
}`;

    case 'key_takeaways':
      return `You are an expert educator. Extract the most important takeaways${context}.
Return a JSON object with this exact structure:
{
  "takeaways": [
    {
      "title": "Short title for this takeaway",
      "description": "Detailed explanation (2-3 sentences)",
      "quote": "A relevant quote from the text (or null if none found)",
      "importance": "high | medium | low"
    }
  ],
  "bigIdea": "The single most important idea from this content in one sentence",
  "actionItems": ["Action 1", "Action 2"]
}`;

    case 'comprehension_questions':
      return `You are an expert educator creating reading comprehension questions${context}.
Return a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "The question text",
      "type": "multiple_choice | short_answer | discussion",
      "difficulty": "easy | medium | hard",
      "options": ["Option A", "Option B", "Option C", "Option D"],  // only for multiple_choice
      "correctAnswer": "The correct answer or option letter",
      "explanation": "Why this is the correct answer"
    }
  ]
}`;

    case 'flashcards':
      return `You are an expert educator creating study flashcards${context}.
Return a JSON object with this exact structure:
{
  "flashcards": [
    {
      "front": "The question or term",
      "back": "The answer or definition (2-3 sentences max)",
      "category": "Definition | Concept | Quote | Fact"
    }
  ]
}`;

    default:
      return 'Generate a summary of the provided text. Return valid JSON.';
  }
}

/**
 * Truncate content to fit within token limits while preserving meaning
 */
function prepareContent(content: string, summaryType: string): string {
  // Different summary types have different content length needs
  const maxChars: Record<string, number> = {
    'book_overview': 40000,      // ~10,000 tokens
    'chapter_summary': 30000,    // ~7,500 tokens
    'key_takeaways': 30000,
    'comprehension_questions': 25000,
    'flashcards': 25000,
  };

  const limit = maxChars[summaryType] || 30000;
  
  if (content.length <= limit) {
    return content;
  }

  // Smart truncation: keep beginning, middle sample, and end
  const beginEndLength = Math.floor(limit * 0.4);
  const middleLength = limit - (beginEndLength * 2);
  
  const begin = content.substring(0, beginEndLength);
  const middleStart = Math.floor((content.length - middleLength) / 2);
  const middle = content.substring(middleStart, middleStart + middleLength);
  const end = content.substring(content.length - beginEndLength);

  return `${begin}\n\n... [content truncated] ...\n\n${middle}\n\n... [content truncated] ...\n\n${end}`;
}

/**
 * Call OpenAI API to generate a summary
 */
async function generateWithOpenAI(
  content: string,
  systemPrompt: string,
  model: string
): Promise<{ response: string; tokenCount: number }> {
  const preparedContent = prepareContent(content, systemPrompt.includes('book_overview') ? 'book_overview' : 
    systemPrompt.includes('chapter_summary') ? 'chapter_summary' :
    systemPrompt.includes('key_takeaways') ? 'key_takeaways' :
    systemPrompt.includes('comprehension_questions') ? 'comprehension_questions' : 'flashcards');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: preparedContent },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  const tokenCount = data.usage?.total_tokens || 0;
  const generatedText = data.choices?.[0]?.message?.content || '';

  if (!generatedText) {
    throw new Error('OpenAI returned empty response');
  }

  return { response: generatedText, tokenCount };
}

/**
 * Parse and validate the JSON response from OpenAI
 */
function parseSummaryResponse(text: string, summaryType: string): any {
  try {
    const parsed = JSON.parse(text);
    
    // Validate structure based on type
    switch (summaryType) {
      case 'book_overview':
        return {
          overview: parsed.overview || '',
          themes: parsed.themes || [],
          keyPoints: parsed.keyPoints || [],
          readingLevel: parsed.readingLevel || 'Intermediate',
          estimatedReadTime: parsed.estimatedReadTime || null,
          targetAudience: parsed.targetAudience || '',
        };
      
      case 'chapter_summary':
        return {
          summary: parsed.summary || '',
          keyPoints: parsed.keyPoints || [],
          importantTerms: parsed.importantTerms || [],
          connectionToPrevious: parsed.connectionToPrevious || null,
          preview: parsed.preview || null,
        };
      
      case 'key_takeaways':
        return {
          takeaways: parsed.takeaways || [],
          bigIdea: parsed.bigIdea || '',
          actionItems: parsed.actionItems || [],
        };
      
      case 'comprehension_questions':
        return {
          questions: parsed.questions || [],
        };
      
      case 'flashcards':
        return {
          flashcards: parsed.flashcards || [],
        };
      
      default:
        return parsed;
    }
  } catch (error) {
    console.error('Failed to parse OpenAI response:', error);
    // Return a fallback structure
    return {
      error: 'Failed to parse AI response',
      rawText: text,
    };
  }
}

/**
 * Store the summary in the database
 */
async function storeSummary(
  bookId: string,
  chapterId: string | null,
  summaryType: string,
  content: any,
  model: string,
  tokenCount: number
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_summaries')
    .upsert({
      book_id: bookId,
      chapter_id: chapterId,
      summary_type: summaryType,
      content: content,
      model: model,
      token_count: tokenCount,
    }, {
      onConflict: 'book_id, chapter_id, summary_type',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store summary: ${error.message}`);
  }

  // Update book's AI summary status
  await supabase
    .from('books')
    .update({
      has_ai_summary: true,
      ai_summary_status: 'completed',
    })
    .eq('id', bookId);

  return data.id;
}

serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SummaryRequest = await req.json();
    const { bookId, chapterId, summaryType, content, title, model } = body;

    if (!bookId || !summaryType || !content) {
      return new Response(
        JSON.stringify({ error: 'bookId, summaryType, and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if summary already exists
    const { data: existing } = await supabase
      .from('ai_summaries')
      .select('id, content, model, token_count')
      .eq('book_id', bookId)
      .eq('chapter_id', chapterId || null)
      .eq('summary_type', summaryType)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          summaryId: existing.id,
          content: existing.content,
          tokenCount: existing.token_count,
          model: existing.model,
          cached: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update book status to generating
    await supabase
      .from('books')
      .update({ ai_summary_status: 'generating' })
      .eq('id', bookId);

    // Generate the summary
    const systemPrompt = getSystemPrompt(summaryType, title);
    const { response: aiResponse, tokenCount } = await generateWithOpenAI(
      content,
      systemPrompt,
      model || 'gpt-4o-mini'
    );

    // Parse the response
    const parsedContent = parseSummaryResponse(aiResponse, summaryType);

    // Store in database
    const summaryId = await storeSummary(
      bookId,
      chapterId || null,
      summaryType,
      parsedContent,
      model || 'gpt-4o-mini',
      tokenCount
    );

    return new Response(
      JSON.stringify({
        summaryId,
        content: parsedContent,
        tokenCount,
        model: model || 'gpt-4o-mini',
        cached: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Summary generation error:', error);

    // Update book status to failed if possible
    try {
      const body = await req.clone().json();
      if (body.bookId) {
        await supabase
          .from('books')
          .update({ ai_summary_status: 'failed' })
          .eq('id', body.bookId);
      }
    } catch {
      // Ignore errors in error handling
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate summary',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

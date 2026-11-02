// Supabase Edge Function: extract-pdf-text
//
// Extracts text from PDF documents uploaded to Supabase Storage.
// Uses pdf-parse to extract text content with page-level data.
//
// Deployment:
// 1. Install Supabase CLI: https://supabase.com/docs/guides/cli
// 2. Link your project: supabase link --project-ref <your-project-ref>
// 3. Deploy: supabase functions deploy extract-pdf-text
//
// Dependencies:
//   npm install @supabase/supabase-js pdf-parse

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PdfPage {
  pageNumber: number;
  text: string;
}

interface ExtractResponse {
  fullText: string;
  pages: PdfPage[];
  totalPages: number;
  isScanned: boolean;
  needsOcr: boolean;
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentUrl } = await req.json();

    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: 'documentUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the PDF from Supabase Storage
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    // Check if the buffer is too small (likely not a valid PDF)
    if (pdfBuffer.byteLength < 100) {
      return new Response(
        JSON.stringify({
          fullText: '',
          pages: [],
          totalPages: 0,
          isScanned: true,
          needsOcr: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use pdf-parse to extract text
    // Note: pdf-parse needs to be imported as a dynamic import in Deno
    const pdf = await import('npm:pdf-parse@1.1.1');
    const data = await pdf.default(Buffer.from(pdfBuffer));

    // Split text by page
    const pages: PdfPage[] = [];
    const text = data.text || '';
    
    // pdf-parse doesn't provide page-level text by default,
    // so we split by common page break patterns
    const lines = text.split('\n');
    let currentPage = 1;
    let pageText = '';
    let pageBreakCount = 0;

    for (const line of lines) {
      pageText += line + '\n';
      
      // Simple heuristic: estimate page breaks by text length
      if (pageText.length > 3000 && pageBreakCount < data.numpages - 1) {
        pages.push({
          pageNumber: currentPage,
          text: pageText.trim(),
        });
        currentPage++;
        pageText = '';
        pageBreakCount++;
      }
    }

    // Add remaining text as the last page
    if (pageText.trim()) {
      pages.push({
        pageNumber: currentPage,
        text: pageText.trim(),
      });
    }

    // If we couldn't split by pages, create a single page entry
    if (pages.length === 0 && text) {
      pages.push({
        pageNumber: 1,
        text,
      });
    }

    // Detect if PDF is scanned (very little text extracted)
    const isScanned = text.trim().length < 100 && data.numpages > 0;
    const needsOcr = isScanned || text.trim().length === 0;

    const result: ExtractResponse = {
      fullText: text.trim(),
      pages,
      totalPages: data.numpages || pages.length,
      isScanned,
      needsOcr,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('PDF extraction error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to extract PDF text',
        fullText: '',
        pages: [],
        totalPages: 0,
        isScanned: false,
        needsOcr: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Supabase Edge Function: process-document
//
// Unified document processing pipeline for all supported ebook formats.
// Extracts text, chapters, headings, and structure from PDF, EPUB, DOCX, and Markdown.
//
// Deployment:
// 1. Install Supabase CLI: https://supabase.com/docs/guides/cli
// 2. Link your project: supabase link --project-ref <your-project-ref>
// 3. Deploy: supabase functions deploy process-document
//
// Dependencies:
//   npm install pdf-parse adm-zip

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Buffer } from 'node:buffer';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Chapter {
  title: string;
  order_index: number;
  content: string;
  page_start?: number;
  page_end?: number;
}

interface ProcessResponse {
  chapters: Chapter[];
  fullText: string;
  totalPages: number;
  totalChapters: number;
  isScanned?: boolean;
  needsOcr?: boolean;
}

// =====================================================
// Format Detection
// =====================================================

function detectFormat(url: string): 'pdf' | 'epub' | 'docx' | 'markdown' {
  const lower = url.toLowerCase().split('?')[0]; // remove query params
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  throw new Error(`Unsupported file format: ${url}`);
}

// =====================================================
// PDF Processing
// =====================================================

async function processPdf(buffer: ArrayBuffer): Promise<ProcessResponse> {
  const pdf = await import('npm:pdf-parse@1.1.1');
  const data = await pdf.default(Buffer.from(buffer));

  let text = data.text || '';
  const totalPages = data.numpages || 1;

  // Clean up common PDF extraction artifacts
  text = cleanPdfText(text);

  // Detect if PDF is scanned
  const isScanned = text.trim().length < 100 && totalPages > 0;

  // Extract chapters by detecting headings with improved patterns
  const chapters = extractChaptersFromText(text, totalPages);

  return {
    chapters,
    fullText: text.trim(),
    totalPages,
    totalChapters: chapters.length,
    isScanned,
    needsOcr: isScanned || text.trim().length === 0,
  };
}

// Clean up common PDF text extraction artifacts
function cleanPdfText(text: string): string {
  return text
    // Remove excessive whitespace between words (common in PDF extraction)
    .replace(/[\t\u00A0]+/g, ' ')
    // Fix broken hyphenation at line ends (word split across lines with hyphen)
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
    // Remove orphan hyphens at end of lines
    .replace(/-\s*\n/g, '\n')
    // Normalize multiple blank lines to double newline (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove form feed characters
    .replace(/\f/g, '\n')
    // Trim each line
    .split('\n').map(line => line.trim()).join('\n')
    // Remove leading/trailing whitespace
    .trim();
}

// =====================================================
// EPUB Processing
// =====================================================

async function processEpub(buffer: ArrayBuffer): Promise<ProcessResponse> {
  const AdmZip = (await import('npm:adm-zip@0.5.10')).default;
  const zip = new AdmZip(Buffer.from(buffer));
  const entries = zip.getEntries();

  // Find container.xml to locate the OPF file
  const containerEntry = entries.find(e => e.entryName === 'META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const containerXml = containerEntry.getData().toString('utf8');
  const opfMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfMatch) {
    throw new Error('Invalid EPUB: cannot find OPF file in container.xml');
  }

  const opfPath = opfMatch[1];
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // Parse OPF file to get spine (chapter order) and manifest
  const opfEntry = entries.find(e => e.entryName === opfPath);
  if (!opfEntry) {
    throw new Error('Invalid EPUB: OPF file not found');
  }

  const opfXml = opfEntry.getData().toString('utf8');

  // Extract manifest items (ID to href mapping)
  const manifest: Record<string, string> = {};
  const manifestRegex = /<item\s+id="([^"]+)"\s+href="([^"]+)"/g;
  let m;
  while ((m = manifestRegex.exec(opfXml)) !== null) {
    manifest[m[1]] = m[2];
  }

  // Extract spine (ordered list of chapter IDs)
  const spineRegex = /<itemref\s+idref="([^"]+)"/g;
  const spineIds: string[] = [];
  let s;
  while ((s = spineRegex.exec(opfXml)) !== null) {
    spineIds.push(s[1]);
  }

  // Extract metadata
  const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const dcTitle = titleMatch ? titleMatch[1].trim() : '';

  // Process each chapter in spine order
  const chapters: Chapter[] = [];
  let orderIndex = 0;

  for (const spineId of spineIds) {
    const href = manifest[spineId];
    if (!href) continue;

    const chapterPath = opfDir + href;
    const chapterEntry = entries.find(e => e.entryName === chapterPath);
    if (!chapterEntry) continue;

    let content = chapterEntry.getData().toString('utf8');

    // Skip NCX (TOC) files and non-HTML files
    if (content.includes('<ncx') || !content.includes('<html') && !content.includes('<body')) {
      continue;
    }

    // Extract chapter title from the HTML content
    let chapterTitle = `Chapter ${orderIndex + 1}`;
    const titleMatch = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      chapterTitle = titleMatch[1].trim();
    } else {
      const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
      if (h2Match) {
        chapterTitle = h2Match[1].trim();
      }
    }

    // Clean up the HTML content - extract body content
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1].trim();
    }

    // Clean up common EPUB artifacts
    content = content
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '') // Remove SVGs
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\n+/g, '\n') // Normalize newlines
      .trim();

    if (content.length > 10) {
      chapters.push({
        title: chapterTitle,
        order_index: orderIndex,
        content,
      });
      orderIndex++;
    }
  }

  // If no chapters found, create a single chapter with all text
  if (chapters.length === 0) {
    const allText = entries
      .filter(e => e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.html'))
      .map(e => {
        let text = e.getData().toString('utf8');
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        return bodyMatch ? bodyMatch[1] : text;
      })
      .join('\n\n');

    // Strip HTML tags for full text
    const fullText = allText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    chapters.push({
      title: dcTitle || 'Full Document',
      order_index: 0,
      content: allText,
    });
  }

  // Build full text from all chapters
  const fullText = chapters
    .map(c => c.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '))
    .join(' ');

  return {
    chapters,
    fullText: fullText.trim(),
    totalPages: chapters.length,
    totalChapters: chapters.length,
  };
}

// =====================================================
// DOCX Processing
// =====================================================

async function processDocx(buffer: ArrayBuffer): Promise<ProcessResponse> {
  const AdmZip = (await import('npm:adm-zip@0.5.10')).default;
  const zip = new AdmZip(Buffer.from(buffer));

  // Extract document.xml
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }

  const xml = docEntry.getData().toString('utf8');

  // Extract styles to identify heading levels
  const stylesEntry = zip.getEntry('word/styles.xml');
  const headingStyles: string[] = [];
  if (stylesEntry) {
    const stylesXml = stylesEntry.getData().toString('utf8');
    const styleRegex = /<w:style[^>]*w:type="w:p"[^>]*w:styleId="([^"]*)"/g;
    let sm;
    while ((sm = styleRegex.exec(stylesXml)) !== null) {
      if (sm[1].toLowerCase().startsWith('heading')) {
        headingStyles.push(sm[1]);
      }
    }
  }

  // Parse paragraphs
  const paragraphs: { text: string; style?: string }[] = [];
  const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm;
  while ((pm = pRegex.exec(xml)) !== null) {
    const pContent = pm[1];

    // Extract style
    let style = '';
    const styleMatch = pContent.match(/<w:pPr[^>]*>([\s\S]*?)<\/w:pPr>/);
    if (styleMatch) {
      const styleIdMatch = styleMatch[1].match(/<w:pStyle[^>]*w:val="([^"]+)"/);
      if (styleIdMatch) {
        style = styleIdMatch[1];
      }
    }

    // Extract text runs
    let text = '';
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRegex.exec(pContent)) !== null) {
      text += tm[1];
    }

    if (text.trim()) {
      paragraphs.push({ text: text.trim(), style });
    }
  }

  // Build chapters from headings
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let orderIndex = 0;
  let pageEstimate = 0;
  let charsInChapter = 0;

  for (const para of paragraphs) {
    const isHeading = headingStyles.some(hs => para.style === hs) ||
      para.style.toLowerCase().startsWith('heading');

    if (isHeading) {
      // Save previous chapter
      if (currentChapter) {
        currentChapter.page_end = pageEstimate;
        chapters.push(currentChapter);
      }

      // Start new chapter
      currentChapter = {
        title: para.text,
        order_index: orderIndex++,
        content: '',
        page_start: pageEstimate,
      };
      charsInChapter = 0;
    } else if (currentChapter) {
      // Add paragraph to current chapter
      currentChapter.content += `<p>${escapeHtml(para.text)}</p>\n`;
      charsInChapter += para.text.length;

      // Estimate page breaks (roughly 3000 chars per page)
      if (charsInChapter > 3000) {
        pageEstimate++;
        charsInChapter = 0;
      }
    }
  }

  // Save last chapter
  if (currentChapter) {
    currentChapter.page_end = pageEstimate;
    chapters.push(currentChapter);
  }

  // If no chapters found, create a single chapter
  if (chapters.length === 0) {
    const content = paragraphs
      .filter(p => !p.style.toLowerCase().startsWith('heading'))
      .map(p => `<p>${escapeHtml(p.text)}</p>`)
      .join('\n');

    chapters.push({
      title: 'Full Document',
      order_index: 0,
      content,
      page_start: 0,
      page_end: pageEstimate,
    });
  }

  // Build full text
  const fullText = paragraphs.map(p => p.text).join(' ');

  return {
    chapters,
    fullText: fullText.trim(),
    totalPages: pageEstimate + 1,
    totalChapters: chapters.length,
  };
}

// =====================================================
// Markdown Processing
// =====================================================

function processMarkdown(buffer: ArrayBuffer): ProcessResponse {
  const text = Buffer.from(buffer).toString('utf8');

  // Extract chapters by detecting headings
  const chapters = extractChaptersFromMarkdown(text);

  return {
    chapters,
    fullText: text.trim(),
    totalPages: chapters.length,
    totalChapters: chapters.length,
  };
}

// =====================================================
// Chapter Extraction Helpers
// =====================================================

function extractChaptersFromText(text: string, totalPages: number): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let orderIndex = 0;
  let pageEstimate = 0;
  let charsInChapter = 0;
  let preHeadingLines: string[] = []; // Collect lines before first heading

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines for heading detection but keep them in content
    if (!trimmed) {
      if (currentChapter) {
        currentChapter.content += '\n';
      } else {
        preHeadingLines.push('');
      }
      continue;
    }

    // Detect heading patterns (comprehensive book heading patterns)
    const isHeading = isChapterHeading(trimmed);

    if (isHeading) {
      // Save previous chapter
      if (currentChapter) {
        currentChapter.page_end = pageEstimate;
        chapters.push(currentChapter);
      }

      // Start new chapter
      currentChapter = {
        title: trimmed,
        order_index: orderIndex++,
        content: `<h2>${escapeHtml(trimmed)}</h2>\n`,
        page_start: pageEstimate,
      };
      charsInChapter = trimmed.length;
    } else if (currentChapter) {
      // Add paragraph with proper HTML formatting
      currentChapter.content += `<p>${escapeHtml(trimmed)}</p>\n`;
      charsInChapter += trimmed.length;

      // Estimate page breaks (roughly 3000 chars per page)
      if (charsInChapter > 3000) {
        pageEstimate++;
        charsInChapter = 0;
      }
    } else {
      // Lines before first heading (front matter, title page, etc.)
      preHeadingLines.push(trimmed);
    }
  }

  // Save last chapter
  if (currentChapter) {
    currentChapter.page_end = Math.max(pageEstimate, totalPages - 1);
    chapters.push(currentChapter);
  }

  // If no chapters detected by headings, split by paragraphs/sections
  if (chapters.length === 0) {
    chapters.push(...splitByParagraphs(text, totalPages));
  }

  // If still no chapters, create a single chapter with all content
  if (chapters.length === 0) {
    const content = lines
      .filter(l => l.trim())
      .map(l => `<p>${escapeHtml(l.trim())}</p>`)
      .join('\n');
    chapters.push({
      title: 'Full Document',
      order_index: 0,
      content,
      page_start: 0,
      page_end: totalPages - 1,
    });
  }

  return chapters;
}

// Detect if a line is a chapter heading
function isChapterHeading(line: string): boolean {
  // Chapter with number: "Chapter 1", "Chapter One", "CHAPTER 1"
  if (/^chapter\s+\d+[.:\s]?\s*.+$/i.test(line)) return true;
  if (/^chapter\s+[ivxlcdm]+[.:\s]?\s*.+$/i.test(line)) return true;
  
  // Part/Book/Section with number
  if (/^(part|book|section|volume)\s+\d+[.:\s]?\s*.+$/i.test(line)) return true;
  if (/^(part|book|section|volume)\s+[ivxlcdm]+[.:\s]?\s*.+$/i.test(line)) return true;
  
  // Numbered headings: "1.", "1.", "1)"
  if (/^\d+[.\)]\s+.+$/i.test(line) && line.length < 200) return true;
  
  // Roman numeral headings: "I.", "II.", "III)"
  if (/^[ivxlcdm]+[.\)]\s+.+$/i.test(line) && line.length < 200) return true;
  
  // All caps short lines (likely titles): "INTRODUCTION", "CONCLUSION"
  if (/^[A-Z][A-Z\s]{2,50}$/.test(line)) return true;
  
  // Title case short lines that look like headings
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,8}$/.test(line) && line.length < 100 && line.split(/\s+/).length <= 8) {
    // Check it's not a regular sentence (no lowercase after first word pattern)
    const words = line.split(/\s+/);
    const isTitleCase = words.every(w => /^[A-Z][a-z]*$/.test(w) || /^[A-Z]$/.test(w));
    if (isTitleCase && words.length >= 2 && words.length <= 8) return true;
  }
  
  // Lines surrounded by decorative characters
  if (/^[=*#~^_-]{2,}\s*.+\s*[=*#~^_-]{2,}$/.test(line)) return true;
  
  // Very short standalone lines (1-3 words) that could be section titles
  if (line.split(/\s+/).length <= 3 && line.length < 60 && !line.endsWith('.')) {
    // Only if it looks like a title, not a fragment
    if (/^[A-Z]/.test(line)) return true;
  }
  
  return false;
}

// Split text into chapters by paragraph groups when no headings are found
function splitByParagraphs(text: string, totalPages: number): Chapter[] {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 50);
  
  if (paragraphs.length <= 1) {
    // Single paragraph or very little content — return empty so the fallback single chapter is used
    return [];
  }
  
  const chapters: Chapter[] = [];
  const charsPerChapter = 15000; // Roughly 5-10 pages per chapter
  let currentContent = '';
  let currentTitle = '';
  let orderIndex = 0;
  let pageEstimate = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    
    if (!currentContent) {
      // Start first chapter — use first meaningful line as title
      const firstLine = para.split('\n')[0].trim().substring(0, 80);
      currentTitle = firstLine || `Section ${orderIndex + 1}`;
    }
    
    currentContent += `<p>${escapeHtml(para)}</p>\n`;
    
    // Split into chapters by size
    if (currentContent.length > charsPerChapter || i === paragraphs.length - 1) {
      chapters.push({
        title: currentTitle || `Section ${orderIndex + 1}`,
        order_index: orderIndex++,
        content: currentContent,
        page_start: pageEstimate,
        page_end: Math.min(pageEstimate + Math.ceil(currentContent.length / 3000), totalPages - 1),
      });
      currentContent = '';
      pageEstimate += Math.ceil((chapters[chapters.length - 1].content.length) / 3000);
    }
  }
  
  return chapters;
}

function extractChaptersFromMarkdown(text: string): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let orderIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect H1 or H2 as chapter boundaries
    const headingMatch = line.match(/^(#{1,2})\s+(.+)$/);
    if (headingMatch) {
      // Save previous chapter
      if (currentChapter) {
        chapters.push(currentChapter);
      }

      // Start new chapter
      const title = headingMatch[2].trim();
      currentChapter = {
        title,
        order_index: orderIndex++,
        content: '',
      };
    } else if (currentChapter) {
      // Convert Markdown line to HTML
      let html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^>\s+(.+)$/g, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/g, '<li>$1</li>')
        .replace(/^---$/g, '<hr>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');

      currentChapter.content += `<p>${html}</p>\n`;
    }
  }

  // Save last chapter
  if (currentChapter) {
    chapters.push(currentChapter);
  }

  // If no chapters detected, create a single chapter with all content
  if (chapters.length === 0) {
    const content = lines
      .map(l => {
        let html = l
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code>$1</code>');
        return `<p>${html}</p>`;
      })
      .join('\n');

    chapters.push({
      title: 'Full Document',
      order_index: 0,
      content,
    });
  }

  return chapters;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentUrl, bookId } = await req.json();

    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: 'documentUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect format
    const format = detectFormat(documentUrl);
    console.log(`Processing document: ${documentUrl} (format: ${format})`);

    // Download the document
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Check if the buffer is too small
    if (buffer.byteLength < 100) {
      throw new Error('File is too small to be a valid document');
    }

    // Process based on format
    let result: ProcessResponse;

    switch (format) {
      case 'pdf':
        result = await processPdf(buffer);
        break;
      case 'epub':
        result = await processEpub(buffer);
        break;
      case 'docx':
        result = await processDocx(buffer);
        break;
      case 'markdown':
        result = processMarkdown(buffer);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    console.log(`Processing complete: ${result.totalChapters} chapters, ${result.fullText.length} chars`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Document processing error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process document',
        chapters: [],
        fullText: '',
        totalPages: 0,
        totalChapters: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

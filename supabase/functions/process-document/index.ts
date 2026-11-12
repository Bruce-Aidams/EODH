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
  coverImage?: string; // Base64 cover image data (for EPUB)
  coverMimeType?: string; // MIME type of cover image (for EPUB)
  metadata?: { [key: string]: string }; // Additional metadata (for EPUB: language, publisher, etc.)
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

  // Parse OPF file to get spine (chapter order), manifest, and metadata
  const opfEntry = entries.find(e => e.entryName === opfPath);
  if (!opfEntry) {
    throw new Error('Invalid EPUB: OPF file not found');
  }

  const opfXml = opfEntry.getData().toString('utf8');

  // Extract manifest items (ID to href mapping with media types)
  const manifest: Record<string, { href: string; mediaType?: string }> = {};
  const manifestRegex = /<item\s+id="([^"]+)"\s+href="([^"]+)"(?:\s+media-type="([^"]+)")?/g;
  let m;
  while ((m = manifestRegex.exec(opfXml)) !== null) {
    manifest[m[1]] = { href: m[2], mediaType: m[3] };
  }

  // Also try alternate manifest format (href before id)
  const manifestRegex2 = /<item\s+href="([^"]+)"\s+id="([^"]+)"(?:\s+media-type="([^"]+)")?/g;
  let m2;
  while ((m2 = manifestRegex2.exec(opfXml)) !== null) {
    if (!manifest[m2[2]]) {
      manifest[m2[2]] = { href: m2[1], mediaType: m2[3] };
    }
  }

  // Extract spine (ordered list of chapter IDs)
  const spineRegex = /<itemref\s+idref="([^"]+)"/g;
  const spineIds: string[] = [];
  let s;
  while ((s = spineRegex.exec(opfXml)) !== null) {
    spineIds.push(s[1]);
  }

  // Extract metadata from OPF
  const metadata: { [key: string]: string } = {};
  const extractMeta = (tag: string): string | null => {
    const re = new RegExp(`<dc:${tag}[^>]*>([^<]+)<\\/dc:${tag}>`, 'i');
    const match = opfXml.match(re);
    return match ? match[1].trim() : null;
  };

  const dcTitle = extractMeta('title') || '';
  const dcAuthor = extractMeta('creator') || '';
  const dcLanguage = extractMeta('language') || 'en';
  const dcPublisher = extractMeta('publisher') || '';
  const dcDate = extractMeta('date') || '';
  const dcDescription = extractMeta('description') || '';

  if (dcTitle) metadata.title = dcTitle;
  if (dcAuthor) metadata.author = dcAuthor;
  if (dcLanguage) metadata.language = dcLanguage;
  if (dcPublisher) metadata.publisher = dcPublisher;
  if (dcDate) metadata.publicationDate = dcDate;
  if (dcDescription) metadata.description = dcDescription;

  // Extract cover image from EPUB
  let coverBase64: string | undefined;
  let coverMimeType: string | undefined;

  // Method 1: Look for meta name="cover" which points to the cover item ID
  const coverMetaMatch = opfXml.match(/<meta\s+name="cover"\s+content="([^"]+)"/i);
  if (coverMetaMatch) {
    const coverId = coverMetaMatch[1];
    const coverItem = manifest[coverId];
    if (coverItem) {
      const coverPath = opfDir + coverItem.href;
      const coverEntry = entries.find(e => e.entryName === coverPath);
      if (coverEntry) {
        const coverData = coverEntry.getData();
        coverBase64 = coverData.toString('base64');
        coverMimeType = coverItem.mediaType || guessMimeType(coverItem.href);
      }
    }
  }

  // Method 2: Look for cover image file directly (common patterns)
  if (!coverBase64) {
    const coverPatterns = ['OEBPS/cover.jpg', 'OEBPS/cover.jpeg', 'OEBPS/cover.png',
      'Images/cover.jpg', 'images/cover.jpg', 'images/cover.png',
      'cover.jpg', 'cover.jpeg', 'cover.png',
      'OEBPS/cover_image.jpg', 'OEBPS/cover_image.png'];
    for (const pattern of coverPatterns) {
      const coverEntry = entries.find(e => e.entryName === pattern);
      if (coverEntry) {
        const coverData = coverEntry.getData();
        coverBase64 = coverData.toString('base64');
        coverMimeType = guessMimeType(pattern);
        break;
      }
    }
  }

  // Method 3: Find any image referenced by the cover HTML page
  if (!coverBase64) {
    const coverPageEntry = entries.find(e =>
      e.entryName.toLowerCase().includes('cover') &&
      (e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.html'))
    );
    if (coverPageEntry) {
      const coverPageHtml = coverPageEntry.getData().toString('utf8');
      const imgMatch = coverPageHtml.match(/<img[^>]*src="([^"]+)"/i);
      if (imgMatch) {
        const imgSrc = imgMatch[1];
        // Resolve relative path
        const coverPageDir = coverPageEntry.entryName.substring(0, coverPageEntry.entryName.lastIndexOf('/') + 1);
        let imgPath = imgSrc;
        if (!imgPath.startsWith('/')) {
          imgPath = coverPageDir + imgSrc;
        }
        const imgEntry = entries.find(e => e.entryName === imgPath || e.entryName === imgPath.substring(1));
        if (imgEntry) {
          const imgData = imgEntry.getData();
          coverBase64 = imgData.toString('base64');
          coverMimeType = guessMimeType(imgSrc);
        }
      }
    }
  }

  // Try to find NCX/TOC for better chapter titles
  const ncxTitles: Record<string, string> = {};
  const ncxEntry = entries.find(e => e.entryName.endsWith('.ncx'));
  if (ncxEntry) {
    const ncxXml = ncxEntry.getData().toString('utf8');
    // Parse navPoint elements: match src and content
    const navPointRegex = /<navPoint\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/navPoint>/g;
    let np;
    while ((np = navPointRegex.exec(ncxXml)) !== null) {
      const navPointContent = np[2];
      const srcMatch = navPointContent.match(/src="([^"]+)"/);
      const textMatch = navPointContent.match(/<navLabel><text>([^<]+)<\/text><\/navLabel>/);
      if (srcMatch && textMatch) {
        // Store by fragment ID (after #) or full path
        const src = srcMatch[1];
        const fragmentId = src.includes('#') ? src.split('#')[1] : src;
        ncxTitles[fragmentId] = textMatch[1].trim();
      }
    }
  }

  // Process each chapter in spine order
  const chapters: Chapter[] = [];
  let orderIndex = 0;

  for (const spineId of spineIds) {
    const item = manifest[spineId];
    if (!item) continue;

    const chapterPath = opfDir + item.href;
    const chapterEntry = entries.find(e => e.entryName === chapterPath);
    if (!chapterEntry) continue;

    let content = chapterEntry.getData().toString('utf8');

    // Skip NCX (TOC) files and non-HTML files
    if (content.includes('<ncx') || (!content.includes('<html') && !content.includes('<body'))) {
      continue;
    }

    // Extract chapter title from multiple sources
    let chapterTitle = `Chapter ${orderIndex + 1}`;

    // Try NCX title first
    const fragmentId = item.href.includes('#') ? item.href.split('#')[1] : spineId;
    if (ncxTitles[fragmentId]) {
      chapterTitle = ncxTitles[fragmentId];
    } else if (ncxTitles[spineId]) {
      chapterTitle = ncxTitles[spineId];
    } else {
      // Try HTML headings
      const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        chapterTitle = h1Match[1].trim();
      } else {
        const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        if (h2Match) {
          chapterTitle = h2Match[1].trim();
        }
      }
    }

    // Clean up the HTML content for React Native rendering
    content = cleanEpubHtml(content, chapterEntry.entryName);

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
    const allHtml = entries
      .filter(e => e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.html'))
      .map(e => {
        let text = e.getData().toString('utf8');
        return cleanEpubHtml(text, e.entryName);
      })
      .filter(c => c.length > 10)
      .join('\n\n');

    const fullText = allHtml.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();

    if (allHtml.length > 10) {
      chapters.push({
        title: dcTitle || 'Full Document',
        order_index: 0,
        content: allHtml,
      });
    } else {
      chapters.push({
        title: dcTitle || 'Full Document',
        order_index: 0,
        content: `<p>${escapeHtml(fullText)}</p>`,
      });
    }
  }

  // Build full text from all chapters
  const fullText = chapters
    .map(c => c.content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' '))
    .join(' ');

  const response: ProcessResponse = {
    chapters,
    fullText: fullText.trim(),
    totalPages: chapters.length,
    totalChapters: chapters.length,
    metadata,
  };

  if (coverBase64) {
    response.coverImage = coverBase64;
    response.coverMimeType = coverMimeType;
  }

  return response;
}

// Guess MIME type from file extension
function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// Clean EPUB HTML for React Native rendering
function cleanEpubHtml(html: string, sourcePath: string): string {
  let content = html;

  // Extract body content
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  } else {
    // If no body tag, extract content after <html>
    const htmlMatch = content.match(/<html[^>]*>([\s\S]*)<\/html>/i);
    if (htmlMatch) {
      content = htmlMatch[1];
    }
  }

  // Remove head section if still present
  content = content.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

  // Remove EPUB-specific elements
  content = content
    // Remove SVG graphics (not supported in react-native-render-html)
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    // Remove scripts
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove styles
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove XML declarations
    .replace(/<\?xml[^?]*\?>/g, '')
    // Remove DOCTYPE
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Remove namespace declarations from tags
    .replace(/\sxmlns[^=]*="[^"]*"/gi, '')
    // Remove EPUB-specific attributes
    .replace(/\s(epub:|xmlns:)[\w-]+="[^"]*"/gi, '')
    // Remove inline styles (will use reader's theme styles instead)
    .replace(/\sstyle="[^"]*"/gi, '')
    // Remove class attributes (will use reader's theme styles instead)
    .replace(/\sclass="[^"]*"/gi, '')
    // Remove role attributes
    .replace(/\srole="[^"]*"/gi, '')
    // Remove aria-* attributes
    .replace(/\saria-[\w-]+="[^"]*"/gi, '')
    // Remove data-* attributes
    .replace(/\sdata-[\w-]+="[^"]*"/gi, '')
    // Remove id attributes (except for chapter navigation anchors)
    // Keep ids on section/div elements for navigation
    // Remove ids from inline elements
    .replace(/<(?!section|div)[^>]*\sid="[^"]*"/gi, (match: string) => match.replace(/\sid="[^"]*"/, ''))
    // Fix relative image paths - EPUB images reference local files which won't exist
    // Remove img tags that reference local files (no external URLs)
    .replace(/<img[^>]*src="[^"]*"[^>]*\/?>/gi, '')
    // Remove figure/figcaption with only images
    .replace(/<figure[^>]*>(\s*<img[^>]*\/?>\s*)*<\/figure>/gi, '')
    // Remove video/audio (not supported)
    .replace(/<(video|audio|source|track)[^>]*>[\s\S]*?<\/(video|audio|source|track)>/gi, '')
    // Remove math elements (not supported)
    .replace(/<(math|annotation|mrow|mo|mn|mi|msup|msub)[^>]*>[\s\S]*?<\/(math|annotation|mrow|mo|mn|mi|msup|msub)>/gi, '')
    // Remove form elements
    .replace(/<(form|input|button|select|textarea|label)[^>]*>[\s\S]*?<\/(form|input|button|select|textarea|label)>/gi, '')
    // Normalize newlines
    .replace(/\n\s*\n/g, '\n')
    // Clean up excessive whitespace
    .replace(/[ \t]+/g, ' ')
    // Wrap bare text nodes in paragraphs
    .replace(/^(?![<])[\s\S]*?(?=<|$)/gm, (match: string) => {
      const trimmed = match.trim();
      if (trimmed && !trimmed.startsWith('<')) {
        return `<p>${escapeHtml(trimmed)}</p>`;
      }
      return match;
    })
    // Fix unclosed tags
    .replace(/<([a-z]+)\s*\/>/gi, (match: string, tag: string) => {
      // Self-closing tags that should remain self-closing
      const voidElements = ['br', 'hr', 'img', 'input', 'meta', 'link'];
      if (voidElements.includes(tag.toLowerCase())) {
        return `<${tag}>`;
      }
      return match;
    })
    .trim();

  // Ensure all paragraphs have proper closing
  const openParagraphs = (content.match(/<p>/gi) || []).length;
  const closeParagraphs = (content.match(/<\/p>/gi) || []).length;
  for (let i = 0; i < openParagraphs - closeParagraphs; i++) {
    content += '</p>';
  }

  // Wrap in a container div for consistent rendering
  if (content && !content.startsWith('<div')) {
    content = `<div>${content}</div>`;
  }

  return content;
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

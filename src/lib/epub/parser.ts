import * as FileSystem from 'expo-file-system/legacy';
import { readAsStringAsync, getInfoAsync, writeAsStringAsync } from 'expo-file-system/legacy';

/**
 * Client-side EPUB Parser for EODH
 * 
 * Parses EPUB files directly on the device for offline reading.
 * Uses fflate for ZIP decompression and extracts chapters, metadata,
 * and cover images from the EPUB structure.
 * 
 * This provides a fallback when the Edge Function is unavailable
 * and enables true offline EPUB reading.
 */

export interface EpubChapter {
  id: string;
  title: string;
  orderIndex: number;
  content: string; // Cleaned HTML for react-native-render-html
  rawText: string; // Plain text for search/TTS
}

export interface EpubMetadata {
  title: string;
  author: string;
  language: string;
  publisher: string;
  description: string;
  publicationDate: string;
  coverImageUri?: string; // Local file URI of extracted cover
}

export interface EpubParseResult {
  success: boolean;
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  fullText: string;
  error?: string;
}

/**
 * Decompress an EPUB file (ZIP archive) using fflate.
 */
async function decompressEpub(fileUri: string): Promise<Map<string, Uint8Array>> {
  // Dynamic import fflate (tree-shakeable)
  const fflate = await import('fflate');
  
  // Read the entire EPUB file as bytes
  const fileBase64 = await readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  const data = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
  
  // Unzip using fflate
  const entries = new Map<string, Uint8Array>();
  const unzipped = fflate.unzipSync(data);
  
  for (const [name, entryData] of Object.entries(unzipped)) {
    entries.set(name, entryData as Uint8Array);
  }
  
  return entries;
}

/**
 * Parse an EPUB file and extract chapters, metadata, and cover image.
 */
export async function parseEpub(fileUri: string): Promise<EpubParseResult> {
  const result: EpubParseResult = {
    success: false,
    metadata: {
      title: '',
      author: '',
      language: 'en',
      publisher: '',
      description: '',
      publicationDate: '',
    },
    chapters: [],
    fullText: '',
  };

  try {
    // Check file exists
    const fileInfo = await getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      result.error = 'EPUB file not found';
      return result;
    }

    // Decompress EPUB (ZIP archive)
    const entries = await decompressEpub(fileUri);
    const decoder = new TextDecoder();

    // Find container.xml to locate the OPF file
    const containerBytes = entries.get('META-INF/container.xml');
    if (!containerBytes) {
      result.error = 'Invalid EPUB: missing META-INF/container.xml';
      return result;
    }

    const containerXml = decoder.decode(containerBytes);
    const opfMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!opfMatch) {
      result.error = 'Invalid EPUB: cannot find OPF file in container.xml';
      return result;
    }

    const opfPath = opfMatch[1];
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // Parse OPF file
    const opfBytes = entries.get(opfPath);
    if (!opfBytes) {
      result.error = 'Invalid EPUB: OPF file not found';
      return result;
    }

    const opfXml = decoder.decode(opfBytes);

    // Extract metadata
    const extractMeta = (tag: string): string => {
      const re = new RegExp(`<dc:${tag}[^>]*>([^<]+)<\\/dc:${tag}>`, 'i');
      const match = opfXml.match(re);
      return match ? match[1].trim() : '';
    };

    result.metadata.title = extractMeta('title');
    result.metadata.author = extractMeta('creator');
    result.metadata.language = extractMeta('language') || 'en';
    result.metadata.publisher = extractMeta('publisher');
    result.metadata.description = extractMeta('description');
    result.metadata.publicationDate = extractMeta('date');

    // Extract manifest
    const manifest: Record<string, { href: string; mediaType?: string }> = {};
    const manifestRegex = /<item\s+id="([^"]+)"\s+href="([^"]+)"(?:\s+media-type="([^"]+)")?/g;
    let m;
    while ((m = manifestRegex.exec(opfXml)) !== null) {
      manifest[m[1]] = { href: m[2], mediaType: m[3] };
    }

    // Extract spine
    const spineRegex = /<itemref\s+idref="([^"]+)"/g;
    const spineIds: string[] = [];
    let s;
    while ((s = spineRegex.exec(opfXml)) !== null) {
      spineIds.push(s[1]);
    }

    // Extract cover image
    const coverMetaMatch = opfXml.match(/<meta\s+name="cover"\s+content="([^"]+)"/i);
    if (coverMetaMatch) {
      const coverId = coverMetaMatch[1];
      const coverItem = manifest[coverId];
      if (coverItem) {
        const coverPath = opfDir + coverItem.href;
        const coverBytes = entries.get(coverPath);
        if (coverBytes) {
          // Save cover to local file
          const coverExt = coverItem.mediaType === 'image/png' ? 'png' : 'jpg';
          const coverUri = `${FileSystem.cacheDirectory}epub-cover-${Date.now()}.${coverExt}`;
          const base64 = btoa(String.fromCharCode(...coverBytes));
          await FileSystem.writeAsStringAsync(coverUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          result.metadata.coverImageUri = coverUri;
        }
      }
    }

    // Process chapters in spine order
    let orderIndex = 0;
    for (const spineId of spineIds) {
      const item = manifest[spineId];
      if (!item) continue;

      const chapterPath = opfDir + item.href;
      const chapterBytes = entries.get(chapterPath);
      if (!chapterBytes) continue;

      let content = decoder.decode(chapterBytes);

      // Skip NCX and non-HTML files
      if (content.includes('<ncx') || (!content.includes('<html') && !content.includes('<body'))) {
        continue;
      }

      // Extract chapter title
      let chapterTitle = `Chapter ${orderIndex + 1}`;
      const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        chapterTitle = h1Match[1].trim();
      } else {
        const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        if (h2Match) {
          chapterTitle = h2Match[1].trim();
        }
      }

      // Clean HTML for React Native
      const cleanedHtml = cleanEpubHtml(content);
      const rawText = cleanedHtml.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanedHtml.length > 10) {
        result.chapters.push({
          id: `epub-chapter-${orderIndex}`,
          title: chapterTitle,
          orderIndex,
          content: cleanedHtml,
          rawText,
        });
        orderIndex++;
      }
    }

    // Fallback: if no chapters from spine, try all HTML files
    if (result.chapters.length === 0) {
      for (const [name, bytes] of entries) {
        if (!name.endsWith('.xhtml') && !name.endsWith('.html')) continue;
        
        let content = decoder.decode(bytes);
        if (content.includes('<ncx')) continue;
        
        const cleanedHtml = cleanEpubHtml(content);
        const rawText = cleanedHtml.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (cleanedHtml.length > 10) {
          let title = `Chapter ${result.chapters.length + 1}`;
          const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1Match) title = h1Match[1].trim();
          
          result.chapters.push({
            id: `epub-chapter-${result.chapters.length}`,
            title,
            orderIndex: result.chapters.length,
            content: cleanedHtml,
            rawText,
          });
        }
      }
    }

    // Build full text
    result.fullText = result.chapters.map(c => c.rawText).join(' ');
    result.success = true;

  } catch (error: any) {
    result.error = error?.message || 'Failed to parse EPUB file';
    console.error('EPUB parse error:', error);
  }

  return result;
}

/**
 * Clean EPUB HTML for React Native rendering.
 */
function cleanEpubHtml(html: string): string {
  let content = html;

  // Extract body content
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Remove unwanted elements and attributes
  content = content
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/\sxmlns[^=]*="[^"]*"/gi, '')
    .replace(/\s(epub:|xmlns:)[\w-]+="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sclass="[^"]*"/gi, '')
    .replace(/\srole="[^"]*"/gi, '')
    .replace(/\saria-[\w-]+="[^"]*"/gi, '')
    .replace(/\sdata-[\w-]+="[^"]*"/gi, '')
    .replace(/<img[^>]*\/?>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<(video|audio|source|track)[^>]*>[\s\S]*?<\/(video|audio|source|track)>/gi, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Wrap in container div
  if (content && !content.startsWith('<div')) {
    content = `<div>${content}</div>`;
  }

  return content;
}

/**
 * Check if a file is a valid EPUB by reading its magic bytes.
 */
export async function isEpubFile(fileUri: string): Promise<boolean> {
  try {
    const content = await readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // EPUB files start with PK (ZIP signature) and contain META-INF/container.xml
    return content.startsWith('UEs') || content.startsWith('PK');
  } catch {
    return false;
  }
}

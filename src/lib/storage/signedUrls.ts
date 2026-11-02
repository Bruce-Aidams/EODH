import { supabase } from '@/lib/supabase/client';

/**
 * Signed URL Utility
 *
 * Generates time-limited signed URLs for secure access to Supabase Storage files.
 * This prevents direct public access to stored files and adds an extra layer of security.
 *
 * Usage:
 * - For book covers: getSignedUrl('covers', `${bookId}/cover.jpg`)
 * - For documents: getSignedUrl('documents', `${bookId}/document.pdf`)
 * - For audiobooks: getSignedUrl('audiobooks', `${bookId}/chapter1.mp3`)
 */

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

/**
 * Generate a signed URL for a file in Supabase Storage
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  options: SignedUrlOptions = {}
): Promise<string | null> {
  const { expiresIn = 3600 } = options;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error(`[EODH] Error creating signed URL for ${bucket}/${path}:`, error);
      return null;
    }

    if (!data?.signedUrl) {
      console.warn(`[EODH] No signed URL returned for ${bucket}/${path}`);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`[EODH] Exception creating signed URL:`, error);
    return null;
  }
}

/**
 * Generate signed URLs for multiple files at once
 */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  options: SignedUrlOptions = {}
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const promises = paths.map(async (path) => {
    const url = await getSignedUrl(bucket, path, options);
    if (url) {
      results.set(path, url);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Get a signed URL for a book cover
 */
export async function getBookCoverUrl(bookId: string, expiresIn = 3600): Promise<string | null> {
  return getSignedUrl('covers', `${bookId}/cover.jpg`, { expiresIn });
}

/**
 * Get a signed URL for a book document
 */
export async function getBookDocumentUrl(bookId: string, fileName: string, expiresIn = 3600): Promise<string | null> {
  return getSignedUrl('documents', `${bookId}/${fileName}`, { expiresIn });
}

/**
 * Get a signed URL for an audiobook chapter
 */
export async function getAudiobookChapterUrl(bookId: string, chapterId: string, expiresIn = 3600): Promise<string | null> {
  return getSignedUrl('audiobooks', `${bookId}/${chapterId}.mp3`, { expiresIn });
}

/**
 * Cache for signed URLs to avoid excessive API calls
 */
class SignedUrlCache {
  private cache: Map<string, { url: string; expiresAt: number }> = new Map();

  private getKey(bucket: string, path: string): string {
    return `${bucket}/${path}`;
  }

  get(bucket: string, path: string): string | null {
    const key = this.getKey(bucket, path);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.url;
  }

  set(bucket: string, path: string, url: string, expiresIn: number) {
    const key = this.getKey(bucket, path);
    this.cache.set(key, {
      url,
      expiresAt: Date.now() + (expiresIn * 1000) - 30000, // expire 30s early
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Singleton cache instance
const urlCache = new SignedUrlCache();

/**
 * Get a signed URL, using cache when available
 */
export async function getCachedSignedUrl(
  bucket: string,
  path: string,
  options: SignedUrlOptions = {}
): Promise<string | null> {
  const { expiresIn = 3600 } = options;

  // Check cache first
  const cached = urlCache.get(bucket, path);
  if (cached) return cached;

  // Fetch new signed URL
  const url = await getSignedUrl(bucket, path, options);
  if (url) {
    urlCache.set(bucket, path, url, expiresIn);
  }

  return url;
}

/**
 * Clear the signed URL cache (e.g., on logout)
 */
export function clearSignedUrlCache() {
  urlCache.clear();
}

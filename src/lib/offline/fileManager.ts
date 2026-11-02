import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase/client';
import { Book } from '@/types';

/**
 * Offline File Manager for EODH
 * 
 * Manages downloaded files for offline reading and listening.
 * Provides download progress tracking, local file management,
 * and offline URI resolution.
 */

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}EODH/Downloads/`;
const DOCUMENTS_DIR = `${DOWNLOADS_DIR}Documents/`;
const AUDIO_DIR = `${DOWNLOADS_DIR}Audio/`;
const COVERS_DIR = `${DOWNLOADS_DIR}Covers/`;

export interface DownloadProgress {
  bookId: string;
  fileType: 'document' | 'audio' | 'cover';
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  isComplete: boolean;
  error: string | null;
}

/**
 * Ensure download directories exist.
 */
async function ensureDirectories() {
  const dirs = [DOWNLOADS_DIR, DOCUMENTS_DIR, AUDIO_DIR, COVERS_DIR];
  
  for (const dir of dirs) {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

/**
 * Get the local file path for a downloaded file.
 */
export function getLocalFilePath(bookId: string, fileType: 'document' | 'audio' | 'cover', extension: string = ''): string {
  const dir = fileType === 'document' ? DOCUMENTS_DIR : fileType === 'audio' ? AUDIO_DIR : COVERS_DIR;
  return `${dir}${bookId}${extension}`;
}

/**
 * Check if a file is downloaded locally.
 */
export async function isFileDownloaded(bookId: string, fileType: 'document' | 'audio' | 'cover'): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check database record
    const { data } = await supabase
      .from('downloads')
      .select('is_downloaded')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .eq('file_type', fileType)
      .single();

    if (!data?.is_downloaded) return false;

    // Check local file exists
    const localPath = getLocalFilePath(bookId, fileType);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

/**
 * Get the local URI for a downloaded file, or the remote URI if not downloaded.
 */
export async function getFileUri(book: Book, fileType: 'document' | 'audio' | 'cover'): Promise<string | null> {
  const downloaded = await isFileDownloaded(book.id, fileType);
  
  if (downloaded) {
    const localPath = getLocalFilePath(book.id, fileType);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists && fileInfo.uri) {
      return fileInfo.uri;
    }
  }

  // Return remote URI
  if (fileType === 'document') return book.document_url;
  if (fileType === 'cover') return book.cover_url;
  return null;
}

/**
 * Download a file from Supabase Storage.
 */
export async function downloadFile(
  bookId: string,
  fileUrl: string,
  fileType: 'document' | 'audio' | 'cover',
  onProgress?: (progress: DownloadProgress) => void
): Promise<string | null> {
  try {
    await ensureDirectories();

    // Determine file extension from URL
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    
    const localPath = getLocalFilePath(bookId, fileType, extension);

    // Check if already downloaded
    const existingInfo = await FileSystem.getInfoAsync(localPath);
    if (existingInfo.exists) {
      return localPath;
    }

    // Start download
    const downloadResumable = FileSystem.createDownloadResumable(
      fileUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress: DownloadProgress = {
          bookId,
          fileType,
          progress: downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite,
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
          downloadedBytes: downloadProgress.totalBytesWritten,
          isComplete: false,
          error: null,
        };
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (result?.uri) {
      const completeProgress: DownloadProgress = {
        bookId,
        fileType,
        progress: 1,
        totalBytes: 0,
        downloadedBytes: 0,
        isComplete: true,
        error: null,
      };
      onProgress?.(completeProgress);
    }

    // Update database record
    const { data: { user } } = await supabase.auth.getUser();
    if (user && result?.uri) {
      const { data: existing } = await supabase
        .from('downloads')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .eq('file_type', fileType)
        .single();

      const downloadData = {
        user_id: user.id,
        book_id: bookId,
        file_type: fileType,
        local_path: localPath,
        is_downloaded: true,
        download_progress: 100,
      };

      if (existing) {
        await supabase.from('downloads').update(downloadData).eq('id', existing.id);
      } else {
        await supabase.from('downloads').insert(downloadData);
      }
    }

    return result?.uri || null;
  } catch (error: any) {
    console.error('Download failed:', error);
    onProgress?.({
      bookId,
      fileType,
      progress: 0,
      totalBytes: 0,
      downloadedBytes: 0,
      isComplete: false,
      error: error?.message || 'Download failed',
    });
    return null;
  }
}

/**
 * Download a book's document and cover for offline access.
 */
export async function downloadBookForOffline(
  book: Book,
  onProgress?: (fileType: 'document' | 'cover', progress: number) => void
): Promise<boolean> {
  let success = true;

  // Download document
  if (book.document_url) {
    const docUri = await downloadFile(book.id, book.document_url, 'document', (progress) => {
      onProgress?.('document', progress.progress);
    });
    if (!docUri) success = false;
  }

  // Download cover
  if (book.cover_url) {
    const coverUri = await downloadFile(book.id, book.cover_url, 'cover', (progress) => {
      onProgress?.('cover', progress.progress);
    });
    if (!coverUri) success = false;
  }

  return success;
}

/**
 * Download audiobook segments for offline access.
 * Downloads all audio segments (chapters) for a book.
 */
export async function downloadAudiobookForOffline(
  bookId: string,
  audioSegments: Array<{ id: string; url: string; chapter_index?: number }>,
  onProgress?: (chapter: number, progress: number, total: number) => void
): Promise<boolean> {
  let success = true;
  const total = audioSegments.length;

  for (let i = 0; i < audioSegments.length; i++) {
    const segment = audioSegments[i];
    const chapter = segment.chapter_index ?? i + 1;

    if (segment.url) {
      // Create a unique file path for each chapter
      const localPath = `${AUDIO_DIR}${bookId}_chapter_${chapter}.mp3`;
      
      const segmentDownloaded = await downloadAudioSegment(
        segment.url,
        localPath,
        bookId,
        chapter,
        (progress) => {
          onProgress?.(chapter, progress, total);
        }
      );

      if (!segmentDownloaded) {
        success = false;
      }
    }
  }

  return success;
}

/**
 * Download a single audio segment.
 */
async function downloadAudioSegment(
  fileUrl: string,
  localPath: string,
  bookId: string,
  chapter: number,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  try {
    await ensureDirectories();

    // Check if already downloaded
    const existingInfo = await FileSystem.getInfoAsync(localPath);
    if (existingInfo.exists) {
      onProgress?.(1);
      return true;
    }

    // Start download
    const downloadResumable = FileSystem.createDownloadResumable(
      fileUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (result?.uri) {
      onProgress?.(1);

      // Update database record for this audio chapter
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existing } = await supabase
          .from('downloads')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', bookId)
          .eq('file_type', 'audio')
          .single();

        const downloadData = {
          user_id: user.id,
          book_id: bookId,
          file_type: 'audio',
          local_path: localPath,
          is_downloaded: true,
          download_progress: 100,
        };

        if (existing) {
          await supabase.from('downloads').update(downloadData).eq('id', existing.id);
        } else {
          await supabase.from('downloads').insert(downloadData);
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Audio download failed:', error);
    return false;
  }
}

/**
 * Get the local URI for a downloaded audio segment, or the remote URI if not downloaded.
 */
export async function getAudioSegmentUri(
  bookId: string,
  chapter: number,
  remoteUrl: string | null
): Promise<string | null> {
  const localPath = `${AUDIO_DIR}${bookId}_chapter_${chapter}.mp3`;
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  
  if (fileInfo.exists && fileInfo.uri) {
    return fileInfo.uri;
  }

  return remoteUrl;
}

/**
 * Check if audiobook is fully downloaded.
 */
export async function isAudiobookDownloaded(bookId: string, segmentCount: number): Promise<boolean> {
  let downloadedCount = 0;

  for (let i = 1; i <= segmentCount; i++) {
    const localPath = `${AUDIO_DIR}${bookId}_chapter_${i}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      downloadedCount++;
    }
  }

  return downloadedCount === segmentCount;
}

/**
 * Get the count of downloaded audio chapters for a book.
 */
export async function getDownloadedChapterCount(bookId: string, segmentCount: number): Promise<number> {
  let count = 0;

  for (let i = 1; i <= segmentCount; i++) {
    const localPath = `${AUDIO_DIR}${bookId}_chapter_${i}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      count++;
    }
  }

  return count;
}

/**
 * Remove a downloaded file.
 */
export async function removeDownloadedFile(bookId: string, fileType: 'document' | 'audio' | 'cover'): Promise<boolean> {
  try {
    const localPath = getLocalFilePath(bookId, fileType);
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }

    // Update database record
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from('downloads')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .eq('file_type', fileType)
        .single();

      if (existing) {
        await supabase
          .from('downloads')
          .update({ is_downloaded: false, local_path: null, download_progress: 0 })
          .eq('id', existing.id);
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to remove downloaded file:', error);
    return false;
  }
}

/**
 * Get total storage used by downloads.
 */
export async function getDownloadsStorageSize(): Promise<number> {
  try {
    await ensureDirectories();
    
    const dirs = [DOCUMENTS_DIR, AUDIO_DIR, COVERS_DIR];
    let totalSize = 0;

    for (const dir of dirs) {
      const dirInfo = await FileSystem.readDirectoryAsync(dir);
      for (const file of dirInfo) {
        const filePath = `${dir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

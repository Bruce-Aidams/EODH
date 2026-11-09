import { getInfoAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

/**
 * File Validation Utility for EODH Admin
 * 
 * Validates uploaded files before they are processed.
 * Checks file type, size, and format.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: FileInfo | null;
}

export interface FileInfo {
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  type: 'pdf' | 'markdown' | 'epub' | 'docx' | 'image' | 'audio' | 'subtitle' | 'unknown';
}

// File size limits (in bytes)
const MAX_FILE_SIZES = {
  pdf: 100 * 1024 * 1024,        // 100 MB
  markdown: 10 * 1024 * 1024,    // 10 MB
  epub: 50 * 1024 * 1024,        // 50 MB
  docx: 25 * 1024 * 1024,        // 25 MB
  image: 10 * 1024 * 1024,       // 10 MB
  audio: 200 * 1024 * 1024,      // 200 MB
  subtitle: 1 * 1024 * 1024,     // 1 MB
};

// Allowed file extensions by type
const ALLOWED_EXTENSIONS = {
  pdf: ['.pdf'],
  markdown: ['.md', '.markdown'],
  epub: ['.epub'],
  docx: ['.docx'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'],
  subtitle: ['.srt', '.vtt', '.webvtt'],
};

/**
 * Get file extension from URI or name.
 */
function getExtension(uri: string): string {
  const parts = uri.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

/**
 * Determine file type from extension.
 */
function getFileType(extension: string): FileInfo['type'] {
  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(extension)) {
      return type as FileInfo['type'];
    }
  }
  return 'unknown';
}

/**
 * Validate a file before upload.
 */
export async function validateFile(
  fileUri: string,
  fileType: 'pdf' | 'markdown' | 'epub' | 'docx' | 'image' | 'audio' | 'subtitle'
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fileInfo: FileInfo | null = null;

  try {
    // Get file info
    const fileInfoResult = await getInfoAsync(fileUri);
    
    if (!fileInfoResult.exists) {
      return {
        isValid: false,
        errors: ['File does not exist'],
        warnings: [],
        fileInfo: null,
      };
    }

    const extension = getExtension(fileUri);
    const type = getFileType(extension);
    const name = fileUri.split('/').pop() || 'unknown';

    fileInfo = {
      name,
      size: fileInfoResult.size || 0,
      mimeType: (fileInfoResult as any).mimeType || 'unknown',
      extension,
      type,
    };

    // Check file type matches expected type
    if (type !== fileType && type !== 'unknown') {
      errors.push(`File type mismatch: expected ${fileType}, got ${type}`);
    }

    // Check extension is allowed
    if (!ALLOWED_EXTENSIONS[fileType].includes(extension)) {
      const allowed = ALLOWED_EXTENSIONS[fileType].join(', ');
      errors.push(`Invalid file extension. Allowed: ${allowed}`);
    }

    // Check file size
    const maxSize = MAX_FILE_SIZES[fileType];
    if (fileInfo.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      errors.push(`File too large. Maximum size: ${maxSizeMB} MB`);
    }

    // Check file is not empty
    if (fileInfo.size === 0) {
      errors.push('File is empty');
    }

    // Warnings for large files
    if (fileInfo.size > maxSize * 0.8) {
      warnings.push('File is接近 the size limit. Consider compressing it.');
    }

    // Check PDF specifically
    if (fileType === 'pdf' && extension === '.pdf') {
      // Check if it's a valid PDF by reading the header
      try {
        const content = await readAsStringAsync(fileUri, {
          encoding: EncodingType.UTF8,
        });
        
        if (!content.startsWith('%PDF')) {
          errors.push('File does not appear to be a valid PDF');
        }
      } catch {
        // Binary file, can't read as string — that's OK for PDFs
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo,
    };

  } catch (error: any) {
    return {
      isValid: false,
      errors: [`Failed to read file: ${error?.message || 'Unknown error'}`],
      warnings: [],
      fileInfo: null,
    };
  }
}

/**
 * Validate multiple files at once.
 */
export async function validateFiles(
  files: Array<{ uri: string; type: 'pdf' | 'markdown' | 'epub' | 'docx' | 'image' | 'audio' | 'subtitle' }>
): Promise<ValidationResult[]> {
  return Promise.all(
    files.map(file => validateFile(file.uri, file.type))
  );
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get the maximum file size for a file type.
 */
export function getMaxFileSize(fileType: keyof typeof MAX_FILE_SIZES): number {
  return MAX_FILE_SIZES[fileType];
}

/**
 * Get allowed extensions for a file type.
 */
export function getAllowedExtensions(fileType: keyof typeof ALLOWED_EXTENSIONS): string[] {
  return ALLOWED_EXTENSIONS[fileType];
}

import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface ReadingProgressData {
  book_id: string;
  page_number: number;
  progress_percent: number;
  chapter_id?: string | null;
  text_offset?: number | null;
}

class ReadingProgressService {
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSavedProgress: ReadingProgressData | null = null;

  // Save reading progress to Supabase with debounce
  saveProgress = debounce(async (data: ReadingProgressData): Promise<void> => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) return;

      this.lastSavedProgress = data;

      const { data: existing } = await supabase
        .from('reading_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_id', data.book_id)
        .single();

      const payload = {
        user_id: user.id,
        book_id: data.book_id,
        chapter_id: data.chapter_id || null,
        page_number: data.page_number,
        progress_percent: data.progress_percent,
        text_offset: data.text_offset || null,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('reading_progress').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('reading_progress').insert(payload);
      }
    } catch (error) {
      console.error('Failed to save reading progress:', error);
    }
  }, 2000);

  // Restore last reading progress for a book
  async restoreProgress(bookId: string): Promise<ReadingProgressData | null> {
    try {
      const { user } = useAuthStore.getState();
      if (!user) return null;

      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .order('last_read_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        book_id: data.book_id,
        page_number: data.page_number || 1,
        progress_percent: data.progress_percent || 0,
        chapter_id: data.chapter_id,
        text_offset: data.text_offset,
      };
    } catch (error) {
      console.error('Failed to restore reading progress:', error);
      return null;
    }
  }

  // Clear pending save timeout (call on unmount)
  clearPendingSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  // Get last saved progress (for immediate display)
  getLastSavedProgress(): ReadingProgressData | null {
    return this.lastSavedProgress;
  }
}

// Export singleton instance
export const readingProgressService = new ReadingProgressService();


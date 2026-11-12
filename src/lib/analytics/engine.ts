// Analytics engine: computes reading and listening statistics from Supabase data

import { supabase } from '@/lib/supabase/client';
import {
  AnalyticsStats,
  DailyActivity,
  WeeklyStats,
  MonthlyStats,
  AllTimeStats,
  ReadingStreak,
} from './types';

// Estimated reading speed: 200 words per minute, ~250 words per page
const MINUTES_PER_PAGE = 0.5; // 30 seconds per page

/**
 * Fetch all reading and listening progress for the current user
 */
async function fetchAllProgress() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { reading: [], listening: [] };
  }

  const [readingRes, listeningRes] = await Promise.all([
    supabase
      .from('reading_progress')
      .select('book_id, page_number, progress_percent, last_read_at, updated_at')
      .eq('user_id', user.id)
      .order('last_read_at', { ascending: false }),
    supabase
      .from('listening_progress')
      .select('book_id, current_time, progress_percent, last_listened_at, updated_at')
      .eq('user_id', user.id)
      .order('last_listened_at', { ascending: false }),
  ]);

  return {
    reading: readingRes.data || [],
    listening: listeningRes.data || [],
  };
}

/**
 * Fetch book details for a list of book IDs
 */
async function fetchBooks(bookIds: string[]) {
  if (bookIds.length === 0) return [];
  const { data } = await supabase
    .from('books')
    .select('id, title, total_pages')
    .in('id', bookIds);
  return data || [];
}

/**
 * Get date string YYYY-MM-DD in local time
 */
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build daily activity data from progress records
 * Uses updated_at timestamps to estimate daily activity
 */
function buildDailyActivity(
  reading: any[],
  listening: any[],
  daysBack: number
): DailyActivity[] {
  const activityMap = new Map<string, DailyActivity>();

  // Initialize the last N days
  const now = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = toDateStr(date);
    activityMap.set(key, {
      date: key,
      pagesRead: 0,
      minutesRead: 0,
      minutesListened: 0,
      booksTouched: 0,
    });
  }

  // Aggregate reading progress by date
  for (const record of reading) {
    const updatedAt = new Date(record.updated_at);
    const key = toDateStr(updatedAt);
    const entry = activityMap.get(key);
    if (entry) {
      const pages = record.page_number || 0;
      entry.pagesRead += pages;
      entry.minutesRead += pages * MINUTES_PER_PAGE;
      entry.booksTouched += 1;
    }
  }

  // Aggregate listening progress by date
  for (const record of listening) {
    const updatedAt = new Date(record.updated_at);
    const key = toDateStr(updatedAt);
    const entry = activityMap.get(key);
    if (entry) {
      // Convert listening seconds to minutes
      const minutes = (record.current_time || 0) / 60;
      entry.minutesListened += minutes;
      entry.booksTouched += 1;
    }
  }

  return Array.from(activityMap.values());
}

/**
 * Calculate reading streaks from daily activity
 */
function calculateStreaks(dailyActivity: DailyActivity[]): ReadingStreak {
  const activeDates = dailyActivity
    .filter(d => d.pagesRead > 0 || d.minutesRead > 0 || d.minutesListened > 0)
    .map(d => d.date);

  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  // Calculate longest streak first
  let longestStreak = 1;
  let streak = 1;

  for (let i = 1; i < activeDates.length; i++) {
    const prevDate = new Date(activeDates[i - 1] + 'T00:00:00');
    const currDate = new Date(activeDates[i] + 'T00:00:00');
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 1;
    }
  }

  // Calculate current streak (consecutive days ending today or yesterday)
  let currentStreak = 0;
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  // Check if today or yesterday was active
  let checkDate = activeDates.includes(today) ? today : yesterday;
  if (!activeDates.includes(checkDate)) {
    return { currentStreak: 0, longestStreak, lastActiveDate: activeDates[0] };
  }

  let currentDate = new Date(checkDate + 'T00:00:00');
  while (activeDates.includes(toDateStr(currentDate))) {
    currentStreak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: activeDates[0],
  };
}

/**
 * Compute all analytics statistics
 */
export async function computeAnalytics(): Promise<AnalyticsStats> {
  const { reading, listening } = await fetchAllProgress();

  // Get unique book IDs
  const bookIds = [
    ...new Set([
      ...reading.map(r => r.book_id),
      ...listening.map(l => l.book_id),
    ]),
  ];
  const books = await fetchBooks(bookIds);
  const bookMap = new Map(books.map(b => [b.id, b]));

  // Build daily activity for different periods
  const weeklyActivity = buildDailyActivity(reading, listening, 7);
  const monthlyActivity = buildDailyActivity(reading, listening, 30);
  const allTimeActivity = buildDailyActivity(reading, listening, 365);

  // Calculate streaks
  const streak = calculateStreaks(allTimeActivity);

  // Weekly stats
  const weekly: WeeklyStats = {
    totalPagesRead: weeklyActivity.reduce((sum, d) => sum + d.pagesRead, 0),
    totalMinutesRead: Math.round(weeklyActivity.reduce((sum, d) => sum + d.minutesRead, 0)),
    totalMinutesListened: Math.round(weeklyActivity.reduce((sum, d) => sum + d.minutesListened, 0)),
    booksStarted: reading.length,
    booksCompleted: reading.filter(r => r.progress_percent >= 100).length,
    dailyActivity: weeklyActivity,
  };

  // Monthly stats
  const monthly: MonthlyStats = {
    totalPagesRead: monthlyActivity.reduce((sum, d) => sum + d.pagesRead, 0),
    totalMinutesRead: Math.round(monthlyActivity.reduce((sum, d) => sum + d.minutesRead, 0)),
    totalMinutesListened: Math.round(monthlyActivity.reduce((sum, d) => sum + d.minutesListened, 0)),
    booksStarted: reading.length,
    booksCompleted: reading.filter(r => r.progress_percent >= 100).length,
    dailyActivity: monthlyActivity,
  };

  // All-time stats
  const totalDays = allTimeActivity.length || 1;
  const totalPagesRead = reading.reduce((sum, r) => sum + (r.page_number || 0), 0);
  const totalMinutesRead = Math.round(reading.reduce((sum, r) => sum + (r.page_number || 0) * MINUTES_PER_PAGE, 0));
  const totalMinutesListened = Math.round(listening.reduce((sum, l) => sum + (l.current_time || 0) / 60, 0));
  const allTime: AllTimeStats = {
    totalPagesRead,
    totalMinutesRead,
    totalMinutesListened,
    booksStarted: reading.length + listening.length,
    booksCompleted: reading.filter(r => r.progress_percent >= 100).length,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    averagePagesPerDay: Math.round(totalPagesRead / totalDays),
    averageMinutesPerDay: Math.round((totalMinutesRead + totalMinutesListened) / totalDays),
  };

  return { weekly, monthly, allTime, streak };
}

/**
 * Format minutes to human-readable duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

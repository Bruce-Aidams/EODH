// Analytics types for the reading dashboard

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  pagesRead: number;
  minutesRead: number;
  minutesListened: number;
  booksTouched: number;
}

export interface WeeklyStats {
  totalPagesRead: number;
  totalMinutesRead: number;
  totalMinutesListened: number;
  booksStarted: number;
  booksCompleted: number;
  dailyActivity: DailyActivity[]; // last 7 days
}

export interface MonthlyStats {
  totalPagesRead: number;
  totalMinutesRead: number;
  totalMinutesListened: number;
  booksStarted: number;
  booksCompleted: number;
  dailyActivity: DailyActivity[]; // last 30 days
}

export interface AllTimeStats {
  totalPagesRead: number;
  totalMinutesRead: number;
  totalMinutesListened: number;
  booksStarted: number;
  booksCompleted: number;
  currentStreak: number; // consecutive days
  longestStreak: number;
  averagePagesPerDay: number;
  averageMinutesPerDay: number;
}

export interface ReadingStreak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

export interface AnalyticsStats {
  weekly: WeeklyStats;
  monthly: MonthlyStats;
  allTime: AllTimeStats;
  streak: ReadingStreak;
}

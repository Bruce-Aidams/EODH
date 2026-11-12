import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/lib/theme/ThemeContext';
import { computeAnalytics, formatDuration, formatNumber } from '@/lib/analytics/engine';
import { AnalyticsStats, DailyActivity } from '@/lib/analytics/types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, SHADOWS, GRADIENTS, toGradientCSS } from '@/constants/theme';
import { AnimatedView } from '@/components/AnimatedView';

const { width: screenWidth } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await computeAnalytics();
      setStats(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dailyActivity = period === 'weekly' 
    ? stats?.weekly.dailyActivity || [] 
    : stats?.monthly.dailyActivity || [];

  const maxActivity = useMemo(() => {
    if (dailyActivity.length === 0) return 1;
    return Math.max(...dailyActivity.map(d => Math.max(d.pagesRead, d.minutesRead, d.minutesListened, 1)));
  }, [dailyActivity]);

  const dayLabels = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dailyActivity.map(d => {
      const date = new Date(d.date + 'T00:00:00');
      return days[date.getDay()];
    });
  }, [dailyActivity]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Reading Analytics</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Sign in to track your reading analytics.
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStats = period === 'weekly' ? stats?.weekly : stats?.monthly;
  const periodLabel = period === 'weekly' ? 'This Week' : 'This Month';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reading Analytics</Text>
        <TouchableOpacity onPress={loadStats} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl }}>
        {/* Period Toggle */}
        <AnimatedView fadeDelay={100} fadeDuration={300} slideDirection="down" slideDistance={10}>
          <View style={styles.periodToggle}>
            {(['weekly', 'monthly'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodButton,
                  period === p && { backgroundColor: colors.primary },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[
                  styles.periodButtonText,
                  period === p && styles.periodButtonTextActive,
                  { color: period === p ? '#FFFFFF' : colors.textSecondary },
                ]}>
                  {p === 'weekly' ? 'This Week' : 'This Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </AnimatedView>

        {/* Stats Cards Grid */}
        <AnimatedView fadeDelay={200} fadeDuration={300} slideDirection="up" slideDistance={10}>
          <View style={styles.statsGrid}>
            <StatCard
              icon="book"
              label="Pages Read"
              value={formatNumber(currentStats?.totalPagesRead || 0)}
              subLabel={periodLabel}
              color={colors.primary}
              colors={colors}
            />
            <StatCard
              icon="time"
              label="Reading Time"
              value={formatDuration(currentStats?.totalMinutesRead || 0)}
              subLabel={periodLabel}
              color={colors.info}
              colors={colors}
            />
            <StatCard
              icon="headset"
              label="Listening Time"
              value={formatDuration(currentStats?.totalMinutesListened || 0)}
              subLabel={periodLabel}
              color={colors.accent}
              colors={colors}
            />
            <StatCard
              icon="checkmark-done"
              label="Books Done"
              value={formatNumber(currentStats?.booksCompleted || 0)}
              subLabel={`of ${currentStats?.booksStarted || 0} started`}
              color={colors.success}
              colors={colors}
            />
          </View>
        </AnimatedView>

        {/* Reading Streak */}
        <AnimatedView fadeDelay={300} fadeDuration={300} slideDirection="up" slideDistance={10}>
          <View style={[styles.streakCard, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
            <View style={styles.streakHeader}>
              <Ionicons name="flame" size={28} color={COLORS.warning} />
              <View style={styles.streakInfo}>
                <Text style={[styles.streakTitle, { color: colors.text }]}>Reading Streak</Text>
                <Text style={[styles.streakSubtitle, { color: colors.textSecondary }]}>
                  Keep it going!
                </Text>
              </View>
            </View>
            <View style={styles.streakStats}>
              <View style={styles.streakStat}>
                <Text style={[styles.streakValue, { color: COLORS.warning }]}>
                  {stats?.allTime.currentStreak || 0}
                </Text>
                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Current</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakStat}>
                <Text style={[styles.streakValue, { color: colors.primary }]}>
                  {stats?.allTime.longestStreak || 0}
                </Text>
                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Best</Text>
              </View>
            </View>
          </View>
        </AnimatedView>

        {/* All-Time Summary */}
        <AnimatedView fadeDelay={400} fadeDuration={300} slideDirection="up" slideDistance={10}>
          <View style={[styles.allTimeCard, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>All-Time Summary</Text>
            <View style={styles.allTimeGrid}>
              <AllTimeStat label="Total Pages" value={formatNumber(stats?.allTime.totalPagesRead || 0)} colors={colors} />
              <AllTimeStat label="Avg Pages/Day" value={formatNumber(stats?.allTime.averagePagesPerDay || 0)} colors={colors} />
              <AllTimeStat label="Total Reading" value={formatDuration(stats?.allTime.totalMinutesRead || 0)} colors={colors} />
              <AllTimeStat label="Avg Min/Day" value={formatNumber(stats?.allTime.averageMinutesPerDay || 0)} colors={colors} />
            </View>
          </View>
        </AnimatedView>

        {/* Activity Chart */}
        <AnimatedView fadeDelay={500} fadeDuration={300} slideDirection="up" slideDistance={10}>
          <View style={[styles.chartCard, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Daily Activity
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {periodLabel}
            </Text>
            
            {dailyActivity.length === 0 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>
                  No activity yet
                </Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {/* Y-axis labels */}
                <View style={styles.yAxis}>
                  <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{formatNumber(maxActivity)}</Text>
                  <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
                    {formatNumber(Math.round(maxActivity / 2))}
                  </Text>
                  <Text style={[styles.axisLabel, { color: colors.textMuted }]}>0</Text>
                </View>
                
                {/* Bars */}
                <View style={styles.barsContainer}>
                  <View style={styles.barsRow}>
                    {dailyActivity.map((day, index) => {
                      const value = Math.max(day.pagesRead, day.minutesRead, day.minutesListened);
                      const heightPercent = (value / maxActivity) * 100;
                      const hasActivity = value > 0;
                      
                      return (
                        <View key={day.date} style={styles.barColumn}>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: `${Math.max(heightPercent, 2)}%`,
                                  backgroundColor: hasActivity ? colors.primary : colors.surfaceVariant,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.dayLabel, { color: colors.textMuted }]}>
                            {dayLabels[index]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Reading</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Listening</Text>
              </View>
            </View>
          </View>
        </AnimatedView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, subLabel, color, colors }: {
  icon: any;
  label: string;
  value: string;
  subLabel: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statSubLabel, { color: colors.textMuted }]}>{subLabel}</Text>
    </View>
  );
}

// All-Time Stat Component
function AllTimeStat({ label, value, colors }: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.allTimeStat}>
      <Text style={[styles.allTimeValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.allTimeLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 24,
  },
  refreshButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  signInButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.full,
    padding: 3,
    marginBottom: SPACING.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: '48%',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  streakCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  streakInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  streakTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  streakSubtitle: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakStat: {
    alignItems: 'center',
    flex: 1,
  },
  streakValue: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.gray200,
    marginHorizontal: SPACING.md,
  },
  allTimeCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
  },
  allTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  allTimeStat: {
    width: '48%',
  },
  allTimeValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  allTimeLabel: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  chartCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyChartText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.md,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    paddingHorizontal: SPACING.sm,
  },
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    height: 140,
    marginRight: SPACING.sm,
  },
  axisLabel: {
    fontSize: 10,
    textAlign: 'right',
  },
  barsContainer: {
    flex: 1,
    height: 140,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
    gap: SPACING.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '60%',
    minWidth: 8,
    borderRadius: 4,
  },
  dayLabel: {
    fontSize: 10,
    marginTop: SPACING.xs,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FONT_SIZE.sm,
  },
});

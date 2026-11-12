import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useNetworkStatus } from '@/lib/network/useNetworkStatus';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS, SHADOWS, toGradientCSS } from '@/constants/theme';
import { useResponsiveDimensions } from '@/lib/responsive/useResponsiveDimensions';
import LazyImage from '@/components/LazyImage';
import { useTheme } from '@/lib/theme/ThemeContext';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import SearchBar from '@/components/SearchBar';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonCard, SkeletonList } from '@/components/Skeleton';
import { useHaptics } from '@/lib/haptics';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const books = useLibraryStore((s) => s.books);
  const featuredBooks = useLibraryStore((s) => s.featuredBooks);
  const recentlyOpened = useLibraryStore((s) => s.recentlyOpened);
  const recentlyListened = useLibraryStore((s) => s.recentlyListened);
  const fetchBooks = useLibraryStore((s) => s.fetchBooks);
  const fetchFeaturedBooks = useLibraryStore((s) => s.fetchFeaturedBooks);
  const fetchRecentlyOpened = useLibraryStore((s) => s.fetchRecentlyOpened);
  const fetchRecentlyListened = useLibraryStore((s) => s.fetchRecentlyListened);
  const { isOffline } = useNetworkStatus();
  const { colors, isDark } = useTheme();
  const { haptic } = useHaptics();
  const dimensions = useResponsiveDimensions();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchBooks(),
      fetchFeaturedBooks(),
      fetchRecentlyOpened(),
      fetchRecentlyListened()
    ]);
    setRefreshing(false);
  }, [fetchBooks, fetchFeaturedBooks, fetchRecentlyOpened, fetchRecentlyListened]);

  // Set ready state when auth loads
  useEffect(() => {
    if (!isLoading) {
      setReady(true);
    }
  }, [isLoading]);

  // Background refresh: use cached data from persist middleware on focus,
  // and only fetch fresh data in the background (TTL-based skip in store)
  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        // If cached data is available, show it immediately
        const hasCachedBooks = useLibraryStore.getState().books.length > 0;
        if (hasCachedBooks) {
          setDataLoaded(true);
        }
        // Background refresh — fetchBooks will skip if cache is fresh (< 60s)
        Promise.all([
          fetchBooks(),
          fetchFeaturedBooks(),
          fetchRecentlyOpened(),
          fetchRecentlyListened()
        ]).then(() => {
          setDataLoaded(true);
        });
      }
    }, [isLoading, fetchBooks, fetchFeaturedBooks, fetchRecentlyOpened, fetchRecentlyListened])
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (isLoading || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.loadingGradient, { backgroundImage: toGradientCSS(GRADIENTS.primary) }]}>
          <View style={styles.logoContainer}>
            <Ionicons name="book" size={48} color={COLORS.gold} />
            <Text style={styles.logoText}>EODH</Text>
            <Text style={styles.tagline}>Read. Listen. Learn.</Text>
          </View>
          <ActivityIndicator size="large" color={COLORS.gold} style={styles.loader} />
        </View>
      </View>
    );
  }

  // Always show content; use "Guest" if not logged in
  const displayName = isAuthenticated ? (user?.display_name || user?.email?.split('@')[0] || 'Reader') : 'Guest';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Offline Indicator */}
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.error }]}>
          <Ionicons name="wifi" size={14} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>You are offline — showing cached content</Text>
        </View>
      )}

      {/* Clean Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.text }]}>{greeting}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{displayName}</Text>
        </View>
        {isAuthenticated ? (
          <TouchableOpacity
            style={[styles.avatarButton, { backgroundColor: colors.surfaceVariant }]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.7}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        ) : (
          <Button
            title="Sign In"
            variant="outline"
            size="small"
            onPress={() => router.push('/auth/sign-in')}
          />
        )}
      </View>

      {/* Search Bar */}
      <TouchableOpacity onPress={() => router.push('/search')} activeOpacity={0.7} style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]}>Search by title or author...</Text>
        </View>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Skeleton Loading */}
        {!dataLoaded && (
          <View style={styles.skeletonSection}>
            <View style={styles.skeletonSectionHeader}>
              <SkeletonCard imageWidth="100%" imageHeight={160} titleLines={0} subtitleLines={0} />
            </View>
            <View style={styles.skeletonRow}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard
                  key={i}
                  imageWidth={dimensions.bookCardWidth}
                  imageHeight={dimensions.bookCardWidth * 1.4}
                  titleLines={2}
                  subtitleLines={1}
                />
              ))}
            </View>
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard
                  key={i}
                  imageWidth={dimensions.bookCardCompactWidth}
                  imageHeight={dimensions.bookCardCompactWidth * 1.4}
                  titleLines={2}
                  subtitleLines={1}
                />
              ))}
            </View>
          </View>
        )}
        {/* Continue Reading */}
        {dataLoaded && recentlyOpened.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={100} fadeDuration={400} slideDirection="up" slideDistance={20}>
            <SectionHeader
              title="Continue Reading"
              onPressSeeAll={() => router.push('/(tabs)/library')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {recentlyOpened.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </AnimatedView>
        )}

        {/* Continue Listening */}
        {dataLoaded && recentlyListened.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={200} fadeDuration={400} slideDirection="up" slideDistance={20}>
            <SectionHeader
              title="Continue Listening"
              onPressSeeAll={() => router.push('/(tabs)/audio')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {recentlyListened.map((item) => (
                <ListeningBookCard key={item.id} book={item} progress={item.listeningProgress} />
              ))}
            </ScrollView>
          </AnimatedView>
        )}

        {/* Featured Books */}
        {dataLoaded && featuredBooks.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={300} fadeDuration={400} slideDirection="up" slideDistance={20}>
            <SectionHeader
              title="Featured"
              onPressSeeAll={() => router.push('/(tabs)/library')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {featuredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </AnimatedView>
        )}

        {/* New Additions */}
        {dataLoaded && books.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={400} fadeDuration={400} slideDirection="up" slideDistance={20}>
            <SectionHeader title="New Additions" showSeeAll={false} />
            <View style={styles.grid}>
              {books.slice(0, 6).map((book) => (
                <View key={book.id} style={styles.gridItem}>
                  <BookCard book={book} compact />
                </View>
              ))}
            </View>
          </AnimatedView>
        )}

        {/* Empty State */}
        {dataLoaded && books.length === 0 && recentlyOpened.length === 0 && featuredBooks.length === 0 && (
          <EmptyState icon="book-outline" title="No Books Yet" subtitle="Books will appear here when added by the administrator." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const BookCard = React.memo(function BookCard({ book, compact }: { book: any; compact?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const dimensions = useResponsiveDimensions();
  const width = compact ? dimensions.bookCardCompactWidth : dimensions.bookCardWidth;
  const coverHeight = width * 1.4;

  return (
    <TouchableOpacity
      style={[styles.bookCard, { width }]}
      onPress={() => router.push(`/book/${book.id}`)}
      activeOpacity={0.7}
    >
      <View style={[
        styles.bookCover,
        { width, height: coverHeight, backgroundColor: colors.surfaceVariant },
        SHADOWS.md,
      ]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={coverHeight}
          borderRadius={BORDER_RADIUS.md}
        />
        {book.has_audio && (
          <View style={styles.audioBadge}>
            <Ionicons name="headset" size={10} color={COLORS.white} />
          </View>
        )}
      </View>
      <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
      <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{book.author}</Text>
    </TouchableOpacity>
  );
});

const ListeningBookCard = React.memo(function ListeningBookCard({ book, progress }: { book: any; progress: any }) {
  const router = useRouter();
  const { colors } = useTheme();
  const dimensions = useResponsiveDimensions();
  const width = dimensions.bookCardWidth;
  const coverHeight = width * 1.4;
  const progressPercent = progress?.progress_percent || 0;

  return (
    <TouchableOpacity
      style={[styles.bookCard, { width }]}
      onPress={() => router.push(`/book/${book.id}/audio`)}
      activeOpacity={0.7}
      accessibilityLabel={`Continue listening to ${book.title}`}
      accessibilityRole="button"
    >
      <View style={[
        styles.bookCover,
        { width, height: coverHeight, backgroundColor: colors.surfaceVariant },
        SHADOWS.md,
      ]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={coverHeight}
          borderRadius={BORDER_RADIUS.md}
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={40} color="#FFFFFF" />
        </View>
      </View>
      <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
      <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{book.author}</Text>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>{Math.round(progressPercent)}%</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.white,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    fontWeight: '400',
  },
  loader: {
    marginTop: 24,
  },
  authContainer: {
    flex: 1,
  },
  authGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  authSubtitle: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
  },
  authButtons: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  offlineBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  searchPlaceholder: {
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bookCard: {
    marginRight: 12,
    maxWidth: '85%',
  },
  bookCover: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: 6,
  },
  audioBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  bookAuthor: {
    fontSize: 12,
    marginTop: 1,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.brand,
  },
  progressText: {
    fontSize: 11,
    minWidth: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
  skeletonSection: {
    paddingHorizontal: 16,
    gap: 16,
  },
  skeletonSectionHeader: {
    marginBottom: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
});

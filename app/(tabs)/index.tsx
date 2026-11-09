import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
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
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { books, featuredBooks, recentlyOpened, recentlyListened, fetchBooks, fetchFeaturedBooks, fetchRecentlyOpened, fetchRecentlyListened } = useLibraryStore();
  const { isOffline } = useNetworkStatus();
  const { colors, isDark } = useTheme();
  const dimensions = useResponsiveDimensions();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  // Set ready state when auth loads
  useEffect(() => {
    if (!isLoading) {
      setReady(true);
    }
  }, [isLoading]);

  // Refetch data whenever the screen gains focus (e.g., after uploading a book)
  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        Promise.all([
          fetchBooks(),
          fetchFeaturedBooks(),
          fetchRecentlyOpened(),
          fetchRecentlyListened()
        ]);
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
        <View style={[styles.offlineBanner, { backgroundColor: COLORS.error }]}>
          <Ionicons name="wifi" size={16} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>You are offline — showing cached content</Text>
        </View>
      )}

      {/* Gradient Header */}
      <View style={[styles.gradientHeader, { backgroundImage: toGradientCSS(isDark ? GRADIENTS.dark : GRADIENTS.primary, 'diagonal'), paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting} numberOfLines={1}>{greeting}, {displayName}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>What would you like to read today?</Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/(tabs)/more')}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={40} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push('/auth/sign-in')}
              activeOpacity={0.7}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Modern Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/library')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.searchPlaceholder}>Search books, authors...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]} keyboardShouldPersistTaps="handled">
        {/* Continue Reading */}
        {recentlyOpened.length > 0 && (
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
        {recentlyListened.length > 0 && (
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
        {featuredBooks.length > 0 && (
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
        {books.length > 0 && (
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
        {books.length === 0 && recentlyOpened.length === 0 && featuredBooks.length === 0 && (
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
      <View style={[styles.bookCover, { width, height: coverHeight }]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={coverHeight}
          borderRadius={BORDER_RADIUS.lg}
        />
        {book.has_audio && (
          <View style={styles.audioBadge}>
            <Ionicons name="headset" size={12} color={COLORS.white} />
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
      <View style={[styles.bookCover, { width, height: coverHeight }]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={coverHeight}
          borderRadius={BORDER_RADIUS.lg}
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={48} color="#FFFFFF" />
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
    // paddingBottom is set dynamically with safe-area inset
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
    marginBottom: SPACING.xl,
  },
  logoText: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    letterSpacing: 4,
    color: COLORS.white,
    marginTop: SPACING.sm,
  },
  tagline: {
    fontSize: FONT_SIZE.lg,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.sm,
    fontWeight: '300',
  },
  loader: {
    marginTop: SPACING.xl,
  },
  authContainer: {
    flex: 1,
  },
  authGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  authSubtitle: {
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.md,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
  },
  authButtons: {
    width: '100%',
    gap: SPACING.md,
    marginTop: SPACING.xxl,
  },
  gradientHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  signInButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  signInButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  offlineBannerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchPlaceholder: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.6)',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  horizontalScroll: {
    paddingHorizontal: SPACING.md,
  },
  bookCard: {
    marginRight: SPACING.md,
    maxWidth: '85%',
  },
  bookCover: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  audioBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.royalPurple,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  bookAuthor: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: SPACING.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.royalPurple,
  },
  progressText: {
    fontSize: FONT_SIZE.xs,
    minWidth: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  gridItem: {
    width: '48%',
    marginBottom: SPACING.md,
  },
});

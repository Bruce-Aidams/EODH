import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useNetworkStatus } from '@/lib/network/useNetworkStatus';
import { COLORS, THEME, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import LazyImage from '@/components/LazyImage';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { books, featuredBooks, recentlyOpened, recentlyListened, fetchBooks, fetchFeaturedBooks, fetchRecentlyOpened, fetchRecentlyListened } = useLibraryStore();
  const { isOffline } = useNetworkStatus();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchBooks();
      fetchFeaturedBooks();
      fetchRecentlyOpened();
      fetchRecentlyListened();
      setReady(true);
    } else if (!isAuthenticated && !isLoading) {
      setReady(true);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>EODH</Text>
          <Text style={styles.tagline}>Read. Listen. Learn.</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.gold} style={styles.loader} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>EODH</Text>
          <Text style={styles.tagline}>Read. Listen. Learn.</Text>
          <Text style={styles.authSubtitle}>Sign in to access your digital library</Text>
        </View>
        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.authButtonSecondary]}
            onPress={() => router.push('/auth/sign-up')}
          >
            <Text style={[styles.authButtonText, styles.authButtonTextSecondary]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const greeting = getGreeting();
  const displayName = user?.display_name || user?.email?.split('@')[0] || 'Reader';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Offline Indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-off-outline" size={16} color={COLORS.white} />
          <Text style={styles.offlineBannerText}>You are offline — showing cached content</Text>
        </View>
      )}
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {displayName}</Text>
            <Text style={styles.subtitle}>What would you like to read today?</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/more')}
          >
            <Ionicons name="person-circle" size={40} color={COLORS.royalPurple} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/library')}
        >
          <Ionicons name="search" size={20} color={COLORS.gray400} />
          <Text style={styles.searchPlaceholder}>Search books, authors...</Text>
        </TouchableOpacity>

        {/* Continue Reading */}
        {recentlyOpened.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continue Reading</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {recentlyOpened.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Listening */}
        {recentlyListened.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continue Listening</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/audio')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {recentlyListened.map((item) => (
                <ListeningBookCard key={item.id} book={item} progress={item.listeningProgress} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Books */}
        {featuredBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {featuredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* New Additions */}
        {books.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>New Additions</Text>
            </View>
            <View style={styles.grid}>
              {books.slice(0, 6).map((book) => (
                <BookCard key={book.id} book={book} compact />
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {books.length === 0 && recentlyOpened.length === 0 && featuredBooks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={COLORS.gray300} />
            <Text style={styles.emptyTitle}>No Books Yet</Text>
            <Text style={styles.emptySubtitle}>
              Books will appear here when added by the administrator.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookCard({ book, compact }: { book: any; compact?: boolean }) {
  const router = useRouter();
  const width = compact ? 140 : 160;

  return (
    <TouchableOpacity
      style={[styles.bookCard, { width }]}
      onPress={() => router.push(`/book/${book.id}`)}
    >
      <View style={[styles.bookCover, { width, height: width * 1.4 }]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={width * 1.4}
          borderRadius={BORDER_RADIUS.md}
        />
        {book.has_audio && (
          <View style={styles.audioBadge}>
            <Ionicons name="headset" size={12} color={COLORS.white} />
          </View>
        )}
      </View>
      <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
    </TouchableOpacity>
  );
}

function ListeningBookCard({ book, progress }: { book: any; progress: any }) {
  const router = useRouter();
  const width = 160;
  const progressPercent = progress?.progress_percent || 0;

  return (
    <TouchableOpacity
      style={[styles.bookCard, { width }]}
      onPress={() => router.push(`/book/${book.id}/audio`)}
      accessibilityLabel={`Continue listening to ${book.title}`}
      accessibilityRole="button"
    >
      <View style={[styles.bookCover, { width, height: width * 1.4 }]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={width}
          height={width * 1.4}
          borderRadius={BORDER_RADIUS.md}
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={48} color={COLORS.white} opacity={0.9} />
        </View>
        {book.has_audio && (
          <View style={styles.audioBadge}>
            <Ionicons name="headset" size={12} color={COLORS.white} />
          </View>
        )}
      </View>
      <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progressPercent)}%</Text>
      </View>
    </TouchableOpacity>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.white,
    letterSpacing: 4,
    marginTop: SPACING.sm,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  authContainer: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  authSubtitle: {
    fontSize: 16,
    color: COLORS.gray400,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  authButtons: {
    width: '100%',
    gap: SPACING.md,
    marginTop: SPACING.xxl,
  },
  authButton: {
    backgroundColor: COLORS.royalPurple,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  authButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.royalPurple,
  },
  authButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  authButtonTextSecondary: {
    color: COLORS.royalPurple,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    marginTop: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  offlineBannerText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchPlaceholder: {
    marginLeft: SPACING.sm,
    color: COLORS.gray400,
    fontSize: 14,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.royalPurple,
    fontWeight: '500',
  },
  horizontalScroll: {
    paddingRight: SPACING.md,
  },
  bookCard: {
    marginRight: SPACING.md,
  },
  bookCover: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.royalPurple,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.md,
  },
  coverTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
    position: 'absolute',
    bottom: SPACING.sm,
  },
  audioBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepNavy,
    marginTop: 2,
  },
  bookAuthor: {
    fontSize: 11,
    color: COLORS.gray500,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 11, 46, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: SPACING.xs,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: COLORS.gray500,
    minWidth: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray600,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
});

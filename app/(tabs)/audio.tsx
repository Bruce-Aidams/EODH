import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS, SHADOWS, toGradientCSS } from '@/constants/theme';
import { useResponsiveDimensions } from '@/lib/responsive/useResponsiveDimensions';
import LazyImage from '@/components/LazyImage';
import { SectionHeader } from '@/components/SectionHeader';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AudioScreen() {
  const router = useRouter();
  const recentlyListened = useLibraryStore((s) => s.recentlyListened);
  const books = useLibraryStore((s) => s.books);
  const fetchRecentlyListened = useLibraryStore((s) => s.fetchRecentlyListened);
  const fetchBooks = useLibraryStore((s) => s.fetchBooks);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);


  useEffect(() => {
    fetchRecentlyListened();
    fetchBooks();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRecentlyListened(), fetchBooks()]);
    setIsRefreshing(false);
  }, [fetchRecentlyListened, fetchBooks]);

  const audioBooks = useMemo(() => books.filter(b => b.has_audio), [books]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Gradient Header */}
      <AnimatedView fadeDelay={50} fadeDuration={400} slideDirection="down" slideDistance={20}>
        <View style={[styles.gradientHeader, { backgroundImage: toGradientCSS(isDark ? GRADIENTS.dark : GRADIENTS.primary, 'diagonal'), paddingTop: insets.top + SPACING.md }]}>
          <Text style={styles.headerTitle}>Audio</Text>
          <Text style={styles.headerSubtitle}>Listen to your audiobooks</Text>
        </View>
      </AnimatedView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.royalPurple} />
        }
      >
        {/* Continue Listening */}
        {recentlyListened.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
            <SectionHeader title="Continue Listening" showSeeAll={false} />
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

        {/* All Audiobooks */}
        {audioBooks.length > 0 && (
          <AnimatedView style={styles.section} fadeDelay={250} fadeDuration={400} slideDirection="up" slideDistance={15}>
            <SectionHeader title="All Audiobooks" showSeeAll={false} />
            <View style={styles.list}>
              {audioBooks.map((book) => (
                <AudioBookListItem key={book.id} book={book} />
              ))}
            </View>
          </AnimatedView>
        )}

        {/* Empty State */}
        {recentlyListened.length === 0 && audioBooks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="headset-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Audiobooks Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Audiobooks will appear here when added by the administrator.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ListeningBookCard = memo(function ListeningBookCard({ book, progress }: { book: any; progress: any }) {
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

const AudioBookListItem = memo(function AudioBookListItem({ book }: { book: any }) {
  const router = useRouter();
  const { colors } = useTheme();
  const dimensions = useResponsiveDimensions();

  return (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/book/${book.id}/audio`)}
      activeOpacity={0.7}
      accessibilityLabel={`Listen to ${book.title}`}
      accessibilityRole="button"
    >
      <View style={[styles.listCover, { width: dimensions.listItemCoverWidth, height: dimensions.listItemCoverHeight }]}>
        <LazyImage
          uri={book.cover_url || undefined}
          width={dimensions.listItemCoverWidth}
          height={dimensions.listItemCoverHeight}
          borderRadius={BORDER_RADIUS.md}
        />
      </View>
      <View style={styles.listInfo}>
        <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{book.title}</Text>
        <Text style={[styles.listAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{book.author}</Text>
        <Text style={[styles.listDescription, { color: colors.textMuted }]} numberOfLines={2}>{book.description}</Text>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => router.push(`/book/${book.id}/audio`)}
        activeOpacity={0.7}
        accessibilityLabel={`Play ${book.title}`}
        accessibilityRole="button"
      >
        <Ionicons name="play-circle" size={40} color={COLORS.royalPurple} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scrollContent: {
    // paddingBottom is set dynamically with safe-area inset
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
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  list: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  listCover: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  listInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    minWidth: 0,
  },
  listTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  listAuthor: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  listDescription: {
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    lineHeight: 16,
  },
  playButton: {
    marginLeft: SPACING.md,
    flexShrink: 0,
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
});

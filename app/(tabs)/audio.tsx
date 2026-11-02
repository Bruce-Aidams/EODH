import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLibraryStore } from '@/stores/libraryStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AudioScreen() {
  const router = useRouter();
  const { recentlyListened, books, fetchRecentlyListened, fetchBooks } = useLibraryStore();

  useEffect(() => {
    fetchRecentlyListened();
    fetchBooks();
  }, []);

  const audioBooks = books.filter(b => b.has_audio);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Audio</Text>
        <Text style={styles.headerSubtitle}>Listen to your audiobooks</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Continue Listening */}
        {recentlyListened.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continue Listening</Text>
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

        {/* All Audiobooks */}
        {audioBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Audiobooks</Text>
            </View>
            <View style={styles.list}>
              {audioBooks.map((book) => (
                <AudioBookListItem key={book.id} book={book} />
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {recentlyListened.length === 0 && audioBooks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="headset-outline" size={64} color={COLORS.gray300} />
            <Text style={styles.emptyTitle}>No Audiobooks Yet</Text>
            <Text style={styles.emptySubtitle}>
              Audiobooks will appear here when added by the administrator.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
        ) : (
          <>
            <View style={styles.coverGradient} />
            <Ionicons name="book" size={32} color={COLORS.white} />
            <Text style={styles.coverTitle}>{book.title}</Text>
          </>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={48} color={COLORS.white} opacity={0.9} />
        </View>
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

function AudioBookListItem({ book }: { book: any }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => router.push(`/book/${book.id}/audio`)}
      accessibilityLabel={`Listen to ${book.title}`}
      accessibilityRole="button"
    >
      <View style={styles.listCover}>
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.listCoverImage} />
        ) : (
          <>
            <View style={styles.listCoverGradient} />
            <Ionicons name="book" size={24} color={COLORS.white} />
          </>
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listTitle} numberOfLines={1}>{book.title}</Text>
        <Text style={styles.listAuthor} numberOfLines={1}>{book.author}</Text>
        <Text style={styles.listDescription} numberOfLines={2}>{book.description}</Text>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => router.push(`/book/${book.id}/audio`)}
        accessibilityLabel={`Play ${book.title}`}
        accessibilityRole="button"
      >
        <Ionicons name="play-circle" size={40} color={COLORS.royalPurple} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
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
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 11, 46, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
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
  list: {
    gap: SPACING.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listCover: {
    width: 50,
    height: 70,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCoverImage: {
    width: '100%',
    height: '100%',
  },
  listCoverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.royalPurple,
  },
  listInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  listAuthor: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  listDescription: {
    fontSize: 11,
    color: COLORS.gray400,
    marginTop: 4,
    lineHeight: 16,
  },
  playButton: {
    marginLeft: SPACING.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
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
  },
});

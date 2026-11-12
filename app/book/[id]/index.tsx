import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { getInfoAsync, makeDirectoryAsync, createDownloadResumable, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useToast } from '@/lib/notifications/toast';
import { Book } from '@/types';
import { SPACING, BORDER_RADIUS, GRADIENTS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonCard, SkeletonText, SkeletonList } from '@/components/Skeleton';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const getReadingProgress = useLibraryStore((s) => s.getReadingProgress);
  const getListeningProgress = useLibraryStore((s) => s.getListeningProgress);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const favorites = useLibraryStore((s) => s.favorites);
  const { showSuccess, showError, showWarning } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [listeningProgress, setListeningProgress] = useState<number>(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [localDocumentUri, setLocalDocumentUri] = useState<string | null>(null);

  const bookId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    fetchBook();
    checkDownloaded();
  }, [bookId]);

  const checkDownloaded = async () => {
    if (!bookId) return;
    const docUri = `${FileSystem.documentDirectory}eodh/books/${bookId}/document`;
    const audioUri = `${FileSystem.documentDirectory}eodh/books/${bookId}/audio`;
    
    const docExists = await getInfoAsync(docUri);
    const audioExists = await getInfoAsync(audioUri);
    
    if (docExists.exists || audioExists.exists) {
      setIsDownloaded(true);
      if (docExists.exists) {
        setLocalDocumentUri(docUri);
      }
    }
  };

  const fetchBook = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (data) {
        setBook(data);
        const rp = await getReadingProgress(bookId!);
        if (rp) setReadingProgress(rp.progress_percent);
        const lp = await getListeningProgress(bookId!);
        if (lp) setListeningProgress(lp.progress_percent);
        setIsFavorite(favorites.includes(bookId!));
      }
    } catch {
      // Book not found
    }
    setLoading(false);
  };

  const handleToggleFavorite = () => {
    toggleFavorite(bookId!);
    setIsFavorite(!isFavorite);
  };

  const handleDownload = async () => {
    if (!book || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const downloadDir = `${FileSystem.documentDirectory}eodh/books/${bookId}/`;
      
      // Create directory
      const dirInfo = await getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      if (book.document_url) {
        const downloadUri = `${downloadDir}document`;
        const downloadingTask = createDownloadResumable(
          book.document_url,
          downloadUri,
          {},
          (downloadProgressSummary: any) => {
            const progress = (downloadProgressSummary.bytesWritten / downloadProgressSummary.totalBytesExpectedToWrite) * 100;
            setDownloadProgress(progress);
          }
        );

        const downloadResult = await downloadingTask.downloadAsync();
        
        if (downloadResult?.uri) {
          setLocalDocumentUri(downloadResult.uri);
          
          // Save metadata
          await writeAsStringAsync(
            `${downloadDir}metadata.json`,
            JSON.stringify({
              bookId: book.id,
              title: book.title,
              downloadedAt: new Date().toISOString(),
              documentUri: downloadResult.uri,
            })
          );
        }
      }

      setIsDownloaded(true);
      showSuccess(`"${book.title}" downloaded for offline access.`);
    } catch (error) {
      console.error('Download error:', error);
      showError('Failed to download the book. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleRemoveDownload = async () => {
    if (!bookId) return;

    Alert.alert(
      'Remove Download',
      'This will remove the downloaded files but keep the book in your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const downloadDir = `${FileSystem.documentDirectory}eodh/books/${bookId}/`;
              const dirInfo = await getInfoAsync(downloadDir);
              
              if (dirInfo.exists) {
                await deleteAsync(downloadDir, { idempotent: true });
              }
              
              setIsDownloaded(false);
              setLocalDocumentUri(null);
              showSuccess('Downloaded files have been removed.');
            } catch (error) {
              console.error('Remove download error:', error);
              showError('Failed to remove downloaded files.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xxl }}>
          {/* Header skeleton */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg, paddingTop: insets.top }}>
            <SkeletonText width={40} height={24} />
            <SkeletonText width={40} height={24} />
          </View>
          {/* Cover skeleton */}
          <SkeletonCard width="100%" height={260} borderRadius={BORDER_RADIUS.lg} marginBottom={SPACING.lg} />
          {/* Title & author skeleton */}
          <SkeletonText width="80%" height={28} marginBottom={SPACING.sm} />
          <SkeletonText width="50%" height={18} marginBottom={SPACING.lg} />
          {/* Meta badges skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.lg }}>
            <SkeletonText width={60} height={24} borderRadius={20} />
            <SkeletonText width={60} height={24} borderRadius={20} />
            <SkeletonText width={60} height={24} borderRadius={20} />
          </View>
          {/* Description skeleton */}
          <SkeletonList count={4} marginBottom={SPACING.lg} />
          {/* Action buttons skeleton */}
          <SkeletonCard width="100%" height={72} borderRadius={BORDER_RADIUS.md} marginBottom={SPACING.md} />
          <SkeletonCard width="100%" height={72} borderRadius={BORDER_RADIUS.md} marginBottom={SPACING.md} />
          <SkeletonCard width="100%" height={72} borderRadius={BORDER_RADIUS.md} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={[styles.emptyContainer, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <Ionicons name="book-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Book Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFavorite}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? colors.error : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Book Cover */}
        <View style={styles.coverContainer}>
          {book.cover_url ? (
            <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverGradient} />
              <Ionicons name="book" size={48} color="#FFFFFF" />
              <Text style={styles.coverTitle}>{book.title}</Text>
            </View>
          )}
        </View>

        {/* Book Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.title, { color: colors.text }]}>{book.title}</Text>
          <Text style={[styles.author, { color: colors.textSecondary }]}>{book.author}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons
                name={book.document_type === 'pdf' ? 'document-text' : 'code-slash'}
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{book.document_type.toUpperCase()}</Text>
            </View>
            {book.has_audio && (
              <View style={[styles.metaBadge, styles.audioBadge]}>
                <Ionicons name="headset" size={14} color="#FFFFFF" />
                <Text style={[styles.metaText, styles.audioBadgeText]}>Audio</Text>
              </View>
            )}
            {book.publication_date && (
              <View style={styles.metaBadge}>
                <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {new Date(book.publication_date).getFullYear()}
                </Text>
              </View>
            )}
          </View>

          {book.description ? (
            <View style={styles.descriptionSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Description</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{book.description}</Text>
            </View>
          ) : null}

          {/* Progress */}
          {readingProgress > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Reading Progress</Text>
                <Text style={[styles.progressPercent, { color: colors.textSecondary }]}>{Math.round(readingProgress)}%</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${readingProgress}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          )}

          {listeningProgress > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Listening Progress</Text>
                <Text style={[styles.progressPercent, { color: colors.textSecondary }]}>{Math.round(listeningProgress)}%</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${listeningProgress}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}
            onPress={() => router.push(`/book/${book.id}/reader`)}
          >
            <LinearGradient colors={GRADIENTS.primary} style={styles.actionIconContainer}>
              <Ionicons name="book" size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Read</Text>
              <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>Open ebook reader</Text>
            </View>
            {isDownloaded && (
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            )}
          </TouchableOpacity>

          {book.has_audio && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}
              onPress={() => router.push(`/book/${book.id}/audio`)}
            >
              <LinearGradient colors={GRADIENTS.accent} style={styles.actionIconContainer}>
                <Ionicons name="play-circle" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Listen</Text>
                <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>Play audiobook</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}
            onPress={() => router.push(`/book/${book.id}/sync`)}
          >
            <LinearGradient colors={GRADIENTS.secondary} style={styles.actionIconContainer}>
              <Ionicons name="sync-circle" size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Read Along</Text>
              <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>
                {book.has_audio ? 'Sync text with audio' : 'Text-to-speech with highlighting'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Download Button */}
          {!isDownloaded ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, shadowColor: colors.cardShadow }, isDownloading && styles.disabledButton]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              <LinearGradient colors={GRADIENTS.light} style={styles.actionIconContainer}>
                <Ionicons name="download" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>
                  {isDownloading ? 'Downloading...' : 'Download for Offline'}
                </Text>
                <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>
                  {isDownloading 
                    ? `${Math.round(downloadProgress)}% complete` 
                    : 'Read without internet connection'
                  }
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}
              onPress={handleRemoveDownload}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: colors.textSecondary }]}>
                <Ionicons name="cloud-offline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Downloaded</Text>
                <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>Tap to remove downloaded files</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  backButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    maxWidth: 200,
    width: '60%',
  },
  coverImage: {
    width: '100%',
    maxWidth: 200,
    aspectRatio: 200 / 280,
    borderRadius: BORDER_RADIUS.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  coverPlaceholder: {
    width: '100%',
    maxWidth: 200,
    aspectRatio: 200 / 280,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  coverGradient: {
    ...StyleSheet.absoluteFill,
  },
  coverTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    bottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  infoSection: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  author: {
    fontSize: 16,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  audioBadge: {
  },
  audioBadgeText: {
  },
  descriptionSection: {
    marginTop: SPACING.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    overflow: 'hidden',
  },
  progressSection: {
    marginTop: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionsSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionSubtext: {
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
});

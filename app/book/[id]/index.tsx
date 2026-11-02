import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase/client';
import { useLibraryStore } from '@/stores/libraryStore';
import { useToast } from '@/lib/notifications/toast';
import { Book } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getReadingProgress, getListeningProgress, toggleFavorite, favorites } = useLibraryStore();
  const { showSuccess, showError, showWarning } = useToast();
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
    
    const docExists = await FileSystem.getInfoAsync(docUri);
    const audioExists = await FileSystem.getInfoAsync(audioUri);
    
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
        const rp = await getReadingProgress(bookId);
        if (rp) setReadingProgress(rp.progress_percent);
        const lp = await getListeningProgress(bookId);
        if (lp) setListeningProgress(lp.progress_percent);
        setIsFavorite(favorites.includes(bookId));
      }
    } catch {
      // Book not found
    }
    setLoading(false);
  };

  const handleToggleFavorite = () => {
    toggleFavorite(bookId);
    setIsFavorite(!isFavorite);
  };

  const handleDownload = async () => {
    if (!book || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const downloadDir = `${FileSystem.documentDirectory}eodh/books/${bookId}/`;
      
      // Create directory
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      // Download document if available
      if (book.document_url) {
        const downloadUri = `${downloadDir}document`;
        const downloadingTask = FileSystem.createDownloadResumableSession(
          book.document_url,
          downloadUri,
          {},
          (downloadProgressSummary) => {
            const progress = (downloadProgressSummary.bytesWritten / downloadProgressSummary.totalBytesExpectedToWrite) * 100;
            setDownloadProgress(progress);
          }
        );

        const downloadResult = await downloadingTask.downloadAsync();
        
        if (downloadResult?.uri) {
          setLocalDocumentUri(downloadResult.uri);
          
          // Save metadata
          await FileSystem.writeAsStringAsync(
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
              const dirInfo = await FileSystem.getInfoAsync(downloadDir);
              
              if (dirInfo.exists) {
                await FileSystem.deleteAsync(downloadDir, { idempotent: true });
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.royalPurple} />
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Ionicons name="book-outline" size={64} color={COLORS.gray300} />
        <Text style={styles.emptyTitle}>Book Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFavorite}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? COLORS.error : COLORS.gray400}
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
              <Ionicons name="book" size={48} color={COLORS.white} />
              <Text style={styles.coverTitle}>{book.title}</Text>
            </View>
          )}
        </View>

        {/* Book Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons
                name={book.document_type === 'pdf' ? 'document-text' : 'code-slash'}
                size={14}
                color={COLORS.royalPurple}
              />
              <Text style={styles.metaText}>{book.document_type.toUpperCase()}</Text>
            </View>
            {book.has_audio && (
              <View style={[styles.metaBadge, styles.audioBadge]}>
                <Ionicons name="headset" size={14} color={COLORS.white} />
                <Text style={[styles.metaText, styles.audioBadgeText]}>Audio</Text>
              </View>
            )}
            {book.publication_date && (
              <View style={styles.metaBadge}>
                <Ionicons name="calendar" size={14} color={COLORS.gray500} />
                <Text style={styles.metaText}>
                  {new Date(book.publication_date).getFullYear()}
                </Text>
              </View>
            )}
          </View>

          {book.description ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{book.description}</Text>
            </View>
          ) : null}

          {/* Progress */}
          {readingProgress > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.sectionLabel}>Reading Progress</Text>
                <Text style={styles.progressPercent}>{Math.round(readingProgress)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${readingProgress}%` }]} />
              </View>
            </View>
          )}

          {listeningProgress > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.sectionLabel}>Listening Progress</Text>
                <Text style={styles.progressPercent}>{Math.round(listeningProgress)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${listeningProgress}%` }]} />
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/book/${book.id}/reader`)}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="book" size={24} color={COLORS.white} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Read</Text>
              <Text style={styles.actionSubtext}>Open ebook reader</Text>
            </View>
            {isDownloaded && (
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            )}
          </TouchableOpacity>

          {book.has_audio && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/book/${book.id}/audio`)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: COLORS.gold }]}>
                <Ionicons name="play-circle" size={24} color={COLORS.white} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Listen</Text>
                <Text style={styles.actionSubtext}>Play audiobook</Text>
              </View>
            </TouchableOpacity>
          )}

          {book.has_audio && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/book/${book.id}/sync`)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: COLORS.violet }]}>
                <Ionicons name="sync-circle" size={24} color={COLORS.white} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Read Along</Text>
                <Text style={styles.actionSubtext}>Sync text with audio</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Download Button */}
          {!isDownloaded ? (
            <TouchableOpacity
              style={[styles.actionButton, isDownloading && styles.disabledButton]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: COLORS.success }]}>
                <Ionicons name="download" size={24} color={COLORS.white} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>
                  {isDownloading ? 'Downloading...' : 'Download for Offline'}
                </Text>
                <Text style={styles.actionSubtext}>
                  {isDownloading 
                    ? `${Math.round(downloadProgress)}% complete` 
                    : 'Read without internet connection'
                  }
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRemoveDownload}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: COLORS.gray500 }]}>
                <Ionicons name="cloud-offline" size={24} color={COLORS.white} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Downloaded</Text>
                <Text style={styles.actionSubtext}>Tap to remove downloaded files</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
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
    backgroundColor: COLORS.lightBackground,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
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
  backButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.royalPurple,
    borderRadius: BORDER_RADIUS.md,
  },
  backButtonText: {
    color: COLORS.white,
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
  },
  coverImage: {
    width: 200,
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  coverPlaceholder: {
    width: 200,
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.royalPurple,
  },
  coverTitle: {
    color: COLORS.white,
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
    color: COLORS.deepNavy,
    marginBottom: SPACING.xs,
  },
  author: {
    fontSize: 16,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  audioBadge: {
    backgroundColor: COLORS.gold,
  },
  audioBadgeText: {
    color: COLORS.white,
  },
  descriptionSection: {
    marginTop: SPACING.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 20,
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
    color: COLORS.royalPurple,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.royalPurple,
    borderRadius: 3,
  },
  actionsSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  actionButton: {
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
  disabledButton: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.royalPurple,
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
    color: COLORS.deepNavy,
  },
  actionSubtext: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
});

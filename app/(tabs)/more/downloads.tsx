import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/stores/settingsStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import * as FileSystem from 'expo-file-system';

interface DownloadedBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  file_size: number | null;
  downloaded_at: string;
  has_document: boolean;
  has_audio: boolean;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const { offlineMode, setOfflineMode } = useSettingsStore();
  const [downloads, setDownloads] = useState<DownloadedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    fetchDownloads();
  }, []);

  const fetchDownloads = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch download records
      const { data: downloadData } = await supabase
        .from('downloads')
        .select('book_id, created_at, document_url, audio_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const books: DownloadedBook[] = [];
      let size = 0;

      for (const dl of downloadData || []) {
        const { data: book } = await supabase
          .from('books')
          .select('id, title, author, cover_url, file_size')
          .eq('id', dl.book_id)
          .single();

        if (book) {
          const bookSize = book.file_size || 0;
          size += bookSize;
          books.push({
            id: book.id,
            title: book.title,
            author: book.author,
            cover_url: book.cover_url,
            file_size: bookSize,
            downloaded_at: dl.created_at,
            has_document: !!dl.document_url,
            has_audio: !!dl.audio_url,
          });
        }
      }

      setDownloads(books);
      setTotalSize(size);
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDownload = (bookId: string) => {
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
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              await supabase.from('downloads').delete().eq('user_id', user.id).eq('book_id', bookId);
              
              // Remove local files
              const downloadDir = `${FileSystem.documentDirectory}EODH/downloads/${bookId}/`;
              try {
                const dirInfo = await FileSystem.getInfoAsync(downloadDir);
                if (dirInfo.exists) {
                  await FileSystem.deleteAsync(downloadDir, { idempotent: true });
                }
              } catch {}

              setDownloads(prev => prev.filter(d => d.id !== bookId));
            } catch (error) {
              Alert.alert('Error', 'Failed to remove download');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
      </View>

      {/* Offline Mode Toggle */}
      <View style={styles.offlineModeCard}>
        <View style={styles.offlineModeInfo}>
          <Ionicons name="cloud-offline" size={20} color={COLORS.royalPurple} />
          <View style={styles.offlineModeText}>
            <Text style={styles.offlineModeTitle}>Offline Mode</Text>
            <Text style={styles.offlineModeSubtitle}>
              Access downloaded books without internet
            </Text>
          </View>
        </View>
        <Switch
          value={offlineMode}
          onValueChange={setOfflineMode}
          trackColor={{ false: COLORS.gray300, true: COLORS.royalPurple + '40' }}
          thumbColor={offlineMode ? COLORS.royalPurple : COLORS.gray400}
        />
      </View>

      {/* Storage Info */}
      <View style={styles.storageInfo}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.gray500} />
        <Text style={styles.storageText}>
          {downloads.length} book{downloads.length !== 1 ? 's' : ''} • {formatFileSize(totalSize)} used
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={styles.loadingText}>Loading downloads...</Text>
        </View>
      ) : downloads.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-download-outline" size={64} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>No Downloads Yet</Text>
          <Text style={styles.emptySubtitle}>
            Download books from the library to read and listen offline.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {downloads.map((book) => (
            <View key={book.id} style={styles.downloadCard}>
              <TouchableOpacity
                style={styles.downloadInfo}
                onPress={() => router.push(`/book/${book.id}`)}
              >
                <View style={styles.coverContainer}>
                  <View style={styles.cover}>
                    <Ionicons name="book" size={32} color={COLORS.gray400} />
                  </View>
                  <View style={styles.downloadBadge}>
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  </View>
                </View>
                <View style={styles.downloadText}>
                  <Text style={styles.downloadTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={styles.downloadAuthor} numberOfLines={1}>{book.author}</Text>
                  <View style={styles.downloadMeta}>
                    {book.has_document && (
                      <View style={styles.metaBadge}>
                        <Ionicons name="document-text" size={12} color={COLORS.royalPurple} />
                        <Text style={styles.metaText}>PDF</Text>
                      </View>
                    )}
                    {book.has_audio && (
                      <View style={styles.metaBadge}>
                        <Ionicons name="musical-notes" size={12} color={COLORS.violet} />
                        <Text style={styles.metaText}>Audio</Text>
                      </View>
                    )}
                    <Text style={styles.downloadDate}>{formatDate(book.downloaded_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveDownload(book.id)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.deepNavy,
    textAlign: 'center',
    marginRight: 24,
  },
  offlineModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  offlineModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offlineModeText: {
    marginLeft: SPACING.sm,
  },
  offlineModeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  offlineModeSubtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: 4,
  },
  storageText: {
    fontSize: 12,
    color: COLORS.gray500,
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
    fontSize: 14,
    color: COLORS.gray500,
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
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  downloadInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  cover: {
    width: 50,
    height: 65,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadText: {
    flex: 1,
  },
  downloadTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  downloadAuthor: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  downloadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: SPACING.xs,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.royalPurple,
  },
  downloadDate: {
    fontSize: 11,
    color: COLORS.gray400,
    marginLeft: 'auto',
  },
  removeButton: {
    padding: SPACING.sm,
  },
});

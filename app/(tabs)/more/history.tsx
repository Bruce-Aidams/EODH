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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';

interface HistoryItem {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
  last_read_at: string;
  progress_percent: number;
  type: 'reading' | 'listening';
}

export default function HistoryScreen() {
  const router = useRouter();
  const { books } = useLibraryStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reading' | 'listening'>('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const items: HistoryItem[] = [];

      // Fetch reading progress
      const { data: readingData } = await supabase
        .from('reading_progress')
        .select('book_id, progress_percent, last_read_at')
        .eq('user_id', user.id)
        .order('last_read_at', { ascending: false });

      for (const rp of readingData || []) {
        const { data: book } = await supabase
          .from('books')
          .select('title, author, cover_url')
          .eq('id', rp.book_id)
          .single();

        if (book) {
          items.push({
            id: `read-${rp.book_id}`,
            book_id: rp.book_id,
            book_title: book.title,
            book_author: book.author,
            book_cover_url: book.cover_url,
            last_read_at: rp.last_read_at,
            progress_percent: rp.progress_percent || 0,
            type: 'reading',
          });
        }
      }

      // Fetch listening progress
      const { data: listeningData } = await supabase
        .from('listening_progress')
        .select('book_id, progress_percent, last_listened_at')
        .eq('user_id', user.id)
        .order('last_listened_at', { ascending: false });

      for (const lp of listeningData || []) {
        const { data: book } = await supabase
          .from('books')
          .select('title, author, cover_url')
          .eq('id', lp.book_id)
          .single();

        if (book) {
          items.push({
            id: `listen-${lp.book_id}`,
            book_id: lp.book_id,
            book_title: book.title,
            book_author: book.author,
            book_cover_url: book.cover_url,
            last_read_at: lp.last_listened_at,
            progress_percent: lp.progress_percent || 0,
            type: 'listening',
          });
        }
      }

      // Sort by date
      items.sort((a, b) => new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime());
      setHistory(items);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(item => item.type === filter);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reading History</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'reading', 'listening'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : filteredHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start reading or listening to see your history here.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {filteredHistory.map((item) => (
            <TouchableOpacity
              key={`${item.id}-${item.type}`}
              style={styles.historyCard}
              onPress={() => router.push(`/book/${item.book_id}`)}
            >
              <View style={styles.coverContainer}>
                <View style={styles.cover}>
                  <Ionicons name="book" size={32} color={COLORS.gray400} />
                </View>
                <View style={[styles.typeBadge, item.type === 'listening' && styles.typeBadgeListening]}>
                  <Ionicons
                    name={item.type === 'reading' ? 'eye' : 'headset'}
                    size={12}
                    color={COLORS.white}
                  />
                </View>
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle} numberOfLines={1}>{item.book_title}</Text>
                <Text style={styles.historyAuthor} numberOfLines={1}>{item.book_author}</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(item.progress_percent, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{Math.round(item.progress_percent)}%</Text>
                </View>
              </View>
              <View style={styles.historyMeta}>
                <Text style={styles.historyDate}>{formatDate(item.last_read_at)}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
              </View>
            </TouchableOpacity>
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.lightBackground,
  },
  filterTabActive: {
    backgroundColor: COLORS.royalPurple,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  filterTextActive: {
    color: COLORS.white,
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
  historyCard: {
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
  typeBadge: {
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
  typeBadgeListening: {
    backgroundColor: COLORS.violet,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  historyAuthor: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.royalPurple,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.gray500,
    minWidth: 30,
  },
  historyMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyDate: {
    fontSize: 12,
    color: COLORS.gray400,
  },
});

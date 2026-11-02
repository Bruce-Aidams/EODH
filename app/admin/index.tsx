import { useEffect, useState } from 'react';
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
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase/client';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBooks: 0,
    pdfDocs: 0,
    markdownDocs: 0,
    audiobooks: 0,
    totalReaders: 0,
    recentUploads: 0,
  });

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)');
      return;
    }
    fetchStats();
  }, [isAdmin]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch total books
      const { count: totalBooks } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true });

      // Fetch PDF count
      const { count: pdfDocs } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('document_type', 'pdf');

      // Fetch Markdown count
      const { count: markdownDocs } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('document_type', 'markdown');

      // Fetch audiobooks count (books with audio segments)
      const { count: audiobooks } = await supabase
        .from('audio_segments')
        .select('*', { count: 'exact', head: true });

      // Fetch total readers
      const { count: totalReaders } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'reader');

      // Fetch recent uploads (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentUploads } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      setStats({
        totalBooks: totalBooks || 0,
        pdfDocs: pdfDocs || 0,
        markdownDocs: markdownDocs || 0,
        audiobooks: audiobooks || 0,
        totalReaders: totalReaders || 0,
        recentUploads: recentUploads || 0,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
    setLoading(false);
  };

  const statsCards = [
    { label: 'Total Books', value: stats.totalBooks.toString(), icon: 'book' as const, color: COLORS.royalPurple },
    { label: 'PDF Docs', value: stats.pdfDocs.toString(), icon: 'document-text' as const, color: COLORS.violet },
    { label: 'Markdown', value: stats.markdownDocs.toString(), icon: 'code-slash' as const, color: COLORS.gold },
    { label: 'Audiobooks', value: stats.audiobooks.toString(), icon: 'headset' as const, color: COLORS.success },
    { label: 'Readers', value: stats.totalReaders.toString(), icon: 'people' as const, color: COLORS.deepNavy },
    { label: 'Recent Uploads', value: stats.recentUploads.toString(), icon: 'time' as const, color: COLORS.violet },
  ];

  const actions = [
    { label: 'Upload Books', description: 'Add PDF, Markdown, or audio files', icon: 'cloud-upload' as const, route: '/admin/upload' },
    { label: 'Manage Books', description: 'Edit, publish, or delete books', icon: 'list' as const, route: '/admin/books' },
    { label: 'Audio Management', description: 'Upload and organize audiobooks', icon: 'musical-notes' as const, route: '/admin/audio' },
    { label: 'Text Processing', description: 'Extract text and generate structure', icon: 'document' as const, route: '' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.royalPurple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={fetchStats}>
          <Ionicons name="refresh" size={22} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {statsCards.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                <Ionicons name={stat.icon} size={24} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionCard}
            onPress={() => {
              if (action.route) router.push(action.route as any);
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.royalPurple + '15' }]}>
              <Ionicons name={action.icon} size={24} color={COLORS.royalPurple} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
          </TouchableOpacity>
        ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  content: {
    padding: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
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
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  actionDescription: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
});

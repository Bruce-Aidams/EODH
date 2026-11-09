import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { Bookmark, Highlight, Note } from '@/types';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, SHADOWS, GRADIENTS, toGradientCSS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { useNetworkStatus } from '@/lib/network/useNetworkStatus';
import { useToast } from '@/lib/notifications/toast';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';

type NoteType = 'bookmark' | 'highlight' | 'note';

interface UnifiedNote {
  id: string;
  type: NoteType;
  book_id: string;
  book_title: string;
  book_author: string;
  content: string;
  text_excerpt?: string;
  color?: string;
  page_number?: number | null;
  created_at: string;
}

export default function NotesScreen() {
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const { showInfo } = useToast();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [allNotes, setAllNotes] = useState<UnifiedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<NoteType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [cachedNotes, setCachedNotes] = useState<UnifiedNote[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchAllNotes();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAllNotes();
    setIsRefreshing(false);
  }, []);

  // Show offline indicator when network is lost
  useEffect(() => {
    if (isOffline && cachedNotes.length > 0) {
      showInfo('You are offline — showing cached notes');
    }
  }, [isOffline]);

  const fetchAllNotes = async () => {
    // If offline, use cached notes
    if (isOffline) {
      if (cachedNotes.length > 0) {
        setAllNotes(cachedNotes);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const notes: UnifiedNote[] = [];

      // Fetch bookmarks with book details in a single query (fixes N+1)
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('*, books(title, author)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const bm of bookmarks || []) {
        const book = (bm as any).books;
        if (book) {
          notes.push({
            id: bm.id,
            type: 'bookmark',
            book_id: bm.book_id,
            book_title: book.title,
            book_author: book.author,
            content: bm.note || bm.text_excerpt || 'Bookmark',
            text_excerpt: bm.text_excerpt || undefined,
            page_number: bm.page_number,
            created_at: bm.created_at,
          });
        }
      }

      // Fetch highlights with book details in a single query (fixes N+1)
      const { data: highlights } = await supabase
        .from('highlights')
        .select('*, books(title, author)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const hl of highlights || []) {
        const book = (hl as any).books;
        if (book) {
          notes.push({
            id: hl.id,
            type: 'highlight',
            book_id: hl.book_id,
            book_title: book.title,
            book_author: book.author,
            content: hl.text,
            color: hl.color,
            page_number: hl.page_number,
            created_at: hl.created_at,
          });
        }
      }

      // Fetch notes with book details in a single query (fixes N+1)
      const { data: userNotes } = await supabase
        .from('notes')
        .select('*, books(title, author)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const n of userNotes || []) {
        const book = (n as any).books;
        if (book) {
          notes.push({
            id: n.id,
            type: 'note',
            book_id: n.book_id,
            book_title: book.title,
            book_author: book.author,
            content: n.content,
            page_number: n.page_number,
            created_at: n.created_at,
          });
        }
      }

      // Sort by date
      notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllNotes(notes);
      // Cache notes for offline access
      setCachedNotes(notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      // On error, try to use cached notes
      if (cachedNotes.length > 0) {
        setAllNotes(cachedNotes);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotes = allNotes.filter(note => {
    const matchesFilter = filter === 'all' || note.type === filter;
    const matchesSearch = searchQuery === '' || 
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.book_title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleDeleteNote = (note: UnifiedNote) => {
    Alert.alert(
      'Delete',
      `Delete this ${note.type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (note.type === 'bookmark') {
                await supabase.from('bookmarks').delete().eq('id', note.id);
              } else if (note.type === 'highlight') {
                await supabase.from('highlights').delete().eq('id', note.id);
              } else {
                await supabase.from('notes').delete().eq('id', note.id);
              }
              setAllNotes(prev => prev.filter(n => n.id !== note.id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Add as a general note (requires a book_id - use first book or prompt)
      if (allNotes.length === 0) {
        Alert.alert('No Books', 'Read a book first to add notes.');
        return;
      }

      await supabase.from('notes').insert({
        user_id: user.id,
        book_id: allNotes[0].book_id,
        content: newNoteText.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      setShowAddNote(false);
      setNewNoteText('');
      fetchAllNotes();
    } catch (error) {
      Alert.alert('Error', 'Failed to add note');
    }
  };

  const getNoteIcon = (type: NoteType) => {
    switch (type) {
      case 'bookmark': return 'bookmark';
      case 'highlight': return 'pencil';
      case 'note': return 'document-text';
    }
  };

  const getNoteColor = (type: NoteType) => {
    switch (type) {
      case 'bookmark': return colors.primary;
      case 'highlight': return colors.primary;
      case 'note': return colors.primary;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const counts = {
    all: allNotes.length,
    bookmark: allNotes.filter(n => n.type === 'bookmark').length,
    highlight: allNotes.filter(n => n.type === 'highlight').length,
    note: allNotes.filter(n => n.type === 'note').length,
  };

  const gradientColors = isDark ? GRADIENTS.dark : GRADIENTS.primary;


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Header */}
      <AnimatedView fadeDelay={50} fadeDuration={400} slideDirection="down" slideDistance={20}>
        <View style={[styles.gradientHeader, { backgroundImage: toGradientCSS(gradientColors), paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.headerContent}>
              <View style={{flex: 1}}>
                <Text style={styles.headerTitle} numberOfLines={1}>Bookmarks & Notes</Text>
                <Text style={styles.headerSubtitle}>{counts.all} items saved</Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddNote(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={32} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          </View>
      </AnimatedView>

      {/* Search Bar */}
      <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15} style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }, isDark && { backgroundColor: '#1a1f3a' }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notes..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </AnimatedView>

      {/* Filter Chips */}
      <AnimatedView fadeDelay={250} fadeDuration={400} slideDirection="up" slideDistance={15}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
        {(['all', 'bookmark', 'highlight', 'note'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface },
              filter === f && { backgroundColor: colors.primary }
            ]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            {filter === f && (
              <View style={[styles.filterChipGradient, { backgroundImage: toGradientCSS([colors.primary, colors.accent], 'horizontal') }]}>
                <Text style={styles.filterChipTextActive}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
                <View style={styles.countBadgeActive}>
                  <Text style={styles.countTextActive}>{counts[f]}</Text>
                </View>
              </View>
            )}
            {filter !== f && (
              <>
                <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.countText, { color: colors.textSecondary }]}>{counts[f]}</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        ))}
        </ScrollView>
      </AnimatedView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notes...</Text>
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {searchQuery ? 'No Results Found' : 'No Notes Yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {searchQuery 
              ? 'Try a different search term.'
              : 'Highlight text or add notes while reading to see them here.'
            }
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {filteredNotes.map((note, index) => (
            <AnimatedView
              key={note.id}
              fadeDelay={300 + index * 60}
              fadeDuration={350}
              slideDirection="up"
              slideDistance={20}
              pressScale={0.97}
              onPress={() => router.push(`/book/${note.book_id}`)}
              style={[styles.noteCard, { backgroundColor: colors.card, shadowColor: colors.cardShadow, borderRadius: BORDER_RADIUS.lg }]}
            >
              <View style={[styles.noteAccent, { backgroundColor: getNoteColor(note.type) }]}>
                <Ionicons name={getNoteIcon(note.type)} size={16} color="#FFFFFF" />
              </View>
              <View style={styles.noteContent}>
                <Text style={[styles.noteBookTitle, { color: colors.primary }]} numberOfLines={1}>{note.book_title}</Text>
                <Text style={[styles.noteContentText, { color: colors.text }]} numberOfLines={3}>{note.content}</Text>
                <View style={styles.noteMeta}>
                  <Text style={[styles.noteDate, { color: colors.textMuted }]}>{formatDate(note.created_at)}</Text>
                  {note.page_number && (
                    <Text style={[styles.notePage, { color: colors.textMuted }]}>Page {note.page_number}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteNote(note)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </AnimatedView>
          ))}
        </ScrollView>
      )}

      {/* Add Note Modal */}
      <Modal
        visible={showAddNote}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddNote(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Note</Text>
              <TouchableOpacity onPress={() => setShowAddNote(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.noteInput, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Write your note..."
              placeholderTextColor={colors.textMuted}
              value={newNoteText}
              onChangeText={setNewNoteText}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, !newNoteText.trim() && { backgroundColor: colors.textMuted }]}
              disabled={!newNoteText.trim()}
              onPress={handleAddNote}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  gradientOverlay: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  addButton: {
    padding: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterContent: {
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    ...SHADOWS.card,
  },
  filterChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  countBadgeActive: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
  },
  countTextActive: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  noteCard: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  noteAccent: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  noteContent: {
    flex: 1,
    padding: SPACING.md,
    paddingRight: SPACING.sm,
  },
  noteBookTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  noteContentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: SPACING.sm,
  },
  noteDate: {
    fontSize: 11,
  },
  notePage: {
    fontSize: 11,
  },
  deleteButton: {
    padding: SPACING.md,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  noteInput: {
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    fontSize: 15,
    minHeight: 120,
    marginBottom: SPACING.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

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
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { Bookmark, Highlight, Note } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { useNetworkStatus } from '@/lib/network/useNetworkStatus';
import { useToast } from '@/lib/notifications/toast';

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
  const [allNotes, setAllNotes] = useState<UnifiedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<NoteType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [cachedNotes, setCachedNotes] = useState<UnifiedNote[]>([]);

  useEffect(() => {
    fetchAllNotes();
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

      // Fetch bookmarks
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const bm of bookmarks || []) {
        const { data: book } = await supabase
          .from('books')
          .select('title, author')
          .eq('id', bm.book_id)
          .single();

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

      // Fetch highlights
      const { data: highlights } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const hl of highlights || []) {
        const { data: book } = await supabase
          .from('books')
          .select('title, author')
          .eq('id', hl.book_id)
          .single();

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

      // Fetch notes
      const { data: userNotes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      for (const n of userNotes || []) {
        const { data: book } = await supabase
          .from('books')
          .select('title, author')
          .eq('id', n.book_id)
          .single();

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
      case 'bookmark': return COLORS.gold;
      case 'highlight': return COLORS.violet;
      case 'note': return COLORS.royalPurple;
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddNote(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor={COLORS.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'bookmark', 'highlight', 'note'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            <View style={[styles.countBadge, filter === f && styles.countBadgeActive]}>
              <Text style={[styles.countText, filter === f && styles.countTextActive]}>
                {counts[f]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No Results Found' : 'No Notes Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? 'Try a different search term.'
              : 'Highlight text or add notes while reading to see them here.'
            }
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {filteredNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={[styles.noteAccent, { backgroundColor: getNoteColor(note.type) }]}>
                <Ionicons name={getNoteIcon(note.type)} size={16} color={COLORS.white} />
              </View>
              <TouchableOpacity
                style={styles.noteContent}
                onPress={() => router.push(`/book/${note.book_id}`)}
              >
                <Text style={styles.noteBookTitle} numberOfLines={1}>{note.book_title}</Text>
                <Text style={styles.noteContentText} numberOfLines={3}>{note.content}</Text>
                <View style={styles.noteMeta}>
                  <Text style={styles.noteDate}>{formatDate(note.created_at)}</Text>
                  {note.page_number && (
                    <Text style={styles.notePage}>Page {note.page_number}</Text>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteNote(note)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.gray400} />
              </TouchableOpacity>
            </View>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Note</Text>
              <TouchableOpacity onPress={() => setShowAddNote(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Write your note..."
              placeholderTextColor={COLORS.gray400}
              value={newNoteText}
              onChangeText={setNewNoteText}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, !newNoteText.trim() && styles.saveButtonDisabled]}
              disabled={!newNoteText.trim()}
              onPress={handleAddNote}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Save Note</Text>
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
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  addButton: {
    padding: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.deepNavy,
    paddingVertical: 0,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: COLORS.royalPurple,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  countBadge: {
    backgroundColor: COLORS.gray200,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: COLORS.white + '40',
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  countTextActive: {
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
  noteCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: COLORS.royalPurple,
    marginBottom: 4,
  },
  noteContentText: {
    fontSize: 14,
    color: COLORS.deepNavy,
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
    color: COLORS.gray400,
  },
  notePage: {
    fontSize: 11,
    color: COLORS.gray400,
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
    backgroundColor: COLORS.white,
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
    color: COLORS.deepNavy,
  },
  noteInput: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.deepNavy,
    minHeight: 120,
    marginBottom: SPACING.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.royalPurple,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.gray300,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

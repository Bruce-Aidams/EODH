import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '@/stores/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { syncEngine } from '@/lib/sync/engine';

interface AudioChapter {
  id: string;
  chapter_id: string;
  title: string;
  audio_file_url: string | null;
  duration: number | null;
  order_index: number;
  has_transcript: boolean;
  has_sync_file: boolean;
}

interface AudioBook {
  id: string;
  book_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  chapters: AudioChapter[];
}

export default function AdminAudioScreen() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const [audioBooks, setAudioBooks] = useState<AudioBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<AudioBook | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chapterTitle, setChapterTitle] = useState('');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptFileUri, setTranscriptFileUri] = useState<string | null>(null);
  const [transcriptFileName, setTranscriptFileName] = useState('');
  const [transcriptChapterId, setTranscriptChapterId] = useState<string>('');
  const [uploadingTranscript, setUploadingTranscript] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/more');
      return;
    }
    fetchAudioBooks();
  }, [isAdmin]);

  const fetchAudioBooks = async () => {
    setIsLoading(true);
    try {
      // Fetch books that have audiobooks
      const { data: audioBooksData, error } = await supabase
        .from('audio_books')
        .select('id, book_id, books(id, title, author, cover_url)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const books: AudioBook[] = [];
      for (const ab of audioBooksData || []) {
        const bookInfo = ab.books;
        if (!bookInfo) continue;

        // Fetch chapters for this audiobook
        const { data: chapters } = await supabase
          .from('audio_segments')
          .select('*')
          .eq('audio_book_id', ab.id)
          .order('order_index', { ascending: true });

        // Check for transcripts and sync files
        const chaptersWithMeta: AudioChapter[] = (chapters || []).map(ch => ({
          id: ch.id,
          chapter_id: ch.chapter_id || '',
          title: ch.title || `Chapter ${ch.order_index + 1}`,
          audio_file_url: ch.audio_file_url,
          duration: ch.duration,
          order_index: ch.order_index,
          has_transcript: !!ch.transcript,
          has_sync_file: !!ch.sync_file_url,
        }));

        books.push({
          id: ab.id,
          book_id: ab.book_id,
          title: bookInfo.title,
          author: bookInfo.author,
          cover_url: bookInfo.cover_url,
          chapters: chaptersWithMeta,
        });
      }

      setAudioBooks(books);
    } catch (error) {
      console.error('Error fetching audio books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedFileUri(result.assets[0].uri);
        setSelectedFileName(result.assets[0].name || 'Unknown file');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const handleUploadChapter = async () => {
    if (!selectedBook || !selectedFileUri || !chapterTitle.trim()) {
      Alert.alert('Missing Info', 'Please select a book, enter a chapter title, and pick an audio file.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fileUri = selectedFileUri;
      const fileName = `audiobooks/${selectedBook.id}/${Date.now()}-${selectedFileName}`;

      // Upload file to Supabase Storage
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audiobooks')
        .upload(fileName, fileBase64, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audiobooks')
        .getPublicUrl(fileName);

      // Insert audio segment
      const nextOrder = selectedBook.chapters.length;
      const { error: insertError } = await supabase.from('audio_segments').insert({
        audio_book_id: selectedBook.id,
        chapter_id: `chapter-${nextOrder + 1}`,
        title: chapterTitle.trim(),
        audio_file_url: publicUrl,
        order_index: nextOrder,
        duration: null,
        transcript: null,
        sync_file_url: null,
      });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Chapter uploaded successfully!');
      setShowUploadModal(false);
      setSelectedFileUri(null);
      setSelectedFileName('');
      setChapterTitle('');
      fetchAudioBooks();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload audio file. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteChapter = (bookId: string, chapterId: string) => {
    Alert.alert(
      'Delete Chapter',
      'Are you sure you want to delete this chapter? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('audio_segments').delete().eq('id', chapterId);
              fetchAudioBooks();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chapter');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const pickTranscriptFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const name = result.assets[0].name || '';
        if (!name.toLowerCase().endsWith('.srt') && !name.toLowerCase().endsWith('.vtt')) {
          Alert.alert('Invalid File', 'Please select an SRT or WebVTT file.');
          return;
        }
        setTranscriptFileUri(result.assets[0].uri);
        setTranscriptFileName(name);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick transcript file');
    }
  };

  const handleUploadTranscript = async () => {
    if (!transcriptFileUri || !transcriptChapterId) {
      Alert.alert('Missing Info', 'Please select a chapter and pick a transcript file.');
      return;
    }

    setUploadingTranscript(true);

    try {
      // Read the transcript file content
      const content = await FileSystem.readAsStringAsync(transcriptFileUri);
      const fileName = transcriptFileName.toLowerCase();

      // Parse the transcript into alignments
      let alignments;
      if (fileName.endsWith('.srt')) {
        alignments = syncEngine.parseSRT(content, transcriptChapterId);
      } else if (fileName.endsWith('.vtt')) {
        alignments = syncEngine.parseWebVTT(content, transcriptChapterId);
      } else {
        throw new Error('Unsupported file format');
      }

      if (alignments.length === 0) {
        Alert.alert('No Data', 'No alignment data found in the file. Please check the format.');
        setUploadingTranscript(false);
        return;
      }

      // Upload the file to Supabase Storage
      const fileBase64 = await FileSystem.readAsStringAsync(transcriptFileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const storagePath = `transcripts/${transcriptChapterId}/${transcriptFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('audiobooks')
        .upload(storagePath, fileBase64, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audiobooks')
        .getPublicUrl(storagePath);

      // Update the audio segment with the sync file URL
      const { error: updateError } = await supabase
        .from('audio_segments')
        .update({ sync_file_url: publicUrl })
        .eq('chapter_id', transcriptChapterId);

      if (updateError) throw updateError;

      // Insert alignments into the database
      for (const alignment of alignments) {
        const { error: insertError } = await supabase
          .from('audio_alignments')
          .insert(alignment);

        if (insertError) {
          console.error('Error inserting alignment:', insertError);
        }
      }

      Alert.alert('Success', `Transcript uploaded! ${alignments.length} alignments created.`);
      setShowTranscriptModal(false);
      setTranscriptFileUri(null);
      setTranscriptFileName('');
      setTranscriptChapterId('');
      fetchAudioBooks();
    } catch (error) {
      console.error('Transcript upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload transcript file. Please try again.');
    } finally {
      setUploadingTranscript(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={styles.loadingText}>Loading audio library...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (audioBooks.length === 0) {
                Alert.alert('No Books', 'Upload a book first before adding audio chapters.');
              } else {
                setSelectedBook(audioBooks[0]);
                setShowTranscriptModal(true);
              }
            }}
          >
            <Ionicons name="document-text" size={24} color={COLORS.violet} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (audioBooks.length === 0) {
                Alert.alert('No Books', 'Upload a book first before adding audio chapters.');
              } else {
                setSelectedBook(audioBooks[0]);
                setShowUploadModal(true);
              }
            }}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.royalPurple} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {audioBooks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="headset-outline" size={64} color={COLORS.gray300} />
            <Text style={styles.emptyTitle}>No Audiobooks Yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload a book first, then add audio chapters here.
            </Text>
          </View>
        ) : (
          audioBooks.map((book) => (
            <View key={book.id} style={styles.bookCard}>
              <TouchableOpacity
                style={styles.bookHeader}
                onPress={() => {
                  const collapsed = selectedBook?.id === book.id;
                  setSelectedBook(collapsed ? null : book);
                }}
              >
                <View style={styles.bookIcon}>
                  <Ionicons name="musical-notes" size={24} color={COLORS.white} />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
                  <Text style={styles.chapterCount}>
                    {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name={selectedBook?.id === book.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.gray400}
                />
              </TouchableOpacity>

              {selectedBook?.id === book.id && (
                <>
                  {/* Chapter List */}
                  {book.chapters.map((chapter) => (
                    <View key={chapter.id} style={styles.chapterRow}>
                      <View style={styles.chapterInfo}>
                        <Ionicons name="play-circle-outline" size={20} color={COLORS.royalPurple} />
                        <View style={styles.chapterText}>
                          <Text style={styles.chapterTitle}>{chapter.title}</Text>
                          <View style={styles.chapterMeta}>
                            <Text style={styles.chapterDuration}>
                              {formatDuration(chapter.duration)}
                            </Text>
                            {chapter.has_transcript && (
                              <View style={styles.badge}>
                                <Text style={styles.badgeText}>SRT</Text>
                              </View>
                            )}
                            {chapter.has_sync_file && (
                              <View style={[styles.badge, styles.syncBadge]}>
                                <Text style={styles.badgeText}>SYNC</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteChapter(book.id, chapter.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add Chapter Button */}
                  <TouchableOpacity
                    style={styles.addChapterButton}
                    onPress={() => {
                      setSelectedBook(book);
                      setShowUploadModal(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.royalPurple} />
                    <Text style={styles.addChapterText}>Add Chapter</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Audio Chapter</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <Text style={styles.modalBookName}>
                Book: {selectedBook.title}
              </Text>
            )}

            {/* Chapter Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Chapter Title</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="pencil-outline" size={20} color={COLORS.gray400} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter chapter title"
                  value={chapterTitle}
                  onChangeText={setChapterTitle}
                  placeholderTextColor={COLORS.gray400}
                />
              </View>
            </View>

            {/* File Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Audio File</Text>
              <TouchableOpacity style={styles.filePicker} onPress={pickAudioFile}>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.royalPurple} />
                <View style={styles.filePickerText}>
                  <Text style={styles.filePickerLabel}>
                    {selectedFileName || 'Select audio file'}
                  </Text>
                  <Text style={styles.filePickerHint}>MP3, WAV, M4A, AAC, OGG</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Upload Button */}
            <TouchableOpacity
              style={[styles.uploadButton, (!selectedFileUri || !chapterTitle.trim()) && styles.uploadButtonDisabled]}
              disabled={uploading || !selectedFileUri || !chapterTitle.trim()}
              onPress={handleUploadChapter}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
                  <Text style={styles.uploadButtonText}>Upload Chapter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transcript Upload Modal */}
      <Modal
        visible={showTranscriptModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTranscriptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Transcript / Sync File</Text>
              <TouchableOpacity onPress={() => setShowTranscriptModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Upload an SRT or WebVTT file to enable synchronized reading for this audiobook.
              The transcript provides timing data that highlights text as audio plays.
            </Text>

            {/* Chapter Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Chapter</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="list-outline" size={20} color={COLORS.gray400} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {audioBooks.map((book) =>
                    book.chapters.map((chapter) => (
                      <TouchableOpacity
                        key={chapter.id}
                        style={[
                          styles.chip,
                          transcriptChapterId === chapter.chapter_id && styles.chipActive,
                        ]}
                        onPress={() => {
                          setSelectedBook(book);
                          setTranscriptChapterId(chapter.chapter_id);
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            transcriptChapterId === chapter.chapter_id && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {chapter.title}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>

            {/* File Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Transcript File (SRT / WebVTT)</Text>
              <TouchableOpacity style={styles.filePicker} onPress={pickTranscriptFile}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.violet} />
                <View style={styles.filePickerText}>
                  <Text style={styles.filePickerLabel}>
                    {transcriptFileName || 'Select transcript file'}
                  </Text>
                  <Text style={styles.filePickerHint}>SRT or WebVTT subtitle files</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Upload Button */}
            <TouchableOpacity
              style={[
                styles.uploadButton,
                !transcriptFileUri || !transcriptChapterId ? styles.uploadButtonDisabled : null,
              ]}
              disabled={uploadingTranscript || !transcriptFileUri || !transcriptChapterId}
              onPress={handleUploadTranscript}
            >
              {uploadingTranscript ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="document" size={20} color={COLORS.white} />
                  <Text style={styles.uploadButtonText}>Upload Transcript</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { TextInput } from 'react-native';

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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  addButton: {
    padding: SPACING.xs,
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
    minHeight: 300,
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
  bookCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  bookIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  bookAuthor: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  chapterCount: {
    fontSize: 12,
    color: COLORS.royalPurple,
    marginTop: 2,
    fontWeight: '500',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  chapterInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  chapterTitle: {
    fontSize: 14,
    color: COLORS.deepNavy,
    fontWeight: '500',
  },
  chapterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: SPACING.xs,
  },
  chapterDuration: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  badge: {
    backgroundColor: COLORS.violet + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  syncBadge: {
    backgroundColor: COLORS.gold + '30',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.royalPurple,
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  addChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    gap: SPACING.xs,
  },
  addChapterText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.royalPurple,
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
    maxHeight: '80%',
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
  modalBookName: {
    fontSize: 14,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
    fontStyle: 'italic',
  },
  modalDescription: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  chip: {
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  chipActive: {
    backgroundColor: COLORS.royalPurple + '20',
    borderColor: COLORS.royalPurple,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  chipTextActive: {
    color: COLORS.royalPurple,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.deepNavy,
    marginLeft: SPACING.sm,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    gap: SPACING.md,
  },
  filePickerText: {
    flex: 1,
  },
  filePickerLabel: {
    fontSize: 15,
    color: selectedFileName => COLORS.deepNavy,
    fontWeight: '500',
  },
  filePickerHint: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.royalPurple,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.gray300,
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase/client';
import { processDocument, ProcessingProgress } from '@/lib/admin/textProcessing';
import { useToast } from '@/lib/notifications/toast';
import { useTheme } from '@/lib/theme/ThemeContext';
import { SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminUploadScreen() {
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('en');
  const [publicationDate, setPublicationDate] = useState('');
  const [documentType, setDocumentType] = useState<'pdf' | 'markdown' | 'epub' | 'docx'>('pdf');

  // File state
  const [documentFile, setDocumentFile] = useState<any>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<any>(null);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load categories
  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('book_categories')
        .select('*')
        .order('name', { ascending: true });
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Pick document file
  const pickDocument = async () => {
    try {
      const mimeTypes: Record<string, string | string[]> = {
        pdf: 'application/pdf',
        markdown: ['text/markdown', 'text/x-markdown', '.md', '.markdown'],
        epub: 'application/epub+zip',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[documentType] || ['application/pdf', 'application/epub+zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setDocumentFile(result.assets[0]);
      }
    } catch (error) {
      showError('Failed to pick document file.');
    }
  };

  // Pick cover image
  const pickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      showError('Failed to pick cover image.');
    }
  };

  // Pick audio file
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'application/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setAudioFile(result.assets[0]);
      }
    } catch (error) {
      showError('Failed to pick audio file.');
    }
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!title.trim()) return 'Please enter a book title.';
    if (!author.trim()) return 'Please enter the author name.';
    if (!documentFile) return 'Please select a document file (PDF, EPUB, DOCX, or Markdown).';
    return null;
  };

  // Upload file to Supabase Storage
  const uploadFile = async (
    bucket: string,
    fileUri: string,
    fileName: string,
    fileType: string
  ): Promise<string | null> => {
    try {
      const filePath = `${Date.now()}-${fileName}`;
      
      // Read file as base64
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, uint8Array, {
          contentType: fileType,
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`Upload error (${bucket}):`, error);
      return null;
    }
  };

  // Handle upload
  const handleUpload = async () => {
    const error = validateForm();
    if (error) {
      showWarning(error);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload cover image
      let coverUrl = null;
      if (coverImage) {
        setUploadProgress(10);
        coverUrl = await uploadFile('covers', coverImage, 'cover.jpg', 'image/jpeg');
        setUploadProgress(25);
      }

      // Upload document to format-specific subdirectory
      setUploadProgress(30);
      const documentMimeType = documentFile!.mimeType || 
        (documentType === 'pdf' ? 'application/pdf' :
         documentType === 'epub' ? 'application/epub+zip' :
         documentType === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
         'text/markdown');
      const documentUrl = await uploadFile(
        'documents',
        documentFile!.uri,
        `${documentType}/${documentFile!.name}`,
        documentMimeType
      );
      setUploadProgress(60);

      if (!documentUrl) {
        throw new Error('Failed to upload document.');
      }

      // Create book record first (needed for audio_books foreign key)
      setUploadProgress(60);
      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          title: title.trim(),
          author: author.trim(),
          description: description.trim() || null,
          category_id: category || null,
          cover_url: coverUrl,
          document_url: documentUrl,
          document_type: documentType,
          file_size: (documentFile as any)?.size || 0,
          language: language,
          publication_date: publicationDate || null,
          is_published: true,
          has_audio: false,
          audio_type: null,
          processing_status: 'pending',
          content_format: 'reflow',
        })
        .select()
        .single();

      if (bookError) throw bookError;

      // Upload audio if available (after book creation so we have the UUID)
      let hasAudio = false;
      let audioType: 'tts' | 'prerecorded' | null = null;
      if (audioFile) {
        setUploadProgress(65);
        const audioUrl = await uploadFile(
          'audiobooks',
          audioFile.uri,
          audioFile.name,
          audioFile.mimeType || 'audio/mpeg'
        );
        setUploadProgress(80);

        if (audioUrl) {
          hasAudio = true;
          audioType = 'prerecorded';

          // Create audio book record with the real book UUID
          await supabase.from('audio_books').insert({
            book_id: book.id,
            audio_url: audioUrl,
            audio_type: 'prerecorded',
            is_active: true,
          });

          // Update book with audio info
          await supabase
            .from('books')
            .update({ has_audio: true, audio_type: 'prerecorded' })
            .eq('id', book.id);
        }
      }

      setUploadProgress(100);

      showSuccess('Book uploaded successfully!');
      
      // Process document for TTS and sync readiness
      await processUploadedBook(book);
    } catch (error: any) {
      showError(error?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setProcessing(false);
      setProcessingStage('');
    }
  };

  // Process a newly uploaded book
  const processUploadedBook = async (book: any) => {
    setProcessing(true);
    setProcessingStage('Processing document for TTS and sync...');

    try {
      const result = await processDocument(book, (progress: ProcessingProgress) => {
        setProcessingStage(progress.message);
      });

      // If EPUB processing extracted a cover image and no cover was manually uploaded, upload it
      if (result.coverImageBase64 && !coverImage) {
        try {
          setProcessingStage('Uploading extracted cover image...');
          const coverExtension = result.coverMimeType === 'image/png' ? 'png' : 'jpg';
          const coverFilePath = `${Date.now()}-cover.${coverExtension}`;

          // Convert base64 to Uint8Array for upload
          const binaryString = atob(result.coverImageBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('covers')
            .upload(coverFilePath, bytes, {
              contentType: result.coverMimeType || 'image/jpeg',
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from('covers')
              .getPublicUrl(uploadData.path);

            if (urlData.publicUrl) {
              // Update the book with the extracted cover URL
              await supabase
                .from('books')
                .update({ cover_url: urlData.publicUrl })
                .eq('id', book.id);

              console.log('EPUB cover image uploaded and attached to book');
            }
          }
        } catch (coverErr) {
          console.error('Failed to upload extracted cover:', coverErr);
        }
      }

      if (result.success) {
        showSuccess(`Document processed: ${result.chaptersCreated} chapters, ${result.segmentsCreated} segments created.`);
      } else if (result.needsOcr) {
        showWarning('Document appears to be scanned images. OCR is required for text extraction.');
      } else {
        showWarning(`Processing completed with issues: ${result.error}`);
      }

      // Give user time to see the toast, then navigate
      setTimeout(() => {
        Alert.alert(
          'Success',
          'Book uploaded and processed!',
          [
            {
              text: 'View Book',
              onPress: () => router.push(`/book/${book.id}`),
            },
            {
              text: 'Upload Another',
              onPress: () => resetForm(),
            },
            {
              text: 'Back to Dashboard',
              onPress: () => router.back(),
            },
          ]
        );
      }, 500);
    } catch (err: any) {
      showWarning(`Document processing failed: ${err?.message || 'Unknown error'}`);
      // Still allow navigation even if processing fails
      setTimeout(() => {
        Alert.alert(
          'Upload Complete',
          'Book uploaded, but document processing encountered an issue.',
          [
            {
              text: 'View Book',
              onPress: () => router.push(`/book/${book.id}`),
            },
            {
              text: 'Back to Dashboard',
              onPress: () => router.back(),
            },
          ]
        );
      }, 500);
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  // Reset form
  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setDescription('');
    setCategory('');
    setLanguage('en');
    setPublicationDate('');
    setDocumentType('pdf');
    setDocumentFile(null);
    setCoverImage(null);
    setAudioFile(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Upload Book</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl + 20 }]} showsVerticalScrollIndicator={false}>
        {/* Document Type */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Document Type</Text>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[styles.typeButtonSmall, { borderColor: colors.border }, documentType === 'pdf' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setDocumentType('pdf'); setDocumentFile(null); }}
            >
              <Ionicons name="document-text" size={20} color={documentType === 'pdf' ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.typeButtonTextSmall, { color: colors.textSecondary }, documentType === 'pdf' && { color: '#FFFFFF' }]}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButtonSmall, { borderColor: colors.border }, documentType === 'epub' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setDocumentType('epub'); setDocumentFile(null); }}
            >
              <Ionicons name="book" size={20} color={documentType === 'epub' ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.typeButtonTextSmall, { color: colors.textSecondary }, documentType === 'epub' && { color: '#FFFFFF' }]}>EPUB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButtonSmall, { borderColor: colors.border }, documentType === 'docx' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setDocumentType('docx'); setDocumentFile(null); }}
            >
              <Ionicons name="document" size={20} color={documentType === 'docx' ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.typeButtonTextSmall, { color: colors.textSecondary }, documentType === 'docx' && { color: '#FFFFFF' }]}>DOCX</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButtonSmall, { borderColor: colors.border }, documentType === 'markdown' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setDocumentType('markdown'); setDocumentFile(null); }}
            >
              <Ionicons name="code-slash" size={20} color={documentType === 'markdown' ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.typeButtonTextSmall, { color: colors.textSecondary }, documentType === 'markdown' && { color: '#FFFFFF' }]}>MD</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Book Information */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Book Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter book title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Author *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter author name"
              placeholderTextColor={colors.textMuted}
              value={author}
              onChangeText={setAuthor}
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter book description"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCategoryModal(true)}
              disabled={uploading}
            >
              <Text style={[category ? styles.selectText : styles.selectPlaceholder, { color: category ? colors.text : colors.textMuted }]}>
                {categories.find(c => c.id === category)?.name || 'Select a category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>Language</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="en"
                placeholderTextColor={colors.textMuted}
                value={language}
                onChangeText={setLanguage}
                editable={!uploading}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>Publication Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={publicationDate}
                onChangeText={setPublicationDate}
                editable={!uploading}
              />
            </View>
          </View>
        </View>

        {/* Files */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Files</Text>

          {/* Cover Image */}
          <TouchableOpacity
            style={[styles.filePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickCoverImage}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={24} color={colors.primary} />
            <View style={styles.filePickerInfo}>
              <Text style={[styles.filePickerTitle, { color: colors.text }]}>Cover Image</Text>
              <Text style={[styles.filePickerSubtitle, { color: colors.textSecondary }]}>
                {coverImage ? 'Image selected' : 'Optional: Select a cover image'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Document */}
          <TouchableOpacity
            style={[styles.filePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickDocument}
            disabled={uploading}
          >
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <View style={styles.filePickerInfo}>
              <Text style={[styles.filePickerTitle, { color: colors.text }]}>Document File *</Text>
              <Text style={[styles.filePickerSubtitle, { color: colors.textSecondary }]}>
                {documentFile?.name || `Select a ${documentType.toUpperCase()} file`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Audio */}
          <TouchableOpacity
            style={[styles.filePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickAudio}
            disabled={uploading}
          >
            <Ionicons name="musical-notes-outline" size={24} color={colors.primary} />
            <View style={styles.filePickerInfo}>
              <Text style={[styles.filePickerTitle, { color: colors.text }]}>Audio File</Text>
              <Text style={[styles.filePickerSubtitle, { color: colors.textSecondary }]}>
                {audioFile?.name || 'Optional: Upload prerecorded audio'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={[styles.progressContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Processing Progress */}
        {processing && (
          <View style={[styles.progressContainer, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: SPACING.sm }} />
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{processingStage}</Text>
          </View>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: colors.primary }, uploading && { backgroundColor: colors.primary + '80' }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload Book</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Bottom spacing */}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                     setCategory(cat.id);
                     setShowCategoryModal(false);
                   }}
                >
                  <Text style={[styles.categoryText, { color: colors.text }]}>{cat.name}</Text>
                  {category === cat.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              {categories.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No categories available.</Text>
              )}
            </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: SPACING.md,
  },
  section: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    gap: SPACING.sm,
  },
  typeButtonSmall: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    gap: SPACING.xs,
  },
  typeButtonActive: {
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  typeButtonTextSmall: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    paddingTop: SPACING.sm,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 15,
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 15,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  filePickerInfo: {
    flex: 1,
  },
  filePickerTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  filePickerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  progressContainer: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  categoryText: {
    fontSize: 15,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});

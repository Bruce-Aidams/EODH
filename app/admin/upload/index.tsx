import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
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
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminUploadScreen() {
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useToast();
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
  const [documentType, setDocumentType] = useState<'pdf' | 'markdown'>('pdf');

  // File state
  const [documentFile, setDocumentFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);

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
      const result = await DocumentPicker.getDocumentAsync({
        type: documentType === 'pdf' ? 'application/pdf' : ['text/markdown', 'text/x-markdown', '.md', '.markdown'],
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
    if (!documentFile) return 'Please select a document file (PDF or Markdown).';
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

      // Upload document
      setUploadProgress(30);
      const documentUrl = await uploadFile(
        'documents',
        documentFile!.assets![0].uri,
        documentFile!.assets![0].name,
        documentFile!.assets![0].mimeType || 
          (documentType === 'pdf' ? 'application/pdf' : 'text/markdown')
      );
      setUploadProgress(60);

      if (!documentUrl) {
        throw new Error('Failed to upload document.');
      }

      // Upload audio if available
      let hasAudio = false;
      let audioType: 'tts' | 'prerecorded' | null = null;
      if (audioFile) {
        setUploadProgress(65);
        const audioUrl = await uploadFile(
          'audiobooks',
          audioFile.assets![0].uri,
          audioFile.assets![0].name,
          audioFile.assets![0].mimeType || 'audio/mpeg'
        );
        setUploadProgress(80);
        
        if (audioUrl) {
          hasAudio = true;
          audioType = 'prerecorded';
          
          // Create audio book record
          await supabase.from('audio_books').insert({
            book_id: 'temp', // Will update after book creation
            audio_url: audioUrl,
            audio_type: 'prerecorded',
            is_active: true,
          });
        }
      }

      // Create book record
      setUploadProgress(85);
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
          file_size: documentFile.assets![0].size,
          language: language,
          publication_date: publicationDate || null,
          is_published: false,
          has_audio: hasAudio,
          audio_type: audioType,
        })
        .select()
        .single();

      if (bookError) throw bookError;

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Book</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Document Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, documentType === 'pdf' && styles.typeButtonActive]}
              onPress={() => setDocumentType('pdf')}
            >
              <Ionicons
                name="document-text"
                size={24}
                color={documentType === 'pdf' ? COLORS.white : COLORS.royalPurple}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  documentType === 'pdf' && styles.typeButtonTextActive,
                ]}
              >
                PDF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, documentType === 'markdown' && styles.typeButtonActive]}
              onPress={() => setDocumentType('markdown')}
            >
              <Ionicons
                name="code-slash"
                size={24}
                color={documentType === 'markdown' ? COLORS.white : COLORS.royalPurple}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  documentType === 'markdown' && styles.typeButtonTextActive,
                ]}
              >
                Markdown
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Book Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter book title"
              value={title}
              onChangeText={setTitle}
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Author *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter author name"
              value={author}
              onChangeText={setAuthor}
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter book description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!uploading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput]}
              onPress={() => setShowCategoryModal(true)}
              disabled={uploading}
            >
              <Text style={category ? styles.selectText : styles.selectPlaceholder}>
                {category || 'Select a category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.gray400} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Language</Text>
              <TextInput
                style={styles.input}
                placeholder="en"
                value={language}
                onChangeText={setLanguage}
                editable={!uploading}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Publication Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={publicationDate}
                onChangeText={setPublicationDate}
                editable={!uploading}
              />
            </View>
          </View>
        </View>

        {/* Files */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Files</Text>

          {/* Cover Image */}
          <TouchableOpacity
            style={styles.filePicker}
            onPress={pickCoverImage}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={24} color={COLORS.royalPurple} />
            <View style={styles.filePickerInfo}>
              <Text style={styles.filePickerTitle}>Cover Image</Text>
              <Text style={styles.filePickerSubtitle}>
                {coverImage ? 'Image selected' : 'Optional: Select a cover image'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
          </TouchableOpacity>

          {/* Document */}
          <TouchableOpacity
            style={styles.filePicker}
            onPress={pickDocument}
            disabled={uploading}
          >
            <Ionicons name="document-text-outline" size={24} color={COLORS.royalPurple} />
            <View style={styles.filePickerInfo}>
              <Text style={styles.filePickerTitle}>Document File *</Text>
              <Text style={styles.filePickerSubtitle}>
                {documentFile?.assets?.[0]?.name || `Select a ${documentType.toUpperCase()} file`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
          </TouchableOpacity>

          {/* Audio */}
          <TouchableOpacity
            style={styles.filePicker}
            onPress={pickAudio}
            disabled={uploading}
          >
            <Ionicons name="musical-notes-outline" size={24} color={COLORS.royalPurple} />
            <View style={styles.filePickerInfo}>
              <Text style={styles.filePickerTitle}>Audio File</Text>
              <Text style={styles.filePickerSubtitle}>
                {audioFile?.assets?.[0]?.name || 'Optional: Upload prerecorded audio'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Processing Progress */}
        {processing && (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color={COLORS.royalPurple} style={{ marginBottom: SPACING.sm }} />
            <Text style={styles.progressText}>{processingStage}</Text>
          </View>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.deepNavy} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryItem}
                  onPress={() => {
                    setCategory(cat.name);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.categoryText}>{cat.name}</Text>
                  {category === cat.name && (
                    <Ionicons name="checkmark" size={20} color={COLORS.royalPurple} />
                  )}
                </TouchableOpacity>
              ))}
              {categories.length === 0 && (
                <Text style={styles.emptyText}>No categories available.</Text>
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
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.deepNavy,
    textAlign: 'center',
  },
  content: {
    padding: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    gap: SPACING.sm,
  },
  typeButtonActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.royalPurple,
  },
  typeButtonTextActive: {
    color: COLORS.white,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.deepNavy,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.deepNavy,
    borderWidth: 1,
    borderColor: COLORS.gray200,
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
    color: COLORS.deepNavy,
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 15,
    color: COLORS.gray400,
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
    borderBottomColor: COLORS.gray100,
    gap: SPACING.md,
  },
  filePickerInfo: {
    flex: 1,
  },
  filePickerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.deepNavy,
  },
  filePickerSubtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  progressContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.royalPurple,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.deepNavy,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.royalPurple,
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
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
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
    color: COLORS.deepNavy,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  categoryText: {
    fontSize: 15,
    color: COLORS.deepNavy,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});

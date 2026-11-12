import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, BORDER_RADIUS, COLORS } from '@/constants/theme';
import {
  getCustomVoices,
  uploadCustomVoice,
  deleteCustomVoice,
  setDefaultVoice,
  getDefaultVoice,
} from '@/lib/voice/customVoices';
import { CustomVoice } from '@/types';

export default function VoiceSelectionScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [voices, setVoices] = useState<CustomVoice[]>([]);
  const [defaultVoice, setDefaultVoiceState] = useState<CustomVoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [voiceName, setVoiceName] = useState('');

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const [customVoices, defaultV] = await Promise.all([
        getCustomVoices(),
        getDefaultVoice(),
      ]);
      setVoices(customVoices);
      setDefaultVoiceState(defaultV);
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setVoiceName(asset.name.replace(/\.[^./]+$/, ''));
      setShowUploadModal(true);
      
      // Store the asset for upload
      (handleUploadVoice as any)._pendingAsset = asset;
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const handleUploadVoice = async () => {
    if (!voiceName.trim()) {
      Alert.alert('Error', 'Please enter a name for this voice');
      return;
    }

    const asset = (handleUploadVoice as any)._pendingAsset;
    if (!asset) {
      Alert.alert('Error', 'No audio file selected');
      return;
    }

    setUploading(true);
    try {
      await uploadCustomVoice(
        {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'audio/mpeg',
        },
        voiceName.trim()
      );

      setShowUploadModal(false);
      setVoiceName('');
      await loadVoices();
      Alert.alert('Success', 'Voice uploaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload voice');
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (voice: CustomVoice) => {
    try {
      await setDefaultVoice(voice.id);
      await loadVoices();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set default voice');
    }
  };

  const handleDeleteVoice = (voice: CustomVoice) => {
    Alert.alert(
      'Delete Voice',
      `Are you sure you want to delete "${voice.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomVoice(voice.id);
              await loadVoices();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete voice');
            }
          },
        },
      ]
    );
  };

  const handlePlayPreview = async (voice: CustomVoice) => {
    // Navigate to the reader to play the voice preview
    // The voice audio URL will be played when the reader loads
    Alert.alert(
      'Play Preview',
      `This will play "${voice.name}" in the audio player.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Narrator Voice</Text>
        <TouchableOpacity style={styles.addButton} onPress={handlePickAudioFile}>
          <Ionicons name="add" size={24} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}>
        {/* System Default Voice */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>System Voices</Text>
          <Text style={styles.sectionSubtitle}>
            Use built-in device text-to-speech
          </Text>
          <TouchableOpacity
            style={[styles.voiceCard, defaultVoice === null && styles.voiceCardActive]}
            onPress={() => {
              // Reset to system default
              setDefaultVoiceState(null);
            }}
          >
            <View style={styles.voiceIcon}>
              <Ionicons name="volume-high" size={24} color={COLORS.royalPurple} />
            </View>
            <View style={styles.voiceInfo}>
              <Text style={[styles.voiceName, { color: colors.text }]}>System Default</Text>
              <Text style={styles.voiceSubtitle}>Device text-to-speech</Text>
            </View>
            {defaultVoice === null && (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.royalPurple} />
            )}
          </TouchableOpacity>
        </View>

        {/* Neural TTS Voices */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Neural TTS Voices</Text>
          <Text style={styles.sectionSubtitle}>
            High-quality cloud-based voices
          </Text>
          <TouchableOpacity style={styles.neuralVoiceButton}>
            <Ionicons name="sparkles" size={20} color={COLORS.royalPurple} />
            <Text style={styles.neuralVoiceButtonText}>Browse Neural Voices</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {/* Custom Voices */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Custom Voices</Text>
              <Text style={styles.sectionSubtitle}>
                Upload your own audio for personalized narration
              </Text>
            </View>
            <TouchableOpacity style={styles.uploadChip} onPress={handlePickAudioFile}>
              <Ionicons name="cloud-upload" size={16} color={COLORS.white} />
              <Text style={styles.uploadChipText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.royalPurple} />
            </View>
          ) : voices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mic-outline" size={48} color={COLORS.gray300} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Custom Voices</Text>
              <Text style={styles.emptySubtitle}>
                Upload an audio file to create your own narrator voice
              </Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickAudioFile}>
                <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} />
                <Text style={styles.uploadButtonText}>Upload Voice</Text>
              </TouchableOpacity>
            </View>
          ) : (
            voices.map((voice) => (
              <View key={voice.id} style={styles.voiceCard}>
                <View style={styles.voiceIcon}>
                  <Ionicons name="mic" size={24} color={COLORS.royalPurple} />
                </View>
                <View style={styles.voiceInfo}>
                  <Text style={[styles.voiceName, { color: colors.text }]} numberOfLines={1}>
                    {voice.name}
                  </Text>
                  <Text style={styles.voiceSubtitle}>
                    {voice.language} • {voice.duration_seconds ? `${voice.duration_seconds}s` : 'Custom audio'}
                  </Text>
                </View>
                <View style={styles.voiceActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handlePlayPreview(voice)}
                  >
                    <Ionicons name="play-circle-outline" size={22} color={COLORS.gray500} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleSetDefault(voice)}
                  >
                    <Ionicons
                      name={defaultVoice?.id === voice.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={defaultVoice?.id === voice.id ? COLORS.royalPurple : COLORS.gray400}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteVoice(voice)}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.gray400} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Upload Custom Voice</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.label, { color: colors.text }]}>Voice Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: COLORS.gray300, backgroundColor: colors.background }]}
                value={voiceName}
                onChangeText={setVoiceName}
                placeholder="My Narrator Voice"
                placeholderTextColor={COLORS.gray400}
              />
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.royalPurple} />
              <Text style={styles.infoText}>
                Upload an audio file (MP3, WAV, OGG, AAC, M4A) up to 50MB. This audio will be used as the narrator voice for audiobooks.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={handleUploadVoice}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
                  <Text style={styles.submitButtonText}>Upload Voice</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
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
    textAlign: 'center',
    marginRight: 24,
  },
  addButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.royalPurple,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  uploadChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.lightBackground,
    marginBottom: SPACING.xs,
  },
  voiceCardActive: {
    borderWidth: 2,
    borderColor: COLORS.royalPurple,
  },
  voiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.royalPurple + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  voiceSubtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: 4,
  },
  neuralVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.sm,
  },
  neuralVoiceButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.deepNavy,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.royalPurple,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
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
  formField: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.royalPurple + '10',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray600,
    lineHeight: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.royalPurple,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

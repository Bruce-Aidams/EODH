import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '@/stores/settingsStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 26, 28, 32];
const LINE_SPACINGS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0];
const THEMES = [
  { key: 'light' as const, label: 'Light', icon: 'sunny' as const, bg: '#FFFFFF' },
  { key: 'dark' as const, label: 'Dark', icon: 'moon' as const, bg: '#1a1a2e' },
  { key: 'sepia' as const, label: 'Sepia', icon: 'document-text' as const, bg: '#F6F0E0' },
];
const TEXT_ALIGNMENTS = [
  { key: 'left' as const, label: 'Left', icon: 'align-horizontal-left' as const },
  { key: 'center' as const, label: 'Center', icon: 'align-horizontal-center' as const },
  { key: 'justify' as const, label: 'Justify', icon: 'text-wrapping' as const },
];

export default function ReadingSettingsScreen() {
  const router = useRouter();
  const { readingSettings, setReadingSettings, resetSettings } = useSettingsStore();
  const [showPreview, setShowPreview] = useState(false);

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Reset all reading settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetSettings(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reading Settings</Text>
        <TouchableOpacity style={styles.previewButton} onPress={() => setShowPreview(true)}>
          <Ionicons name="eye" size={20} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Theme Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeRow}>
            {THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[
                  styles.themeCard,
                  { backgroundColor: theme.bg },
                  readingSettings.theme === theme.key && styles.themeCardActive,
                ]}
                onPress={() => setReadingSettings({ theme: theme.key, backgroundColor: theme.bg })}
              >
                <View style={[styles.themeCircle, { backgroundColor: theme.bg }]}>
                  <Ionicons name={theme.icon} size={18} color={theme.bg === '#FFFFFF' ? COLORS.deepNavy : (theme.bg === '#1a1a2e' ? COLORS.white : COLORS.deepNavy)} />
                </View>
                <Text style={[
                  styles.themeLabel,
                  theme.bg === '#1a1a2e' && { color: COLORS.white },
                  readingSettings.theme === theme.key && styles.themeLabelActive,
                ]}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font Size</Text>
          <View style={styles.sliderContainer}>
            <Ionicons name="text" size={16} color={COLORS.gray400} />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={FONT_SIZES.length - 1}
              step={1}
              value={FONT_SIZES.indexOf(readingSettings.fontSize)}
              onValueChange={(value) => {
                const index = Math.round(value);
                setReadingSettings({ fontSize: FONT_SIZES[index] });
              }}
              minimumTrackTintColor={COLORS.royalPurple}
              maximumTrackTintColor={COLORS.gray300}
              thumbTintColor={COLORS.royalPurple}
            />
            <Ionicons name="text" size={24} color={COLORS.gray600} />
          </View>
          <Text style={styles.sliderValue}>{readingSettings.fontSize}px</Text>
        </View>

        {/* Line Spacing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Spacing</Text>
          <View style={styles.sliderContainer}>
            <Ionicons name="resize" size={16} color={COLORS.gray400} />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={LINE_SPACINGS.length - 1}
              step={1}
              value={LINE_SPACINGS.indexOf(readingSettings.lineSpacing)}
              onValueChange={(value) => {
                const index = Math.round(value);
                setReadingSettings({ lineSpacing: LINE_SPACINGS[index] });
              }}
              minimumTrackTintColor={COLORS.royalPurple}
              maximumTrackTintColor={COLORS.gray300}
              thumbTintColor={COLORS.royalPurple}
            />
            <Ionicons name="resize" size={24} color={COLORS.gray600} />
          </View>
          <Text style={styles.sliderValue}>{readingSettings.lineSpacing}x</Text>
        </View>

        {/* Text Alignment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text Alignment</Text>
          <View style={styles.alignmentRow}>
            {TEXT_ALIGNMENTS.map((align) => (
              <TouchableOpacity
                key={align.key}
                style={[
                  styles.alignmentCard,
                  readingSettings.textAlign === align.key && styles.alignmentCardActive,
                ]}
                onPress={() => setReadingSettings({ textAlign: align.key })}
              >
                <Ionicons
                  name={align.icon}
                  size={22}
                  color={readingSettings.textAlign === align.key ? COLORS.royalPurple : COLORS.gray400}
                />
                <Text style={[
                  styles.alignmentLabel,
                  readingSettings.textAlign === align.key && styles.alignmentLabelActive,
                ]}>
                  {align.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Margins */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Margins</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>8px</Text>
            <Slider
              style={styles.slider}
              minimumValue={8}
              maximumValue={32}
              step={2}
              value={readingSettings.margins}
              onValueChange={(value) => {
                setReadingSettings({ margins: Math.round(value) });
              }}
              minimumTrackTintColor={COLORS.royalPurple}
              maximumTrackTintColor={COLORS.gray300}
              thumbTintColor={COLORS.royalPurple}
            />
            <Text style={styles.sliderLabel}>32px</Text>
          </View>
          <Text style={styles.sliderValue}>{readingSettings.margins}px</Text>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.error} />
          <Text style={styles.resetText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={[styles.previewContent, { backgroundColor: readingSettings.backgroundColor }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: readingSettings.theme === 'dark' ? COLORS.white : COLORS.deepNavy }]}>
                Preview
              </Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Ionicons name="close" size={24} color={readingSettings.theme === 'dark' ? COLORS.white : COLORS.deepNavy} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: readingSettings.margins }}>
              <Text
                style={[
                  styles.previewText,
                  {
                    fontSize: readingSettings.fontSize,
                    lineHeight: readingSettings.fontSize * readingSettings.lineSpacing,
                    textAlign: readingSettings.textAlign,
                    color: readingSettings.theme === 'dark' ? COLORS.white : (readingSettings.theme === 'sepia' ? '#5B4636' : COLORS.deepNavy),
                  },
                ]}
              >
                The quick brown fox jumps over the lazy dog. Reading is a wonderful way to expand your knowledge and imagination. This preview shows how your text will appear with the current settings.
              </Text>
            </View>
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
  previewButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  themeCard: {
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  themeCardActive: {
    borderColor: COLORS.royalPurple,
  },
  themeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  themeLabelActive: {
    color: COLORS.royalPurple,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  sliderLabel: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  alignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  alignmentCard: {
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 80,
  },
  alignmentCardActive: {
    backgroundColor: COLORS.royalPurple + '15',
  },
  alignmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  alignmentLabelActive: {
    color: COLORS.royalPurple,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  previewContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  previewText: {
    fontFamily: 'System',
  },
});

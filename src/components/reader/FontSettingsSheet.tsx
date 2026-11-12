import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeSelector } from '@/components/ThemeSelector';
import { BORDER_RADIUS } from '@/constants/theme';
import { ReadingSettings } from '@/types';

interface FontSettingsSheetProps {
  visible: boolean;
  readingSettings: ReadingSettings;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
    border: string;
  };
  onClose: () => void;
  onSetReadingSettings: (settings: Partial<ReadingSettings>) => Promise<void> | void;
  onChangeFontSize: (delta: number) => Promise<void> | void;
  onResetSettings: () => Promise<void> | void;
}

const FONT_FAMILIES = ['System', 'Georgia', 'Merriweather', 'Lora', 'Literata', 'Open Sans', 'Roboto'];

export const FontSettingsSheet: React.FC<FontSettingsSheetProps> = ({
  visible,
  readingSettings,
  themeColors,
  colors,
  onClose,
  onSetReadingSettings,
  onChangeFontSize,
  onResetSettings,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close settings" style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Reading Settings</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Done" style={{ padding: 4 }}>
              <Text style={[styles.doneButton, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsScroll}>
            {/* Live Preview */}
            <View style={[styles.previewBox, { backgroundColor: themeColors.background, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: themeColors.secondaryText }]}>Preview</Text>
              <Text
                style={[
                  styles.previewText,
                  {
                    color: themeColors.text,
                    fontSize: readingSettings.fontSize,
                    lineHeight: readingSettings.fontSize * readingSettings.lineSpacing,
                    fontFamily: readingSettings.fontFamily === 'System' ? 'System' : readingSettings.fontFamily,
                    textAlign: readingSettings.textAlign,
                  },
                ]}
              >
                The quick brown fox jumps over the lazy dog. Reading is a journey of discovery.
              </Text>
            </View>

            {/* Theme */}
            <ThemeSelector
              selectedTheme={readingSettings.theme}
              onThemeChange={(theme) => onSetReadingSettings({ theme })}
              label="Theme"
            />

            {/* Font Family */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Family</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {FONT_FAMILIES.map((font) => (
                    <TouchableOpacity
                      key={font}
                      style={[
                        styles.fontFamilyButton,
                        { backgroundColor: themeColors.background, borderColor: colors.border },
                        readingSettings.fontFamily === font && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => onSetReadingSettings({ fontFamily: font })}
                      accessibilityLabel={`Select ${font} font`}
                    >
                      <Text style={[
                        styles.fontFamilyButtonText,
                        { color: readingSettings.fontFamily === font ? '#FFFFFF' : themeColors.text },
                        { fontFamily: font === 'System' ? 'System' : font }
                      ]}>
                        {font}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Font Size */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Font Size</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity onPress={() => onChangeFontSize(-2)} accessibilityLabel="Decrease font size">
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.fontSize}
                </Text>
                <TouchableOpacity onPress={() => onChangeFontSize(2)} accessibilityLabel="Increase font size">
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Line Spacing */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Line Spacing</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity
                  onPress={() =>
                    onSetReadingSettings({
                      lineSpacing: Math.max(1.0, readingSettings.lineSpacing - 0.25),
                    })
                  }
                  accessibilityLabel="Decrease line spacing"
                >
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.lineSpacing.toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    onSetReadingSettings({
                      lineSpacing: Math.min(2.5, readingSettings.lineSpacing + 0.25),
                    })
                  }
                  accessibilityLabel="Increase line spacing"
                >
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Text Alignment */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Alignment</Text>
              <View style={styles.alignmentRow}>
                {(['left', 'center', 'justify'] as const).map((align) => (
                  <TouchableOpacity
                    key={align}
                    style={[
                      styles.alignButton,
                      { borderColor: colors.border },
                      readingSettings.textAlign === align && styles.alignButtonActive,
                    ]}
                    onPress={() => onSetReadingSettings({ textAlign: align })}
                    accessibilityLabel={`Align text ${align}`}
                  >
                    <Ionicons
                      name={
                        align === 'left'
                          ? 'remove'
                          : align === 'center'
                          ? 'aperture'
                          : 'resize'
                      }
                      size={20}
                      color={
                        readingSettings.textAlign === align
                          ? '#FFFFFF'
                          : colors.primary
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Margins */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Margins</Text>
              <View style={styles.fontSizeRow}>
                <TouchableOpacity
                  onPress={() =>
                    onSetReadingSettings({ margins: Math.max(8, readingSettings.margins - 4) })
                  }
                  accessibilityLabel="Decrease margins"
                >
                  <Ionicons name="remove-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: themeColors.text }]}>
                  {readingSettings.margins}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    onSetReadingSettings({ margins: Math.min(40, readingSettings.margins + 4) })
                  }
                  accessibilityLabel="Increase margins"
                >
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: colors.border }]}
              onPress={async () => {
                await onResetSettings();
                onClose();
              }}
              accessibilityLabel="Reset all settings to default"
            >
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
              <Text style={[styles.resetButtonText, { color: colors.primary }]}>Reset to Defaults</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: 20,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  doneButton: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingsScroll: {
    maxHeight: 400,
  },
  previewBox: {
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewText: {
    letterSpacing: 0.2,
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  fontSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  fontSizeValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  alignmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  alignButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  alignButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  fontFamilyButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  fontFamilyButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});


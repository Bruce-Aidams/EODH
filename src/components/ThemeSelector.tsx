import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, COLORS, SHADOWS } from '@/constants/theme';

const { width } = Dimensions.get('window');

type ReadingTheme = 'light' | 'dark' | 'system' | 'blue';

interface ThemeOption {
  key: ReadingTheme;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  text: string;
  bar: string;
  line: string;
  accent: string;
}

const themeOptions: ThemeOption[] = [
  {
    key: 'light',
    label: 'Light',
    icon: 'sunny-outline',
    bg: '#FFFFFF',
    text: '#1a1a1a',
    bar: '#E5E7EB',
    line: '#F3F4F6',
    accent: COLORS.royalPurple,
  },
  {
    key: 'dark',
    label: 'Dark',
    icon: 'moon-outline',
    bg: '#1F2937',
    text: '#E5E7EB',
    bar: '#374151',
    line: '#4B5563',
    accent: COLORS.violet,
  },
  {
    key: 'system',
    label: 'System',
    icon: 'desktop-outline',
    bg: '#6B7280',
    text: '#FFFFFF',
    bar: '#4B5563',
    line: '#374151',
    accent: COLORS.royalPurple,
  },
  {
    key: 'blue',
    label: 'Blue',
    icon: 'water-outline',
    bg: '#1a2744',
    text: '#D6E4F0',
    bar: '#243B5A',
    line: '#2E4A6B',
    accent: '#4DA6FF',
  },
];

interface ThemeSelectorProps {
  selectedTheme: ReadingTheme;
  onThemeChange: (theme: ReadingTheme) => void;
  label?: string;
}

export function ThemeSelector({ selectedTheme, onThemeChange, label }: ThemeSelectorProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.cardsRow}>
        {themeOptions.map((option) => {
          const isSelected = selectedTheme === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.card,
                { backgroundColor: option.bg },
                isSelected && styles.cardSelected,
              ]}
              onPress={() => onThemeChange(option.key)}
              activeOpacity={0.7}
            >
              {/* Selected ring */}
              {isSelected && (
                <View style={[styles.selectedRing, { borderColor: option.accent }]}>
                  <View style={styles.cardInner}>
                    <ThemePreviewCard option={option} />
                  </View>
                </View>
              )}
              {!isSelected && (
                <View style={styles.cardInner}>
                  <ThemePreviewCard option={option} />
                </View>
              )}
              <Text
                style={[
                  styles.cardLabel,
                  { color: option.text },
                  isSelected && { color: option.accent, fontWeight: '700' },
                ]}
              >
                {option.label}
              </Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: option.accent }]}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface ThemePreviewCardProps {
  option: ThemeOption;
}

function ThemePreviewCard({ option }: ThemePreviewCardProps) {
  return (
    <View style={[styles.preview, { backgroundColor: option.bg }]}>
      {/* Mini header bar */}
      <View style={[styles.previewHeader, { backgroundColor: option.bar }]}>
        <Ionicons name={option.icon} size={8} color={option.text} />
      </View>
      {/* Mini text lines */}
      <View style={styles.previewBody}>
        <View style={[styles.previewLine, { backgroundColor: option.text + '30', width: '90%' }]} />
        <View style={[styles.previewLine, { backgroundColor: option.text + '20', width: '75%' }]} />
        <View style={[styles.previewLine, { backgroundColor: option.text + '20', width: '85%' }]} />
        <View style={[styles.previewLine, { backgroundColor: option.accent + '40', width: '40%' }]} />
      </View>
    </View>
  );
}

const cardWidth = (width - 96) / 4;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 4,
    ...SHADOWS.card,
  },
  cardSelected: {
    transform: [{ scale: 1.02 }],
  },
  selectedRing: {
    borderWidth: 2.5,
    borderRadius: BORDER_RADIUS.lg - 2,
    padding: 8,
    width: '100%',
    alignItems: 'center',
  },
  cardInner: {
    width: '100%',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    marginTop: 8,
    fontWeight: '500',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: cardWidth - 20,
    height: 70,
    borderRadius: 6,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  previewHeader: {
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  previewBody: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 6,
    justifyContent: 'flex-start',
    gap: 3,
  },
  previewLine: {
    height: 3,
    borderRadius: 1.5,
  },
});

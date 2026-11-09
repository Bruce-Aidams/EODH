import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BORDER_RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

export default function FilterChip({
  label,
  selected = false,
  onPress,
  icon,
  count,
}: FilterChipProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceVariant,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? '#FFFFFF' : colors.textSecondary}
        />
      )}
      <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.countBadge, { backgroundColor: selected ? 'rgba(255,255,255,0.4)' : colors.border }]}>
          <Text style={[styles.countText, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { FONT_SIZE, COLORS } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  onPressSeeAll?: () => void;
  showSeeAll?: boolean;
  subtitle?: string;
}

export function SectionHeader({ title, onPressSeeAll, showSeeAll = true, subtitle }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {showSeeAll && onPressSeeAll && (
        <TouchableOpacity onPress={onPressSeeAll} activeOpacity={0.6}>
          <Text style={[styles.seeAll, { color: COLORS.royalPurple }]}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  seeAll: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});

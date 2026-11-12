import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';

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
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
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
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '500',
  },
});

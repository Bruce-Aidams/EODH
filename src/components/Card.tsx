import React from 'react';
import { View, TouchableOpacity, ViewStyle, StyleSheet } from 'react-native';
import { BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  onPress?: () => void;
  variant?: 'default' | 'subtle' | 'outlined';
}

export default function Card({
  children,
  style,
  padding = 16,
  onPress,
  variant = 'default',
}: CardProps) {
  const { colors } = useTheme();

  const bg = variant === 'subtle' ? colors.surfaceVariant : colors.card;
  const borderColor = variant === 'outlined' ? colors.border : 'transparent';

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          padding,
          borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.pressable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressable: {
    borderRadius: BORDER_RADIUS.md,
  },
});

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Pressable,
  PressableProps,
} from 'react-native';
import { BORDER_RADIUS, SHADOWS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';

interface ModernCardProps extends PressableProps {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'gradient';
  onPress?: () => void;
}

export function ModernCard({
  style,
  children,
  variant = 'default',
  onPress,
  ...pressableProps
}: ModernCardProps) {
  const { colors, isDark } = useTheme();

  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    !isDark && SHADOWS.card,
    variant === 'elevated' && !isDark && SHADOWS.cardHeavy,
    style,
  ];

  const backgroundColor = isDark ? '#1F2937' : '#FFFFFF';

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={cardStyle}
        {...pressableProps}
      >
        <View style={[styles.cardInner, { backgroundColor }]}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <Pressable style={cardStyle} {...pressableProps}>
      <View style={[styles.cardInner, { backgroundColor }]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginVertical: 4,
  },
  cardInner: {
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
  },
  elevated: {
    ...SHADOWS.cardHeavy,
  },
});

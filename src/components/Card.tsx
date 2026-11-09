import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { BORDER_RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  onPress?: () => void;
  elevation?: boolean;
}

export default function Card({
  children,
  style,
  padding = SPACING.md,
  onPress,
  elevation = true,
}: CardProps) {
  const { colors } = useTheme();

  const Wrapper = onPress ? View : View;

  return (
    <Wrapper
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          padding,
          shadowColor: colors.cardShadow,
        },
        elevation && styles.elevation,
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  elevation: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});

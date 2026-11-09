import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, GRADIENTS, toGradientCSS } from '@/constants/theme';

type GradientPreset = 'primary' | 'secondary' | 'accent' | 'dark' | 'light';
type GradientDirection = 'vertical' | 'horizontal' | 'diagonal';

interface GradientBackgroundProps {
  preset?: GradientPreset;
  colors?: string[];
  direction?: GradientDirection;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  useSafeArea?: boolean;
}

const directionMap: Record<GradientDirection, { start: [number, number]; end: [number, number] }> = {
  vertical: { start: [0, 0], end: [0, 1] },
  horizontal: { start: [0, 0], end: [1, 0] },
  diagonal: { start: [0, 0], end: [1, 1] },
};

const presetMap: Record<GradientPreset, readonly string[]> = {
  primary: GRADIENTS.primary,
  secondary: GRADIENTS.secondary,
  accent: GRADIENTS.accent,
  dark: GRADIENTS.dark,
  light: GRADIENTS.light,
};

export function GradientBackground({
  preset = 'primary',
  colors,
  direction = 'vertical',
  style,
  children,
  useSafeArea = true,
}: GradientBackgroundProps) {
  const gradientColors = colors ?? Array.from(presetMap[preset]);
  const backgroundImage = toGradientCSS(gradientColors, direction);

  return (
    <View style={[styles.container, useSafeArea && styles.safeArea, { backgroundImage }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingTop: 60,
  },
});

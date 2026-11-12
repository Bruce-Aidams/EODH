export const COLORS = {
  // Core brand — subtle indigo accent instead of heavy purple
  brand: '#6366F1',
  brandLight: '#818CF8',
  brandDark: '#4F46E5',
  brandBg: '#EEF2FF',
  // Neutrals
  white: '#FFFFFF',
  lightBackground: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  gray950: '#030712',
  // Semantic
  success: '#10B981',
  successBg: '#ECFDF5',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  // Legacy aliases (kept for backward compatibility)
  deepNavy: '#080B2E',
  royalPurple: '#6366F1',
  violet: '#818CF8',
  gold: '#F59E0B',
} as const;

export const THEME = {
  light: {
    background: COLORS.lightBackground,
    surface: COLORS.white,
    surfaceVariant: COLORS.gray50,
    text: COLORS.gray900,
    textSecondary: COLORS.gray500,
    textMuted: COLORS.gray400,
    primary: COLORS.brand,
    primaryVariant: COLORS.brandDark,
    accent: COLORS.brandLight,
    border: COLORS.gray200,
    card: COLORS.white,
    cardShadow: 'rgba(0, 0, 0, 0.06)',
    error: COLORS.error,
    errorBg: COLORS.errorBg,
    success: COLORS.success,
    successBg: COLORS.successBg,
    warning: COLORS.warning,
    warningBg: COLORS.warningBg,
    info: COLORS.info,
    infoBg: COLORS.infoBg,
    highlight: 'rgba(99, 102, 241, 0.12)',
    bookmark: 'rgba(99, 102, 241, 0.1)',
    note: 'rgba(99, 102, 241, 0.1)',
    statusBar: 'dark-content' as const,
  },
  dark: {
    background: COLORS.gray950,
    surface: COLORS.gray900,
    surfaceVariant: COLORS.gray800,
    text: COLORS.gray50,
    textSecondary: COLORS.gray400,
    textMuted: COLORS.gray500,
    primary: COLORS.brandLight,
    primaryVariant: COLORS.brand,
    accent: COLORS.brand,
    border: COLORS.gray800,
    card: COLORS.gray900,
    cardShadow: 'rgba(0, 0, 0, 0.4)',
    error: COLORS.error,
    errorBg: 'rgba(239, 68, 68, 0.15)',
    success: COLORS.success,
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: COLORS.warning,
    warningBg: 'rgba(245, 158, 11, 0.15)',
    info: COLORS.info,
    infoBg: 'rgba(59, 130, 246, 0.15)',
    highlight: 'rgba(99, 102, 241, 0.2)',
    bookmark: 'rgba(99, 102, 241, 0.15)',
    note: 'rgba(99, 102, 241, 0.15)',
    statusBar: 'light-content' as const,
  },
};

export type ThemeType = 'light' | 'dark' | 'system';
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryVariant: string;
  accent: string;
  border: string;
  card: string;
  cardShadow: string;
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
  highlight: string;
  bookmark: string;
  note: string;
  statusBar: 'light-content' | 'dark-content';
};

/**
 * Get the resolved theme colors based on user preference and system color scheme.
 */
export function getThemeColors(
  userTheme: ThemeType,
  systemColorScheme: 'light' | 'dark' | null
): ThemeColors {
  if (userTheme === 'system') {
    return systemColorScheme === 'dark' ? THEME.dark : THEME.light;
  }
  return userTheme === 'dark' ? THEME.dark : THEME.light;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FONT_FAMILY = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

// Gradient presets — subtle, modern SaaS-style gradients
export const GRADIENTS = {
  primary: ['#6366F1', '#818CF8'] as const, // subtle indigo
  secondary: ['#4F46E5', '#6366F1'] as const, // deeper indigo
  accent: ['#6366F1', '#3B82F6'] as const, // indigo → blue
  dark: ['#1E1B4B', '#312E81'] as const, // dark indigo
  light: ['#818CF8', '#A5B4FC'] as const, // light indigo
} as const;

// Animation timing tokens
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

/**
 * Convert a gradient color array to a CSS linear-gradient() string for use with
 * React Native's `backgroundImage` style. This avoids the need for expo-linear-gradient
 * native modules.
 */
export function toGradientCSS(
  colors: readonly string[],
  direction: 'vertical' | 'horizontal' | 'diagonal' = 'vertical'
): string {
  const dir = direction === 'vertical' ? '180deg' : direction === 'horizontal' ? '90deg' : '135deg';
  return `linear-gradient(${dir}, ${Array.from(colors).join(', ')})`;
}

// Subtle shadow styles — modern SaaS aesthetic (light, diffused)
export const SHADOWS = {
  sm: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  xl: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  // Legacy aliases for backward compatibility
  card: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeavy: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: '#6366F1' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

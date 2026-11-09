export const COLORS = {
  deepNavy: '#080B2E',
  royalPurple: '#5415E8',
  violet: '#812BFF',
  gold: '#FFC928',
  white: '#FFFFFF',
  lightBackground: '#F6F5FC',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

export const THEME = {
  light: {
    background: COLORS.lightBackground,
    surface: COLORS.white,
    surfaceVariant: COLORS.gray100,
    text: COLORS.deepNavy,
    textSecondary: COLORS.gray500,
    textMuted: COLORS.gray400,
    primary: COLORS.royalPurple,
    primaryVariant: COLORS.violet,
    accent: COLORS.gold,
    border: COLORS.gray200,
    card: COLORS.white,
    cardShadow: 'rgba(8, 11, 46, 0.08)',
    error: COLORS.error,
    success: COLORS.success,
    warning: COLORS.warning,
    info: COLORS.info,
    highlight: 'rgba(255, 201, 40, 0.3)',
    bookmark: 'rgba(84, 21, 232, 0.15)',
    note: 'rgba(129, 43, 255, 0.15)',
    statusBar: 'dark-content' as const,
  },
  dark: {
    background: COLORS.gray900,
    surface: COLORS.gray800,
    surfaceVariant: COLORS.gray700,
    text: COLORS.white,
    textSecondary: COLORS.gray400,
    textMuted: COLORS.gray500,
    primary: COLORS.violet,
    primaryVariant: COLORS.royalPurple,
    accent: COLORS.gold,
    border: COLORS.gray700,
    card: COLORS.gray800,
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    error: COLORS.error,
    success: COLORS.success,
    warning: COLORS.warning,
    info: COLORS.info,
    highlight: 'rgba(255, 201, 40, 0.2)',
    bookmark: 'rgba(129, 43, 255, 0.25)',
    note: 'rgba(84, 21, 232, 0.25)',
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
  success: string;
  warning: string;
  info: string;
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
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
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

// Gradient presets matching the showcase design
export const GRADIENTS = {
  primary: ['#080B2E', '#5415E8', '#812BFF'] as const, // deep navy → royal purple → violet
  secondary: ['#5415E8', '#812BFF'] as const, // royal purple → violet
  accent: ['#5415E8', '#FFC928'] as const, // purple → gold
  dark: ['#050820', '#3A10B0', '#6A1BD6'] as const, // darker variant for dark mode
  light: ['#1A1F5E', '#6B3FE8', '#9B5FFF'] as const, // lighter variant
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

// Enhanced shadow styles
export const SHADOWS = {
  card: {
    shadowColor: '#080B2E' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeavy: {
    shadowColor: '#080B2E' as const,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  button: {
    shadowColor: '#FFC928' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

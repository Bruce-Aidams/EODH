import { useCallback, useMemo } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import type { ToastConfig } from 'react-native-toast-message';
import { useTheme } from '@/lib/theme/ThemeContext';
import { BORDER_RADIUS, SPACING } from '@/constants/theme';

/**
 * Modern Snackbar-style Toast Notification System for EODH
 *
 * Features:
 * - Success, error, warning, and info toasts
 * - Theme-aware styling (adapts to dark/light mode)
 * - Non-blocking overlay banners
 * - Configurable duration
 * - Auto-dismiss with swipe-to-dismiss
 * - Modern snackbar design with rounded corners and subtle shadows
 *
 * Setup:
 * 1. Add <Toast config={toastConfig} /> to root layout
 * 2. Use useToast() hook in components
 *
 * Usage:
 * ```tsx
 * const { showSuccess, showError } = useToast();
 * showSuccess('Book downloaded successfully');
 * ```
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number; // milliseconds
}

const toastIcons: Record<ToastType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  success: { name: 'checkmark-circle', color: '#10B981' },
  error: { name: 'close-circle', color: '#EF4444' },
  warning: { name: 'warning', color: '#F59E0B' },
  info: { name: 'information-circle', color: '#5415E8' },
};

/**
 * Modern snackbar-style toast configuration for react-native-toast-message.
 * Uses theme-aware colors for consistent dark/light mode appearance.
 */
export function useToastConfig(): ToastConfig {
  const { colors } = useTheme();

  return useMemo(() => {
    const createToast = (type: ToastType) => ({ text1, text2 }: { text1?: string; text2?: string }) => {
      const icon = toastIcons[type];
      const bg = colors.surface;
      const shadow = colors.cardShadow;

      return (
        <View style={[
          styles.snackbar,
          {
            backgroundColor: bg,
            shadowColor: shadow,
            borderLeftColor: icon.color,
          },
        ]}>
          {/* Icon */}
          <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />

          {/* Text content */}
          <View style={styles.textContainer}>
            {text1 && (
              <Text style={[styles.text1, { color: colors.text }]} numberOfLines={2}>
                {text1}
              </Text>
            )}
            {text2 && (
              <Text style={[styles.text2, { color: colors.textSecondary }]} numberOfLines={2}>
                {text2}
              </Text>
            )}
          </View>

          {/* Dismiss button */}
          <TouchableOpacity onPress={() => Toast.hide()} style={styles.dismiss}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      );
    };

    return {
      success: createToast('success'),
      error: createToast('error'),
      warning: createToast('warning'),
      info: createToast('info'),
    };
  }, [colors]);
}

/**
 * Show a toast notification.
 */
export const showToast = (options: ToastOptions) => {
  const { message, type = 'info', duration = 3000 } = options;
  const parts = message.split('\n');
  Toast.show({
    type: type,
    text1: parts[0] || message,
    text2: parts[1] || undefined,
    visibilityTime: duration,
  });
};

/**
 * Hide the currently visible toast.
 */
export const hideToast = () => {
  Toast.hide();
};

/**
 * Hook for showing toast notifications in React components.
 *
 * @returns Object with showToast, showSuccess, showError, showWarning, showInfo methods
 */
export function useToast() {
  const showToastFn = useCallback((options: ToastOptions) => {
    const { message, type = 'info', duration = 3000 } = options;
    const parts = message.split('\n');
    Toast.show({
      type: type,
      text1: parts[0] || message,
      text2: parts[1] || undefined,
      visibilityTime: duration,
    });
  }, []);

  const showSuccess = useCallback((message: string) => {
    const parts = message.split('\n');
    Toast.show({
      type: 'success',
      text1: parts[0] || message,
      text2: parts[1] || undefined,
      visibilityTime: 3000,
    });
  }, []);

  const showError = useCallback((message: string) => {
    const parts = message.split('\n');
    Toast.show({
      type: 'error',
      text1: parts[0] || message,
      text2: parts[1] || undefined,
      visibilityTime: 4000,
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    const parts = message.split('\n');
    Toast.show({
      type: 'warning',
      text1: parts[0] || message,
      text2: parts[1] || undefined,
      visibilityTime: 3000,
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    const parts = message.split('\n');
    Toast.show({
      type: 'info',
      text1: parts[0] || message,
      text2: parts[1] || undefined,
      visibilityTime: 3000,
    });
  }, []);

  return {
    showToast: showToastFn,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}

const styles = StyleSheet.create({
  snackbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a2e',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    minWidth: 300,
    maxWidth: 400,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  text1: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  text2: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  dismiss: {
    padding: 4,
    flexShrink: 0,
  },
});

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseToast, ErrorToast, Toast, config } from 'react-native-toast-message';

/**
 * Toast Notification System for EODH
 *
 * Uses react-native-toast-message for non-blocking overlay toasts
 * styled with EODH brand colors.
 *
 * Features:
 * - Success, error, warning, and info toasts
 * - Non-blocking overlay banners
 * - Configurable duration
 * - Auto-dismiss with swipe-to-dismiss
 * - EODH branded styling
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

/**
 * EODH-branded toast configuration for react-native-toast-message.
 */
export const toastConfig = config({
  success: ({ text1, text2 }) => (
    <BaseToast
      style={{
        borderLeftColor: '#10B981',
        background: '#1a1a2e',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
      }}
      text2Style={{
        color: '#A0A0B0',
        fontSize: 12,
        marginTop: 2,
      }}
      renderLeadingIcon={() => (
        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
      )}
    />
  ),
  error: ({ text1, text2 }) => (
    <ErrorToast
      style={{
        borderLeftColor: '#EF4444',
        background: '#1a1a2e',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
      }}
      text2Style={{
        color: '#A0A0B0',
        fontSize: 12,
        marginTop: 2,
      }}
    />
  ),
  warning: ({ text1, text2 }) => (
    <BaseToast
      style={{
        borderLeftColor: '#F59E0B',
        background: '#1a1a2e',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
      }}
      text2Style={{
        color: '#A0A0B0',
        fontSize: 12,
        marginTop: 2,
      }}
      renderLeadingIcon={() => (
        <Ionicons name="warning" size={22} color="#F59E0B" />
      )}
    />
  ),
  info: ({ text1, text2 }) => (
    <BaseToast
      style={{
        borderLeftColor: '#5415E8',
        background: '#1a1a2e',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
      }}
      text2Style={{
        color: '#A0A0B0',
        fontSize: 12,
        marginTop: 2,
      }}
      renderLeadingIcon={() => (
        <Ionicons name="information-circle" size={22} color="#5415E8" />
      )}
    />
  ),
});

/**
 * Show a toast notification.
 */
export const showToast = (options: ToastOptions) => {
  const { message, type = 'info', duration = 3000 } = options;
  Toast.show({
    type: type,
    text1: message,
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
    Toast.show({
      type: type,
      text1: message,
      visibilityTime: duration,
    });
  }, []);

  const showSuccess = useCallback((message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      visibilityTime: 3000,
    });
  }, []);

  const showError = useCallback((message: string) => {
    Toast.show({
      type: 'error',
      text1: message,
      visibilityTime: 4000,
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    Toast.show({
      type: 'warning',
      text1: message,
      visibilityTime: 3000,
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    Toast.show({
      type: 'info',
      text1: message,
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

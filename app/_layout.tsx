import { Slot } from 'expo-router';
import { Toast } from 'react-native-toast-message';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import { toastConfig } from '@/lib/notifications/toast';
import { useSyncProgressOnReconnect } from '@/lib/network/useSyncProgressOnReconnect';
import { validateEnvironment } from '@/lib/env/validation';

// Validate environment variables at startup
const envValidation = validateEnvironment();
if (!envValidation.isValid && __DEV__) {
  console.warn('[EODH] Missing environment variables:', envValidation.missing.join(', '));
  console.warn('[EODH] Please create .env.local with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}
if (envValidation.warnings.length > 0 && __DEV__) {
  console.warn('[EODH] Environment warnings:', envValidation.warnings.join(', '));
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const checkAuth = useAuthStore(state => state.checkAuth);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const loadSettings = useSettingsStore(state => state.loadSettings);

  // Sync reading/listening progress when reconnecting online
  useSyncProgressOnReconnect();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <Slot />
      <Toast config={toastConfig} position="bottom" topOffset={20} bottomOffset={20} />
    </ErrorBoundary>
  );
}

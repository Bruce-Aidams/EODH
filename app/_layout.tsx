import { Slot, useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { useToastConfig } from '@/lib/notifications/toast';
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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const [isReady, setIsReady] = useState(false);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    // Check auth silently — do not block access if unauthenticated
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated, loadSettings]);

  useEffect(() => {
    if (isLoading) return;

    const inSplash = segments[0] === 'splash';

    // Redirect away from splash
    if (inSplash) {
      router.replace('/(tabs)');
    }

    setIsReady(true);
  }, [isAuthenticated, isLoading, segments]);

  // Show nothing while loading
  if (!isReady) return null;

  return <>{children}</>;
}

function AppContent() {
  const toastConfig = useToastConfig();

  // Sync reading/listening progress when reconnecting online
  useSyncProgressOnReconnect();

  return (
    <AuthGuard>
      <ErrorBoundary>
        <Slot />
      </ErrorBoundary>
      <Toast config={toastConfig} position="bottom" topOffset={20} bottomOffset={20} />
    </AuthGuard>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

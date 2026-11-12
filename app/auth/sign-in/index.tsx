import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/lib/notifications/toast';
import { SPACING, BORDER_RADIUS, GRADIENTS, SHADOWS, toGradientCSS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useAnimatedFade } from '@/hooks/useAnimatedFade';

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { showSuccess, showError } = useToast();
  const { isDark, colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      await signIn(email.trim(), password);
      showSuccess('Welcome back!');
      router.replace('/(tabs)');
    } catch (err: any) {
      const message = err?.message || 'Sign in failed. Please check your credentials.';
      setError(message);
      showError(message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError('Please enter your email address first.');
      return;
    }
    try {
      await useAuthStore.getState().resetPassword(email.trim());
      showSuccess('Password reset link sent to your email.');
    } catch (err: any) {
      const message = err?.message || 'Failed to send reset link.';
      setError(message);
      showError(message);
    }
  };

  const gradientColors = isDark ? GRADIENTS.dark : GRADIENTS.primary;

  // Animation fade-ins
  const headerFade = useAnimatedFade({ delay: 100, duration: 400 });
  const formFade = useAnimatedFade({ delay: 250, duration: 400 });

  return (
    <View style={[styles.container, { backgroundImage: toGradientCSS(gradientColors) }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Animated.View style={{ opacity: headerFade }}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.logoContainer}>
                <Ionicons name="book" size={56} color="#FFC928" />
                <Text style={styles.logoText}>EODH</Text>
                <Text style={styles.tagline}>Read. Listen. Learn.</Text>
              </View>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View style={{ opacity: formFade }}>
            <View style={[styles.formCard, SHADOWS.cardHeavy]}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue reading</Text>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Input
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isLoading}
              leftIcon="mail-outline"
            />

            {/* Password */}
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              onSubmitEditing={handleSignIn}
              leftIcon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleSignIn}
              disabled={isLoading}
              loading={isLoading}
              fullWidth
              size="large"
              style={styles.signInButton}
            />

            {/* Sign Up Link */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/sign-up')}>
                <Text style={styles.signUpLink}>Create one</Text>
              </TouchableOpacity>
            </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: SPACING.sm,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#fff',
  },
  tagline: {
    fontSize: 14,
    letterSpacing: 3,
    marginTop: SPACING.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: SPACING.xl,
    elevation: 8,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1a1a2e',
  },
  formSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.lg,
    color: '#6b7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5415E8',
  },
  signInButton: {
    marginTop: SPACING.sm,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  signUpText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5415E8',
  },
});

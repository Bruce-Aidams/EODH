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

export default function SignUpScreen() {
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { showSuccess, showError } = useToast();
  const { isDark, colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await signUp(email.trim(), password, name.trim());
      showSuccess('Account created successfully!');
      router.replace('/(tabs)');
    } catch (err: any) {
      const message = err?.message || 'Sign up failed. Please try again.';
      setError(message);
      showError(message);
    }
  };

  const getPasswordStrength = (): { label: string; color: string } => {
    if (password.length === 0) return { label: '', color: colors.textMuted };
    if (password.length < 6) return { label: 'Weak', color: colors.error };
    if (password.length < 10) return { label: 'Medium', color: '#F59E0B' };
    return { label: 'Strong', color: '#10B981' };
  };

  const strength = getPasswordStrength();

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
            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSubtitle}>Join EODH to start reading</Text>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <Input
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isLoading}
              leftIcon="person-outline"
            />

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
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              leftIcon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />
            {strength.label ? (
              <View style={styles.strengthRow}>
                <View style={[styles.strengthBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.strengthFill, { backgroundColor: strength.color, width: password.length < 6 ? '33%' : password.length < 10 ? '66%' : '100%' }]} />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
              </View>
            ) : null}

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              onSubmitEditing={handleSignUp}
              leftIcon="shield-outline"
            />

            {/* Sign Up Button */}
            <Button
              title="Create Account"
              onPress={handleSignUp}
              disabled={isLoading}
              loading={isLoading}
              fullWidth
              size="large"
              style={styles.signUpButton}
            />

            {/* Sign In Link */}
            <View style={styles.signInRow}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/sign-in')}>
                <Text style={styles.signInLink}>Sign in</Text>
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
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  signUpButton: {
    marginTop: SPACING.sm,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  signInText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5415E8',
  },
});

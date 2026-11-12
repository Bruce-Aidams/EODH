import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GRADIENTS, COLORS, FONT_SIZE, toGradientCSS } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';

const { width, height } = Dimensions.get('window');
const MIN_DISPLAY_TIME = 800; // Minimum splash display time for branding

export default function SplashScreen() {
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const mountedTimeRef = useRef(Date.now());
  const navigatedRef = useRef(false);

  const navigate = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace('/(tabs)');
  }, [router]);

  // Fade and scale animations
  const fadeOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  // Animated loading dots
  const dot1Scale = useSharedValue(1);
  const dot2Scale = useSharedValue(1);
  const dot3Scale = useSharedValue(1);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
    opacity: dot1Scale.value > 1.2 ? 1 : 0.4,
  }));
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
    opacity: dot2Scale.value > 1.2 ? 1 : 0.7,
  }));
  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }],
    opacity: dot3Scale.value > 1.2 ? 1 : 1,
  }));

  useEffect(() => {
    // Animate in
    fadeOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Animate loading dots with sequential pulse
    const pulseAnimation = () =>
      withSequence(
        withTiming(1.5, { duration: 400, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.in(Easing.ease) })
      );

    dot1Scale.value = withRepeat(pulseAnimation(), -1, true);
    dot2Scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 200 }),
        pulseAnimation()
      ),
      -1,
      true
    );
    dot3Scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        pulseAnimation()
      ),
      -1,
      true
    );
  }, []);

  // Navigate as soon as auth resolves, with a minimum display time for branding
  useEffect(() => {
    // If auth is still loading, wait for it to resolve
    if (isLoading) return;

    const elapsed = Date.now() - mountedTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    if (remaining > 0) {
      const timer = setTimeout(navigate, remaining);
      return () => clearTimeout(timer);
    } else {
      navigate();
    }
  }, [isLoading, navigate]);

  return (
    <View style={[styles.container, { backgroundImage: toGradientCSS(GRADIENTS.primary) }]}>
      <View style={styles.centerContent}>
        <Animated.View style={[fadeStyle, logoStyle]}>
          <View style={styles.logoCircle}>
            <Ionicons name="book" size={64} color={COLORS.gold} />
          </View>
          <Text style={styles.appName}>EODH</Text>
          <Text style={styles.tagline}>Read. Listen. Learn.</Text>
        </Animated.View>

        <Animated.View style={[styles.loadingContainer, fadeStyle]}>
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.dot, dot1Style]} />
            <Animated.View style={[styles.dot, dot2Style]} />
            <Animated.View style={[styles.dot, dot3Style]} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 201, 40, 0.3)',
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 4,
    marginBottom: 8,
  },
  tagline: {
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
    fontWeight: '300',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: height * 0.15,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
  },
});

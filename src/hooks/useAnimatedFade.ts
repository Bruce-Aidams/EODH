import { useEffect } from 'react';
import { useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';

interface UseAnimatedFadeOptions {
  duration?: number;
  delay?: number;
  initialValue?: number;
}

/**
 * Reusable hook for fade-in animations using React Native Reanimated.
 * Returns a shared value (0 → 1) that can be used as opacity.
 */
export function useAnimatedFade({
  duration = 300,
  delay = 0,
  initialValue = 0,
}: UseAnimatedFadeOptions = {}) {
  const opacity = useSharedValue(initialValue);

  useEffect(() => {
    const animation = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.ease),
      })
    );
    opacity.value = animation;
  }, [opacity, duration, delay]);

  return opacity;
}

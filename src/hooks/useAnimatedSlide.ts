import { useEffect } from 'react';
import {
  useSharedValue,
  withSpring,
  withDelay,
  WithSpringConfig,
} from 'react-native-reanimated';

type SlideDirection = 'up' | 'down' | 'left' | 'right';

interface UseAnimatedSlideOptions {
  direction?: SlideDirection;
  distance?: number;
  duration?: number;
  delay?: number;
  springConfig?: WithSpringConfig;
}

/**
 * Reusable hook for slide-in animations using React Native Reanimated.
 * Returns a shared value for translateX/translateY that animates from offset to 0.
 */
export function useAnimatedSlide({
  direction = 'up',
  distance = 50,
  delay = 0,
  springConfig = { damping: 15, stiffness: 120, mass: 0.5 },
}: UseAnimatedSlideOptions = {}) {
  const offset = useSharedValue(distance);

  useEffect(() => {
    const animation = withDelay(
      delay,
      withSpring(0, springConfig)
    );
    offset.value = animation;
  }, [offset, delay, springConfig]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return [{ translateY: offset }];
      case 'left':
      case 'right':
        return [{ translateX: offset }];
      default:
        return [{ translateY: offset }];
    }
  };

  return { offset, getTransform };
}

import React, { useEffect, ReactNode } from 'react';
import { View, ViewStyle, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  useSharedValue,
} from 'react-native-reanimated';

interface AnimatedViewProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  fadeDelay?: number;
  fadeDuration?: number;
  slideDirection?: 'up' | 'down' | 'left' | 'right';
  slideDistance?: number;
  slideDelay?: number;
  onPress?: () => void;
  pressScale?: number;
  disableAnimation?: boolean;
}

/**
 * Animated wrapper view that combines fade-in and slide-in animations.
 * Optionally supports press scale animation for interactive elements.
 * When `disableAnimation` is true, renders a simple View without any animation overhead.
 */
export function AnimatedView({
  children,
  style,
  fadeDelay = 0,
  fadeDuration = 300,
  slideDirection = 'up',
  slideDistance = 30,
  slideDelay = 0,
  onPress,
  pressScale = 0.96,
  disableAnimation = false,
}: AnimatedViewProps) {
  // Fast path: skip all animation overhead for list items
  if (disableAnimation) {
    if (onPress) {
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={style}
        >
          {children}
        </TouchableOpacity>
      );
    }
    return <View style={style}>{children}</View>;
  }

  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  const initialOffset = slideDirection === 'up' || slideDirection === 'down'
    ? slideDirection === 'up' ? slideDistance : -slideDistance
    : slideDirection === 'left' ? slideDistance : -slideDistance;

  const translateOffset = useSharedValue(initialOffset);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, {
        duration: fadeDuration,
        easing: Easing.out(Easing.ease),
      });
      translateOffset.value = withSpring(0, { damping: 15, stiffness: 120, mass: 0.5 });
    }, fadeDelay + slideDelay);
  }, [opacity, translateOffset, fadeDelay, slideDelay, fadeDuration]);

  const animatedStyle = useAnimatedStyle(() => {
    const transform = slideDirection === 'left' || slideDirection === 'right'
      ? [{ translateX: translateOffset.value }, { scale: scale.value }]
      : [{ translateY: translateOffset.value }, { scale: scale.value }];

    return {
      transform,
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(pressScale, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200, mass: 0.5 });
  };

  const content = <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={{ flex: 1 }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

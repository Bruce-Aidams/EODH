import React, { useRef } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withDelay,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/theme/ThemeContext';

interface RipplePressProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  rippleColor?: string;
  rippleOpacity?: number;
  duration?: number;
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * RipplePress provides a Material Design-style ripple effect on press.
 * Works on both iOS and Android using react-native-reanimated.
 * The ripple expands from the touch point and fades out on release.
 *
 * Usage: wrap any pressable content
 *   <RipplePress onPress={...}>
 *     <View>...</View>
 *   </RipplePress>
 */
export default function RipplePress({
  children,
  onPress,
  onLongPress,
  disabled = false,
  rippleColor,
  rippleOpacity = 0.3,
  duration = 400,
  borderless = false,
  style,
}: RipplePressProps) {
  const { colors } = useTheme();
  const rippleSize = useSharedValue(0);
  const rippleOpacityValue = useSharedValue(0);
  const layoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const pointRef = useRef({ x: 0, y: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    layoutRef.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
    // Default to center if not touched
    pointRef.current = {
      x: e.nativeEvent.layout.width / 2,
      y: e.nativeEvent.layout.height / 2,
    };
  };

  const handlePressIn = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    // Use touch location relative to the view
    const x = e.nativeEvent.locationX ?? layoutRef.current.width / 2;
    const y = e.nativeEvent.locationY ?? layoutRef.current.height / 2;
    pointRef.current = { x, y };

    const { width, height } = layoutRef.current;
    // Calculate the diagonal to ensure the ripple covers the entire view
    const diagonal = Math.sqrt(width * width + height * height);

    rippleSize.value = 0;
    rippleOpacityValue.value = rippleOpacity;
    rippleSize.value = withTiming(diagonal, {
      duration: duration / 2,
      easing: Easing.out(Easing.quad),
    });

    // Call the original onPress
    onPress?.();
  };

  const handlePressOut = () => {
    rippleOpacityValue.value = withDelay(
      50,
      withTiming(0, {
        duration: duration / 2,
        easing: Easing.in(Easing.quad),
      })
    );
    // Reset size after fade out
    rippleSize.value = withDelay(
      duration / 2,
      withTiming(0, { duration: 0 })
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    const { x, y } = pointRef.current;
    const size = rippleSize.value;
    return {
      width: size,
      height: size,
      left: x - size / 2,
      top: y - size / 2,
      opacity: rippleOpacityValue.value,
      borderRadius: size / 2,
    };
  });

  const resolvedRippleColor = rippleColor || colors.primary;

  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
      disabled={disabled}
      style={[styles.container, borderless && styles.borderless, style]}
    >
      {children}
      {!disabled && (
        <Animated.View
          style={[
            styles.ripple,
            { backgroundColor: resolvedRippleColor },
            animatedStyle,
          ]}
          pointerEvents="none"
          collapsable={false}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  borderless: {
    overflow: 'visible',
  },
  ripple: {
    ...StyleSheet.absoluteFill,
  },
});

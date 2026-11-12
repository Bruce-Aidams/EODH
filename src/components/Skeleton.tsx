import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  delay?: number;
}

/**
 * Skeleton placeholder with shimmer animation.
 * Replaces ActivityIndicator with a shape that previews the content layout.
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  delay = 0,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, delay);
  }, [opacity, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  width?: number | string | ((index: number) => number | string);
  height?: number;
  borderRadius?: number;
  spacing?: number;
  delay?: number;
  marginBottom?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Text skeleton placeholder. Supports single line (lines=1) or multi-line.
 */
export function SkeletonText({
  lines = 1,
  width = '100%',
  height = 14,
  borderRadius,
  spacing = 8,
  delay = 0,
  marginBottom,
  style,
}: SkeletonTextProps) {
  return (
    <View style={[styles.skeletonTextContainer, { gap: spacing, marginBottom }, style]}>
      {Array.from({ length: lines }).map((_, i) => {
        const lineWidth = typeof width === 'function' ? width(i) : width;
        return (
          <Skeleton
            key={i}
            width={lineWidth}
            height={height}
            borderRadius={borderRadius ?? height / 2}
            delay={delay + i * 100}
          />
        );
      })}
    </View>
  );
}

interface SkeletonCardProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  marginBottom?: number;
  imageWidth?: number | string;
  imageHeight?: number;
  titleLines?: number;
  subtitleLines?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Card skeleton placeholder. Can be used as a simple block (width/height)
 * or as a book card with image + text content.
 */
export function SkeletonCard({
  width,
  height,
  borderRadius: propBorderRadius,
  marginBottom,
  imageWidth,
  imageHeight,
  titleLines,
  subtitleLines,
  style,
}: SkeletonCardProps) {
  // Simple block mode when width and height are provided
  if (width !== undefined && height !== undefined) {
    return (
      <Skeleton
        width={width}
        height={height}
        borderRadius={propBorderRadius ?? 8}
        style={{ marginBottom, ...style }}
      />
    );
  }
  // Book card mode
  return (
    <View style={[styles.skeletonCard, { marginBottom }, style]}>
      <Skeleton width={imageWidth ?? 100} height={imageHeight ?? 140} borderRadius={12} />
      <View style={styles.skeletonCardContent}>
        <SkeletonText lines={titleLines ?? 2} height={14} spacing={6} />
        <SkeletonText lines={subtitleLines ?? 1} height={12} spacing={6} delay={200} />
      </View>
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  renderItem?: (index: number) => React.ReactNode;
  itemHeight?: number;
  spacing?: number;
  marginBottom?: number;
}

/**
 * List skeleton placeholder.
 */
export function SkeletonList({
  count = 5,
  renderItem,
  itemHeight = 60,
  spacing = 12,
  marginBottom,
}: SkeletonListProps) {
  return (
    <View style={[styles.skeletonList, { gap: spacing, marginBottom }]}>
      {Array.from({ length: count }).map((_, i) => {
        if (renderItem) {
          return <React.Fragment key={i}>{renderItem(i)}</React.Fragment>;
        }
        return (
          <View key={i} style={[styles.skeletonListItem, { height: itemHeight }]}>
            <Skeleton width={48} height={48} borderRadius={24} delay={i * 100} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonText lines={2} height={12} spacing={6} delay={i * 100 + 50} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  skeletonTextContainer: {
    gap: 8,
  },
  skeletonCard: {
    gap: 12,
    padding: 12,
  },
  skeletonCardContent: {
    gap: 8,
  },
  skeletonList: {
    gap: 12,
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
});

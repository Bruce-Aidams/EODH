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
  width?: (index: number) => number | string;
  height?: number;
  spacing?: number;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Multi-line text skeleton placeholder.
 */
export function SkeletonText({
  lines = 3,
  width = () => '100%',
  height = 14,
  spacing = 8,
  delay = 0,
  style,
}: SkeletonTextProps) {
  return (
    <View style={[styles.skeletonTextContainer, { gap: spacing }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={typeof width === 'function' ? width(i) : width}
          height={height}
          borderRadius={height / 2}
          delay={delay + i * 100}
        />
      ))}
    </View>
  );
}

interface SkeletonCardProps {
  imageWidth?: number | string;
  imageHeight?: number;
  titleLines?: number;
  subtitleLines?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Book card skeleton placeholder.
 */
export function SkeletonCard({
  imageWidth = 100,
  imageHeight = 140,
  titleLines = 2,
  subtitleLines = 1,
  style,
}: SkeletonCardProps) {
  return (
    <View style={[styles.skeletonCard, style]}>
      <Skeleton width={imageWidth} height={imageHeight} borderRadius={12} />
      <View style={styles.skeletonCardContent}>
        <SkeletonText lines={titleLines} height={14} spacing={6} />
        <SkeletonText lines={subtitleLines} height={12} spacing={6} delay={200} />
      </View>
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  renderItem?: (index: number) => React.ReactNode;
  itemHeight?: number;
  spacing?: number;
}

/**
 * List skeleton placeholder.
 */
export function SkeletonList({
  count = 5,
  renderItem,
  itemHeight = 60,
  spacing = 12,
}: SkeletonListProps) {
  return (
    <View style={[styles.skeletonList, { gap: spacing }]}>
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

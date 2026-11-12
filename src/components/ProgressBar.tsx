import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BORDER_RADIUS, toGradientCSS, GRADIENTS } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  style?: object;
  gradient?: readonly string[];
  animated?: boolean;
}

/**
 * Gradient progress bar that replaces the flat color progress bar.
 * Uses the app's purple-to-gold gradient for a vibrant fill effect.
 */
export function ProgressBar({
  progress,
  height = 4,
  style,
  gradient = GRADIENTS.primary,
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={[styles.container, { height }, style]}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundImage: toGradientCSS(gradient, 'horizontal'),
            },
          ]}
        />
      </View>
    </View>
  );
}

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  gradient?: readonly string[];
  children?: React.ReactNode;
  trackColor?: string;
  fillColor?: string;
}

/**
 * Circular progress ring for the reader header.
 * Fills as the user reads through the book.
 * Uses a border-image gradient approach compatible with React Native.
 */
export function CircularProgress({
  progress,
  size = 40,
  strokeWidth = 3,
  gradient,
  children,
  trackColor = 'rgba(0,0,0,0.08)',
}: CircularProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Use the last color of the gradient as the fill color for RN compatibility
  const fillColor = gradient?.[gradient.length - 1] || GRADIENTS.primary[GRADIENTS.primary.length - 1];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <View style={[styles.circularWrapper, { width: size, height: size }]}>
      {/* Track circle */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />
      {/* Progress overlay using clip */}
      <View
        style={[
          styles.circularProgressOverlay,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: fillColor,
            borderLeftColor: 'transparent',
            borderTopColor: 'transparent',
            transform: [
              { rotate: `${-90 + (clampedProgress / 100) * 360}deg` },
            ],
          },
        ]}
      />
      {/* Center content */}
      <View style={styles.circularContent}>
        {children}
      </View>
    </View>
  );
}

interface ReadingProgressProps {
  progress: number; // 0-100
  pagesRead?: number;
  totalPages?: number;
  timeSpent?: number; // minutes
  style?: object;
}

/**
 * Reading stats bar showing progress, pages, and time.
 */
export function ReadingProgress({
  progress,
  pagesRead,
  totalPages,
  timeSpent,
  style,
}: ReadingProgressProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <View style={[styles.readingProgress, style]}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(progress)}%</Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
        {pagesRead != null && totalPages != null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pagesRead}/{totalPages}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
        )}
        {timeSpent != null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(timeSpent)}</Text>
            <Text style={styles.statLabel}>Read</Text>
          </View>
        )}
      </View>
      <ProgressBar progress={progress} height={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    flex: 1,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  circularWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgressOverlay: {
    position: 'absolute',
  },
  circularContent: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readingProgress: {
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});

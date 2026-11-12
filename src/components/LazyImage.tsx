import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

// Use inline defaults to avoid module-level import issues in production R8 bundles
const C = { white: '#FFFFFF', deepNavy: '#080B2E', gray200: '#E5E7EB' };
const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };

export interface LazyImageProps {
  uri?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  style?: any;
  containerStyle?: any;
}

/**
 * Lazy Image Component
 *
 * Uses expo-image for built-in:
 * - Memory and disk caching with LRU eviction
 * - Progressive JPEG decoding
 * - Automatic memory management
 * - Smooth fade-in transitions
 *
 * Provides:
 * - Placeholder while loading
 * - Error fallback with icon
 */
export default function LazyImage({
  uri,
  width = 100,
  height = 140,
  borderRadius = R.md,
  style,
  containerStyle,
}: LazyImageProps) {
  const [error, setError] = useState(false);

  // Render placeholder
  const renderPlaceholder = () => (
    <View style={[styles.placeholder, { width, height, borderRadius }]}>
      <Ionicons name="book" size={32} color={C.white} />
    </View>
  );

  // No URI provided
  if (!uri) {
    return (
      <View style={[styles.container, containerStyle]}>
        {renderPlaceholder()}
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, containerStyle]}>
        {renderPlaceholder()}
      </View>
    );
  }

  // Loaded image with expo-image
  // expo-image handles caching, progressive loading, and memory management automatically
  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width, height, borderRadius },
          style,
        ]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        onError={() => setError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: C.gray200,
  },
  placeholder: {
    backgroundColor: C.deepNavy,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

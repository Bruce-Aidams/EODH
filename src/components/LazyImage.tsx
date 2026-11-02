import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { COLORS, BORDER_RADIUS } from '@/constants/theme';

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
 * Provides:
 * - Local caching of images to avoid re-downloads
 * - Placeholder while loading
 * - Error fallback with icon
 * - Automatic cache check before network request
 */
export default function LazyImage({
  uri,
  width = 100,
  height = 140,
  borderRadius = BORDER_RADIUS.md,
  style,
  containerStyle,
}: LazyImageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  // Cache key based on URI
  const cacheKey = uri ? `eodh_cover_${uri.replace(/[^a-zA-Z0-9]/g, '_')}.jpg` : null;
  const cachePath = cacheKey ? `${FileSystem.cacheDirectory}${cacheKey}` : null;

  useEffect(() => {
    if (!uri) return;

    let cancelled = false;

    // Check cache first
    const checkCache = async () => {
      try {
        const info = await FileSystem.getInfoAsync(cachePath!);
        if (info.exists && !cancelled) {
          setLocalUri(info.uri);
          return;
        }
      } catch (e) {
        // Cache check failed, continue with network load
      }

      // Load from network
      if (!cancelled) {
        loadImage();
      }
    };

    checkCache();

    return () => {
      cancelled = true;
    };
  }, [uri, cachePath]);

  const loadImage = async () => {
    if (!uri || loading) return;

    setLoading(true);
    setError(false);

    try {
      const downloadRes = await FileSystem.downloadAsync(uri, cachePath!);
      
      if (downloadRes.status === 200) {
        setLocalUri(downloadRes.uri);
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Render placeholder
  const renderPlaceholder = () => (
    <View style={[styles.placeholder, { width, height, borderRadius }]}>
      <Ionicons name="book" size={32} color={COLORS.white} />
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

  // Loading state
  if (loading && !localUri) {
    return (
      <View
        style={[
          styles.container,
          { width, height, borderRadius },
          styles.loadingContainer,
          containerStyle,
        ]}
      >
        <ActivityIndicator size="small" color={COLORS.royalPurple} />
      </View>
    );
  }

  // Error state or failed load
  if (error || !localUri) {
    return (
      <View style={[styles.container, containerStyle]}>
        {renderPlaceholder()}
      </View>
    );
  }

  // Loaded image
  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri: localUri }}
        style={[
          styles.image,
          { width, height, borderRadius },
          style,
        ]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: COLORS.gray200,
  },
  placeholder: {
    backgroundColor: COLORS.deepNavy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
});

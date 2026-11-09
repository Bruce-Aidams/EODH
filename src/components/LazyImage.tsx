import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Use inline defaults to avoid module-level import issues in production R8 bundles
const C = { white: '#FFFFFF', deepNavy: '#080B2E', gray200: '#E5E7EB', royalPurple: '#5415E8' };
const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };

// Lazy-load expo-file-system to avoid crashing if native module is unavailable
let cacheDirectory: string | null = null;
let getInfoAsync: ((uri: string) => any) | null = null;
let downloadAsync: ((uri: string, dest: string) => any) | null = null;
try {
  const FileSystem = require('expo-file-system/legacy');
  getInfoAsync = FileSystem.getInfoAsync;
  downloadAsync = FileSystem.downloadAsync;
  cacheDirectory = FileSystem.cacheDirectory || null;
} catch {
  // Fallback: skip caching
}

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
  borderRadius = R.md,
  style,
  containerStyle,
}: LazyImageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  // Cache key based on URI
  const cacheKey = uri ? `eodh_cover_${uri.replace(/[^a-zA-Z0-9]/g, '_')}.jpg` : null;
  const cachePath = cacheKey && cacheDirectory ? `${cacheDirectory}${cacheKey}` : null;

  useEffect(() => {
    if (!uri) return;

    let cancelled = false;

    // Check cache first (only if file system is available)
    const checkCache = async () => {
      if (!getInfoAsync || !cachePath) {
        // Skip caching, load directly from network
        if (!cancelled) loadImage();
        return;
      }
      try {
        const info = await getInfoAsync(cachePath);
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

    // If file system is available, try caching
    if (downloadAsync && cachePath) {
      setLoading(true);
      setError(false);

      try {
        const downloadRes = await downloadAsync(uri, cachePath);
        
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
    } else {
      // No caching available, just use the URI directly
      setLocalUri(uri);
    }
  };

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
        <ActivityIndicator size="small" color={C.royalPurple} />
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
    backgroundColor: C.gray200,
  },
  placeholder: {
    backgroundColor: C.deepNavy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.gray200,
  },
});

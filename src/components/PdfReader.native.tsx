import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions } from 'react-native';

// Use inline defaults to avoid module-level import issues in production R8 bundles
const C = { white: '#FFFFFF', royalPurple: '#5415E8', gray500: '#6B7280', error: '#EF4444' };
const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };

// Lazy-load the PDF module to avoid crashing in Expo Go where it's not available
let Pdf: any = null;
let pdfModuleAvailable = false;
try {
  Pdf = require('react-native-pdf-jsi').default || require('react-native-pdf-jsi');
  pdfModuleAvailable = !!Pdf;
} catch {
  // Module not available (e.g., Expo Go)
  pdfModuleAvailable = false;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PdfReaderProps {
  sourceUri: string;
  onPageChange?: (page: number, totalPages: number) => void;
  onLoadComplete?: (totalPages: number) => void;
  onError?: (error: any) => void;
  style?: any;
}

/**
 * PDF Reader component using react-native-pdf-jsi.
 *
 * Provides:
 * - Smooth PDF rendering
 * - Page navigation
 * - Page number indicator
 * - Pinch-to-zoom
 * - Error handling
 */
export default function PdfReader({
  sourceUri,
  onPageChange,
  onLoadComplete,
  onError,
  style,
}: PdfReaderProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<any>(null);

  const source = { uri: sourceUri, cache: true };

  const handleLoadComplete = useCallback(
    (numberOfPages: number, filePath?: string, size?: any) => {
      setTotalPages(numberOfPages);
      setLoading(false);
      onLoadComplete?.(numberOfPages);
    },
    [onLoadComplete]
  );

  const handlePageChanged = useCallback(
    (page: number, numberOfPages: number) => {
      setCurrentPage(page);
      onPageChange?.(page, numberOfPages);
    },
    [onPageChange]
  );

  const handleError = useCallback(
    (err: any) => {
      const errorMsg = err?.message || 'Failed to load PDF';
      setError(errorMsg);
      setLoading(false);
      onError?.(err);
    },
    [onError]
  );

  const goToPage = useCallback((page: number) => {
    if (pdfRef.current && page >= 1 && page <= totalPages) {
      pdfRef.current.setPage(page);
    }
  }, [totalPages]);

  const goNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const goPrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  if (!pdfModuleAvailable) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorTitle}>PDF Viewer Not Available</Text>
        <Text style={styles.errorText}>
          PDF viewing requires a development build. Please run the app with npx expo run:android instead of Expo Go.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorTitle}>Failed to Load PDF</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {Pdf && (
        <Pdf
          ref={pdfRef}
          source={source}
          style={styles.pdf}
          onLoadComplete={handleLoadComplete}
          onPageChanged={handlePageChanged}
          onError={handleError}
          onPressSearch={() => {}}
          showPage={false}
          horizontal={false}
          enablePaging={true}
          scrollEnabled={true}
          spacing={0}
        />
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.royalPurple} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}
      {/* Page indicator */}
      {totalPages > 0 && (
        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            {currentPage} / {totalPages}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.white,
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    marginTop: S.md,
    fontSize: 14,
    color: C.gray500,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: S.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.full,
  },
  pageText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.error,
    marginBottom: S.sm,
  },
  errorText: {
    fontSize: 14,
    color: C.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});

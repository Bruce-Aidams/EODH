import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions } from 'react-native';
import PdfModule from 'react-native-pdf-jsi';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';

const Pdf = PdfModule.default;

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
      <Pdf
        ref={pdfRef}
        source={source}
        style={styles.pdf}
        onLoadComplete={handleLoadComplete}
        onPageChanged={handlePageChanged}
        onError={handleError}
        onPressSearch={() => {}}
        showPage={false}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
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
    backgroundColor: COLORS.white,
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.gray500,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: SPACING.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  pageText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});

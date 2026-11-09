import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

// Use inline defaults to avoid module-level import issues in production R8 bundles
const C = { white: '#FFFFFF', gray500: '#6B7280', error: '#EF4444' };
const S = { sm: 8, xl: 32 };

/**
 * Web fallback for PDF Reader.
 * react-native-pdf-jsi is a native-only module and cannot run on web.
 */
export default function PdfReader() {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>PDF Viewer Not Available</Text>
      <Text style={styles.errorText}>
        PDF viewing is not supported on web. Please use the mobile app to view PDFs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.white,
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

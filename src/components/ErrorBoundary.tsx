import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Use inline defaults to avoid module-level import issues in production R8 bundles
const C = { deepNavy: '#080B2E', royalPurple: '#5415E8', white: '#FFFFFF', lightBackground: '#F6F5FC' };
const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
const FS = { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

/**
 * Error Boundary Component for EODH
 *
 * Catches JavaScript errors in child components and displays
 * a fallback UI instead of crashing the app.
 *
 * Features:
 * - Catches rendering errors in child components
 * - Displays user-friendly error message
 * - Provides retry button to reset state
 * - Logs errors for debugging
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Please try again.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
    backgroundColor: C.lightBackground,
  },
  icon: {
    fontSize: 48,
    marginBottom: S.md,
  },
  title: {
    fontSize: FS.xl,
    fontWeight: '700',
    color: C.deepNavy,
    marginBottom: S.sm,
  },
  message: {
    fontSize: FS.md,
    color: C.deepNavy,
    textAlign: 'center',
    marginBottom: S.md,
  },
  errorDetails: {
    fontSize: FS.sm,
    color: C.deepNavy,
    opacity: 0.6,
    fontFamily: 'monospace',
    marginBottom: S.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: C.royalPurple,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: R.md,
  },
  buttonText: {
    color: C.white,
    fontSize: FS.md,
    fontWeight: '600',
  },
});

export default ErrorBoundary;

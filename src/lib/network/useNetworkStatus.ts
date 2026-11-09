import { useMemo } from 'react';

/**
 * Network status hook for EODH.
 *
 * Provides real-time network connectivity status for offline mode support.
 * Uses the `useNetInfo` hook from @react-native-community/netinfo v12+ which
 * handles subscriptions automatically and avoids infinite loop issues.
 */

export type NetworkStatus = 'connected' | 'disconnected' | 'unknown';

export interface NetworkState {
  isInternetReachable: boolean | null;
  isConnected: boolean;
  status: NetworkStatus;
  isOffline: boolean;
}

// Lazy-load NetInfo to avoid crashing if the native module is unavailable
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default || require('@react-native-community/netinfo');
} catch {
  // NetInfo not available
}

export function useNetworkStatus(): NetworkState {
  // Use the built-in useNetInfo hook which handles subscriptions properly
  const netInfo = NetInfo?.useNetInfo?.() ?? {
    isConnected: true,
    isInternetReachable: null,
  };

  // Derive state from netInfo using useMemo to avoid unnecessary re-renders
  const state = useMemo<NetworkState>(() => {
    const isConnected = netInfo.isConnected ?? false;
    const isInternetReachable = netInfo.isInternetReachable;

    let status: NetworkStatus = 'unknown';
    if (isConnected && isInternetReachable !== false) {
      status = 'connected';
    } else if (!isConnected || isInternetReachable === false) {
      status = 'disconnected';
    }

    return {
      isInternetReachable,
      isConnected,
      status,
      isOffline: !isConnected || isInternetReachable === false,
    };
  }, [netInfo.isConnected, netInfo.isInternetReachable]);

  return state;
}

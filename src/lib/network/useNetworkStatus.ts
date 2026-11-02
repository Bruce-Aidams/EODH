import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Network status hook for EODH.
 * 
 * Provides real-time network connectivity status for offline mode support.
 */

export type NetworkStatus = 'connected' | 'disconnected' | 'unknown';

export interface NetworkState {
  isInternetReachable: boolean | null;
  isConnected: boolean;
  status: NetworkStatus;
  isOffline: boolean;
}

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isInternetReachable: null,
    isConnected: true,
    status: 'unknown',
    isOffline: false,
  });

  const handleConnectivityChange = useCallback((state: any) => {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable;
    
    let status: NetworkStatus = 'unknown';
    if (isConnected && isInternetReachable !== false) {
      status = 'connected';
    } else if (!isConnected || isInternetReachable === false) {
      status = 'disconnected';
    }

    setState({
      isInternetReachable,
      isConnected,
      status,
      isOffline: !isConnected || isInternetReachable === false,
    });
  }, []);

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then(handleConnectivityChange);

    // Subscribe to changes
    const subscription = NetInfo.addEventListener(handleConnectivityChange);

    return () => {
      subscription.remove();
    };
  }, [handleConnectivityChange]);

  return state;
}

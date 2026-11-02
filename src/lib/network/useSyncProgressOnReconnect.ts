import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLibraryStore } from '@/stores/libraryStore';

/**
 * Sync Reading Progress Hook
 *
 * Monitors network connectivity and syncs reading/listening progress
 * when the device reconnects to the internet.
 *
 * When offline, progress is stored locally in the Zustand store.
 * When online, pending progress updates are sent to Supabase.
 */
export function useSyncProgressOnReconnect() {
  const { user, isAuthenticated } = useAuthStore();
  const { fetchReadingProgress, fetchListeningProgress } = useLibraryStore();
  const lastSyncTime = useRef<number>(0);
  const isSyncing = useRef<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let netInfoUnsubscribe: (() => void) | undefined;

    // Import netinfo dynamically to avoid issues
    const setupNetworkListener = async () => {
      try {
        const NetInfo = require('@react-native-community/netinfo');
        
        netInfoUnsubscribe = NetInfo.addEventListener(async (state: any) => {
          // User just came back online
          if (state.isConnected && !state.isInternetReachable) {
            // Internet reachability is unknown, wait a moment
            return;
          }
          
          if (state.isConnected && state.isInternetReachable !== false) {
            // Check if we should sync (avoid too frequent syncs)
            const now = Date.now();
            const timeSinceLastSync = now - lastSyncTime.current;
            
            // Only sync if at least 30 seconds have passed since last sync
            if (timeSinceLastSync < 30000 || isSyncing.current) {
              return;
            }
            
            isSyncing.current = true;
            lastSyncTime.current = now;
            
            try {
              // Refresh reading and listening progress from server
              await Promise.all([
                fetchReadingProgress(),
                fetchListeningProgress()
              ]);
              
              console.log('[EODH] Progress synced on reconnect');
            } catch (error) {
              console.error('[EODH] Error syncing progress on reconnect:', error);
            } finally {
              isSyncing.current = false;
            }
          }
        });
      } catch (error) {
        console.error('[EODH] Error setting up network listener:', error);
      }
    };

    setupNetworkListener();

    // Sync on mount if online
    const syncOnMount = async () => {
      try {
        const NetInfo = require('@react-native-community/netinfo');
        const state = await NetInfo.fetch();
        
        if (state.isConnected && state.isInternetReachable !== false) {
          await Promise.all([
            fetchReadingProgress(),
            fetchListeningProgress()
          ]);
        }
      } catch (error) {
        console.error('[EODH] Error syncing on mount:', error);
      }
    };

    syncOnMount();

    // Cleanup
    return () => {
      if (netInfoUnsubscribe) {
        netInfoUnsubscribe();
      }
    };
  }, [isAuthenticated, user, fetchReadingProgress, fetchListeningProgress]);
}

import { useEffect } from 'react';
import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

/** True when the phone reports no connection. `null` (not known yet) counts as online, so nothing flashes on launch. */
export function isOfflineState(s: { isConnected?: boolean | null; isInternetReachable?: boolean | null } | null | undefined): boolean {
  if (!s) return false;
  return s.isConnected === false || s.isInternetReachable === false;
}

export function useIsOffline(): boolean {
  const state = Network.useNetworkState();
  return isOfflineState(state);
}

/** Tells React Query when the phone is offline, so it pauses requests and refetches on reconnect instead of failing. */
export function useWireOnlineManager(): void {
  const offline = useIsOffline();
  useEffect(() => {
    onlineManager.setOnline(!offline);
  }, [offline]);
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getNotificationPrefs, putNotificationPrefs, registerPushToken, removePushToken, type NotificationPrefs } from '@/src/api/discover';
import { isExpoPushToken, routeFromNotification, shouldRegisterSilently, type PermissionState } from './logic';

/**
 * expo-notifications is loaded lazily and defensively: in Expo Go / a build
 * without the native module / web it is simply "unavailable" and the rest of the
 * app is unaffected.
 */
type Notifications = typeof import('expo-notifications');
async function loadNotifications(): Promise<Notifications | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

type Ctx = {
  permission: PermissionState;
  prefs: NotificationPrefs | null;
  /** Ask for permission (if needed), register the token, and turn pushes on. */
  enable: () => Promise<'enabled' | 'denied' | 'unavailable' | 'error'>;
  disable: () => Promise<void>;
  setPref: (p: Partial<NotificationPrefs>) => Promise<void>;
  openSystemSettings: () => void;
  /** Remove this device's token (call BEFORE signing out so the account stops receiving pushes here). */
  unregister: () => Promise<void>;
};

const PushContext = createContext<Ctx>({
  permission: 'unavailable', prefs: null, enable: async () => 'unavailable', disable: async () => {}, setPref: async () => {}, openSystemSettings: () => {}, unregister: async () => {},
});

export function PushProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const [permission, setPermission] = useState<PermissionState>('unavailable');
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const token = useRef<string | null>(null);

  const fetchToken = useCallback(async (N: Notifications): Promise<string | null> => {
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const t = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return isExpoPushToken(t.data) ? t.data : null;
  }, []);

  const register = useCallback(async (N: Notifications) => {
    try {
      const t = await fetchToken(N);
      if (!t) return false;
      token.current = t;
      await registerPushToken(t, Platform.OS === 'ios' ? 'ios' : 'android', Device.osBuildId ?? undefined);
      return true;
    } catch {
      return false;
    }
  }, [fetchToken]);

  // startup: read state; register only if already permitted
  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setPrefs(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [N, p] = await Promise.all([loadNotifications(), getNotificationPrefs().catch(() => null)]);
      if (cancelled) return;
      setPrefs(p);
      if (!N) return setPermission('unavailable');
      const perm = (await N.getPermissionsAsync()).status as PermissionState;
      if (cancelled) return;
      setPermission(perm);
      if (shouldRegisterSilently(perm, p?.push_enabled)) void register(N);
    })();
    return () => { cancelled = true; };
  }, [auth.status, register]);

  // Tap on a notification → open its in-app route (validated).
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    (async () => {
      const N = await loadNotifications();
      if (!N) return;
      N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
      sub = N.addNotificationResponseReceivedListener((resp) => {
        const route = routeFromNotification(resp.notification.request.content.data);
        if (route) router.push(route as Href);
      });
    })();
    return () => sub?.remove();
  }, [router]);

  const enable = useCallback<Ctx['enable']>(async () => {
    const N = await loadNotifications();
    if (!N) return 'unavailable';
    let perm = (await N.getPermissionsAsync()).status as PermissionState;
    if (perm === 'undetermined') perm = (await N.requestPermissionsAsync()).status as PermissionState;
    setPermission(perm);
    if (perm !== 'granted') return 'denied';
    const ok = await register(N);
    if (!ok) return 'error';
    setPrefs((await putNotificationPrefs({ push_enabled: true }).catch(() => null)) ?? { ...(prefs as NotificationPrefs), push_enabled: true });
    return 'enabled';
  }, [prefs, register]);

  const disable = useCallback(async () => {
    if (token.current) await removePushToken(token.current).catch(() => {});
    token.current = null;
    setPrefs((await putNotificationPrefs({ push_enabled: false }).catch(() => null)) ?? { ...(prefs as NotificationPrefs), push_enabled: false });
  }, [prefs]);

  const setPref = useCallback(async (p: Partial<NotificationPrefs>) => {
    const next = await putNotificationPrefs(p);
    setPrefs(next);
  }, []);

  const unregister = useCallback(async () => {
    if (token.current) await removePushToken(token.current).catch(() => {});
    token.current = null;
  }, []);

  const value = useMemo<Ctx>(() => ({ permission, prefs, enable, disable, setPref, unregister, openSystemSettings: () => void Linking.openSettings() }), [permission, prefs, enable, disable, setPref, unregister]);
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export const usePush = () => useContext(PushContext);

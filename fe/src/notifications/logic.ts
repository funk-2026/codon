/**
 * Pure push-notification rules (no native modules) so they are unit-tested.
 */
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

export const isExpoPushToken = (t: unknown): t is string => typeof t === 'string' && EXPO_TOKEN_RE.test(t);

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * Register a token silently only when the OS permission is ALREADY granted and
 * the student hasn't turned pushes off in Codon. We never trigger the system
 * permission prompt at launch — that happens in Settings, when they ask for it.
 */
export function shouldRegisterSilently(perm: PermissionState, pushEnabledPref: boolean | undefined): boolean {
  return perm === 'granted' && pushEnabledPref !== false;
}

/** In-app routes a notification is allowed to open (server data is untrusted). */
const ALLOWED = ['/(student)/'];

export function routeFromNotification(data: unknown): string | null {
  const route = (data as { route?: unknown } | null | undefined)?.route;
  if (typeof route !== 'string') return null;
  const r = route.trim();
  if (!r.startsWith('/') || r.includes('://') || r.includes('..')) return null;
  return ALLOWED.some((p) => r.startsWith(p)) ? r : null;
}

/** Human copy for the settings toggle given the OS state. */
export function pushStatusCopy(perm: PermissionState, enabled: boolean): { caption: string; canToggle: boolean } {
  if (perm === 'unavailable') return { caption: 'Not available on this device or build', canToggle: false };
  if (perm === 'denied') return { caption: 'Turned off in system settings — tap to open settings', canToggle: true };
  return { caption: enabled ? 'On' : 'Get reminders and updates on your reports', canToggle: true };
}

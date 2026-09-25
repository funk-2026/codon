import Constants from 'expo-constants';
import { getAccessToken } from '../auth/tokenStore';
import { DeviceEventEmitter } from 'react-native';

/**
 * Resolve the API base URL dynamically.
 *
 * `Constants.expoConfig?.hostUri` automatically gets your dev machine's LAN IP
 * (e.g. 192.168.x.x) when running Expo Go / physical device.
 */
// const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
// const DEV_HOST = debuggerHost ? debuggerHost.split(':')[0] : '192.168.0.7';
const DEV_HOST = '192.168.0.6';

export const API_BASE = false
  ? `http://${DEV_HOST}:8080/api/v1`
  : 'https://codon-production-2652.up.railway.app/api/v1';

/**
 * Thin wrapper around `fetch` that sets common defaults.
 * Automatically attaches the Bearer token from secure storage.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = await getAccessToken();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !url.includes('/auth/otp')) {
      DeviceEventEmitter.emit('onTokenExpired');
    }
    const b = body as { error?: string; code?: string; details?: unknown };
    throw new ApiError(b.error ?? res.statusText, res.status, b.code, b.details);
  }

  return body as T;
}

/**
 * `code` is the backend's stable machine-readable failure code (e.g.
 * `pool_too_small`, `attempt_expired`) — switch on it, never on `message`.
 * `details` carries structured context (suggestions, missing fields, …).
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Cursor-paginated list envelope used by the newer backend endpoints. */
export type Paginated<T> = { items: T[]; next_cursor: string | null };

/** Builds a `?a=1&b=2` query string, skipping undefined/empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Random idempotency key for POSTs that must not double-submit on retry. */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

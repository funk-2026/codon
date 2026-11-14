import Constants from 'expo-constants';
import { getAccessToken } from '../auth/tokenStore';
import { DeviceEventEmitter } from 'react-native';
import { buildHeaders } from './headers';

/**
 * Resolve the API base URL dynamically from environment / app config.
 * Checks in order:
 *  1. process.env.EXPO_PUBLIC_SERVER_URL
 *  2. process.env.SERVER_URL
 *  3. process.env.server_url
 *  4. Constants.expoConfig?.extra?.serverUrl
 *  5. Constants.expoConfig?.extra?.server_url
 *  6. Constants.expoConfig?.extra?.SERVER_URL
 *  7. Fallback to production server URL
 */
function resolveApiBase(): string {
  const rawUrl =
    process.env.EXPO_PUBLIC_SERVER_URL ||
    process.env.SERVER_URL ||
    process.env.server_url ||
    Constants.expoConfig?.extra?.serverUrl ||
    Constants.expoConfig?.extra?.server_url ||
    Constants.expoConfig?.extra?.SERVER_URL ||
    'https://codon-production-2652.up.railway.app';

  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return 'https://codon-production-2652.up.railway.app/api/v1';
  }
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

export const API_BASE = resolveApiBase();

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
  // `...options` MUST come before `headers` here — options.headers (e.g. a
  // caller's Idempotency-Key) must be merged BY buildHeaders, never allowed to
  // replace the whole headers object outright (see headers.ts for why).
  const res = await fetch(url, {
    ...options,
    headers: buildHeaders(token, options.headers as Record<string, string> | undefined),
  });

  // A body that isn't JSON is treated as empty — except when the caller aborted
  // mid-read: that must surface as an AbortError, never as an empty "success".
  let body: unknown = {};
  try {
    body = await res.json();
  } catch (e) {
    if (options.signal?.aborted) throw e;
  }

  if (!res.ok) {
    if (res.status === 401 && !url.includes('/auth/otp')) {
      DeviceEventEmitter.emit('onTokenExpired');
    }
    const b = body as { error?: string; code?: string; details?: unknown };
    if (res.status === 403 && b.code === 'account_suspended') {
      DeviceEventEmitter.emit('onAccountSuspended');
    }
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

/**
 * Go encodes an empty slice as JSON `null`, not `[]`. API modules wrap list
 * fields with this so screens can always call .map/.length safely.
 */
export const arr = <T,>(v: T[] | null | undefined): T[] => v ?? [];

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

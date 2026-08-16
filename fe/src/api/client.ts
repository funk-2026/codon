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
const DEV_HOST = '192.168.0.7';

export const API_BASE = __DEV__
  ? `http://${DEV_HOST}:8080/api/v1`
  : 'https://api.codon.app/api/v1';

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
    const msg = (body as Record<string, string>).error ?? res.statusText;
    throw new ApiError(msg, res.status);
  }

  return body as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

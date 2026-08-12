

/**
 * Resolve the API base URL.
 *
 * When testing on a physical device via Expo, use your machine's LAN IP
 * so the phone (on the same WiFi) can reach the Docker backend.
 *
 * • Physical device:   Use LAN IP (e.g. 192.168.x.x)
 * • Android emulator:  `10.0.2.2` maps to host machine's localhost
 * • iOS simulator:     plain `localhost` works
 */
const DEV_HOST = '192.168.0.6'; // ← your machine's LAN IP

export const API_BASE = __DEV__
  ? `http://${DEV_HOST}:8080/api/v1`
  : 'https://api.codon.app/api/v1';     // TODO: replace with production URL

/**
 * Thin wrapper around `fetch` that sets common defaults.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
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

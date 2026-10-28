/**
 * Builds fetch headers: JSON content-type + bearer auth, with any per-call
 * headers layered on top.
 *
 * Pure on purpose (no imports) so it can be unit-tested without pulling in
 * react-native/expo. It exists to prevent a real bug: naively writing
 * `fetch(url, { headers: {...}, ...options })` lets `options.headers` — set
 * whenever a caller passes a custom header like `Idempotency-Key` — silently
 * *replace* the whole headers object instead of merging into it, dropping
 * `Authorization` off the request. The server then 401s, and the app reads
 * any 401 as "session expired" and signs the user out. That is exactly what
 * happened the first time a caller (custom-test generate) added a header.
 */
export function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

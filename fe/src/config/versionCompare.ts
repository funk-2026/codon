// Pure so it can be unit-tested without React Native.
/** `true` when `current` (like "1.0.0") is older than `min`. Blank or malformed `min` never blocks. */
export function isOlderThan(current: string, min: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(min) || !/^\d+\.\d+\.\d+$/.test(current)) return false;
  const a = current.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

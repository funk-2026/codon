// "2:30" or "90" (seconds) or "1:02:03" -> seconds. Null when it is not a time.
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length > 1 && nums.slice(1).some((n) => n > 59)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export const formatDuration = (s?: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

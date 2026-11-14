// Pure helpers for "publish at" (no React Native, so they can be unit-tested).

/** "03/05/2027" + "18:30" → a Date in the device's time zone, or null when either part is not real. */
export function parseSchedule(dateText: string, timeText: string): Date | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateText.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
  if (!d || !t) return null;
  const [day, mo, y, h, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, day, h, mi, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== day) return null;
  return date;
}

/** Why a typed schedule can't be used, or null when it is fine. */
export function scheduleError(dateText: string, timeText: string, now: Date = new Date()): string | null {
  const at = parseSchedule(dateText, timeText);
  if (!at) return 'Use DD/MM/YYYY for the date and HH:MM (24-hour) for the time.';
  if (at.getTime() <= now.getTime() + 60_000) return 'Pick a time in the future.';
  return null;
}

/** "Sun 3 May, 18:30" for showing a scheduled time. */
export function formatScheduled(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
}

/** "about 6 hours", "about 2 days" from a median wait in hours; null when there is no estimate. */
export function describeWait(hours?: number | null): string | null {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours < 1) return 'under an hour';
  if (hours < 36) return `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `about ${days} day${days === 1 ? '' : 's'}`;
}

/** The inverse of parseSchedule: an ISO time as the "DD/MM/YYYY" and "HH:MM" a teacher types, in the phone's time zone. */
export function toScheduleInputs(iso?: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: '', time: '' };
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

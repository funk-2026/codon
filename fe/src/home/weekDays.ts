/** Pure helper for the Home week strip (kept free of React Native so it can be unit-tested). */

export type AttemptLike = { status?: string; submitted_at?: string | null };

const DAY = 24 * 60 * 60 * 1000;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The last 7 local days, oldest first, with whether any test was submitted that day. */
export function weekDays(attempts: AttemptLike[], now: Date = new Date()): { label: string; done: boolean; today: boolean }[] {
  const today = startOfDay(now);
  const doneDays = new Set<number>();
  for (const a of attempts) {
    if (a.status !== 'submitted' || !a.submitted_at) continue;
    const t = new Date(a.submitted_at);
    if (!Number.isNaN(t.getTime())) doneDays.add(startOfDay(t));
  }
  return Array.from({ length: 7 }, (_, i) => {
    const day = today - (6 - i) * DAY;
    return { label: LETTERS[new Date(day).getDay()], done: doneDays.has(day), today: i === 6 };
  });
}

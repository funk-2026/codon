/**
 * Daily question goal (CM-A10). "Answered today" = questions answered in
 * attempts submitted today (device-local day). Custom tests count like any
 * other attempt; the streak itself comes from the server (`day_streak`).
 */

export const GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_GOAL = 20;
export const GOAL_KEY = 'daily-question-goal';

type AttemptLike = { status?: string; submitted_at?: string | null; correct_count?: number | null; wrong_count?: number | null };

const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function answeredToday(attempts: AttemptLike[], now: Date = new Date()): number {
  let n = 0;
  for (const a of attempts) {
    if (a.status !== 'submitted' || !a.submitted_at) continue;
    const at = new Date(a.submitted_at);
    if (Number.isNaN(at.getTime()) || !sameLocalDay(at, now)) continue;
    n += (a.correct_count ?? 0) + (a.wrong_count ?? 0);
  }
  return n;
}

/** Stored goal, or the default when missing/invalid. */
export function normalizeGoal(v: unknown): number {
  return typeof v === 'number' && (GOAL_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT_GOAL;
}

// Pure helpers for the Home streak card: the Monday-to-Sunday week and a month of daily question counts.
import { monthGrid } from '@/src/components/calendar';

export type AttemptDay = { status?: string; submitted_at?: string | null; correct_count?: number | null; wrong_count?: number | null };
export type DayCount = { mcqs: number; tests: number };

const p2 = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Questions answered and tests submitted per local day, from submitted attempts only. */
export function dailyCounts(attempts: AttemptDay[]): Map<string, DayCount> {
  const out = new Map<string, DayCount>();
  for (const a of attempts) {
    if (a.status !== 'submitted' || !a.submitted_at) continue;
    const t = new Date(a.submitted_at);
    if (Number.isNaN(t.getTime())) continue;
    const k = dayKey(t);
    const c = out.get(k) ?? { mcqs: 0, tests: 0 };
    c.mcqs += (a.correct_count ?? 0) + (a.wrong_count ?? 0);
    c.tests += 1;
    out.set(k, c);
  }
  return out;
}

export type WeekDay = { label: string; key: string; active: boolean; today: boolean; future: boolean };
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The current week, Monday first, with which days had activity. */
export function currentWeek(counts: Map<string, DayCount>, now: Date = new Date()): WeekDay[] {
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const todayKey = dayKey(now);
  return LETTERS.map((label, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(d);
    return { label, key, active: (counts.get(key)?.tests ?? 0) > 0, today: key === todayKey, future: d > now && key !== todayKey };
  });
}

export type MonthCell = { day: number; key: string; count?: DayCount; today: boolean } | null;

/** A month as weeks of cells, Monday first, each cell carrying that day's counts. */
export function monthCells(year: number, month: number, counts: Map<string, DayCount>, now: Date = new Date()): MonthCell[][] {
  const todayKey = dayKey(now);
  return monthGrid(year, month).map((week) =>
    week.map((day) => {
      if (day == null) return null;
      const key = dayKey(new Date(year, month, day));
      return { day, key, count: counts.get(key), today: key === todayKey };
    }),
  );
}

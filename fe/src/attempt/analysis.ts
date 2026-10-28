import type { Confidence, ReviewItem } from '@/src/api/attempts';

/**
 * Post-test analytics computed on the device from the full review (CM-A5,
 * CM-A7). Pure so they are unit-tested; screens hide a widget when its
 * function returns null (not enough data) instead of showing zeros.
 */

type Item = Pick<ReviewItem, 'position' | 'selected_option' | 'is_correct' | 'time_spent_seconds' | 'confidence' | 'question_meta'>;

export type TimeAnalysis = {
  /** Mean seconds over answered questions that have a recorded time. */
  avgSeconds: number;
  totalSeconds: number;
  /** Up to 3 longest answered questions, slowest first. */
  slowest: { position: number; seconds: number; correct: boolean }[];
  /** Per subject, slowest average first; only subjects with ≥2 timed answers. */
  bySubject: { name: string; avgSeconds: number; count: number }[];
  /** Wrong answers given much faster than usual — likely rushed. */
  rushedWrong: number;
  /** Answers that took more than twice the average (and at least a minute). */
  stuck: number;
};

const MIN_TIMED = 3;

export function timeAnalysis(items: Item[]): TimeAnalysis | null {
  const timed = items.filter((i) => i.selected_option && (i.time_spent_seconds ?? 0) > 0);
  if (timed.length < MIN_TIMED) return null;
  const secs = (i: Item) => i.time_spent_seconds ?? 0;
  const total = timed.reduce((n, i) => n + secs(i), 0);
  const avg = total / timed.length;

  const slowest = [...timed]
    .sort((a, b) => secs(b) - secs(a) || a.position - b.position)
    .slice(0, 3)
    .map((i) => ({ position: i.position, seconds: secs(i), correct: i.is_correct === true }));

  const groups = new Map<string, { total: number; count: number }>();
  for (const i of timed) {
    const name = i.question_meta?.subject;
    if (!name) continue;
    const g = groups.get(name) ?? { total: 0, count: 0 };
    g.total += secs(i);
    g.count += 1;
    groups.set(name, g);
  }
  const bySubject = [...groups.entries()]
    .filter(([, g]) => g.count >= 2)
    .map(([name, g]) => ({ name, avgSeconds: g.total / g.count, count: g.count }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds);

  const rushedLimit = Math.max(10, avg * 0.4);
  const rushedWrong = timed.filter((i) => i.is_correct === false && secs(i) <= rushedLimit).length;
  const stuck = timed.filter((i) => secs(i) >= Math.max(60, avg * 2)).length;

  return { avgSeconds: avg, totalSeconds: total, slowest, bySubject, rushedWrong, stuck };
}

export type ConfidenceRow = { key: Confidence; correct: number; wrong: number };

export type ConfidenceMatrix = {
  rows: ConfidenceRow[];
  /** Marked "sure" but wrong — the most important misconceptions to revisit. */
  confidentWrong: number;
  /** Marked unsure/guess but right — knowledge the student under-rates. */
  unsureRight: number;
  /** How many answered questions carried a confidence mark. */
  marked: number;
};

const ORDER: Confidence[] = ['sure', 'unsure', 'guess'];

export function confidenceMatrix(items: Item[]): ConfidenceMatrix | null {
  const marked = items.filter((i) => i.selected_option && i.confidence && i.is_correct != null);
  if (marked.length === 0) return null;
  const rows = ORDER.map((key) => {
    const r = marked.filter((i) => i.confidence === key);
    return { key, correct: r.filter((i) => i.is_correct).length, wrong: r.filter((i) => !i.is_correct).length };
  });
  const by = Object.fromEntries(rows.map((r) => [r.key, r])) as Record<Confidence, ConfidenceRow>;
  return {
    rows,
    confidentWrong: by.sure.wrong,
    unsureRight: by.unsure.correct + by.guess.correct,
    marked: marked.length,
  };
}

/** "45s", "2m 05s", "1h 02m". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

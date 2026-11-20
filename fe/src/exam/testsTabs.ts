import type { ExamCard, ExamKind, GrandAttempt } from '@/src/api/exams';
import { KIND_SHORT } from './logic';

/** The three Tests tabs. Full-length mocks and previous-year papers are Grand Tests; chapter and part tests are Mini; subject tests are Subject-wise. */
export type TestTab = 'grand' | 'mini' | 'subject';
export type TestView = 'live' | 'library' | 'attempted';

export const TEST_TABS: { key: TestTab; label: string }[] = [
  { key: 'grand', label: 'Grand Test' },
  { key: 'mini', label: 'Mini Test' },
  { key: 'subject', label: 'Subject-wise' },
];
/** The same three views on every tab, so a student learns them once. */
const VIEWS: { key: TestView; label: string }[] = [
  { key: 'live', label: 'Live & upcoming' },
  { key: 'library', label: 'Library' },
  { key: 'attempted', label: 'Attempted' },
];
export const TEST_VIEWS: Record<TestTab, { key: TestView; label: string }[]> = { grand: VIEWS, mini: VIEWS, subject: VIEWS };

const TAB_OF: Record<ExamKind, TestTab> = { full: 'grand', pyq: 'grand', part: 'mini', chapter: 'mini', subject: 'subject' };
export const tabOf = (c: ExamCard): TestTab => TAB_OF[c.kind] ?? 'mini';

const taken = (c: ExamCard) => c.my_attempt?.status === 'submitted';

export function viewOf(c: ExamCard): TestView {
  if (taken(c)) return 'attempted';
  if (c.phase === 'live' || c.phase === 'upcoming') return 'live';
  return 'library';
}

/** The date a card is filed under: its live start, my submission, a previous-year paper's exam year, then when it was added. */
export function cardTime(c: ExamCard): number | null {
  const iso = c.opens_at ?? c.my_attempt?.submitted_at;
  if (iso) return new Date(iso).getTime();
  if (c.exam_year) return new Date(c.exam_year, 5, 1).getTime();
  return c.created_at ? new Date(c.created_at).getTime() : null;
}

export type MonthGroup = { key: string; title: string; cards: ExamCard[]; current?: boolean };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Counts of each tab's attempted tests, for badges. */
export const countTab = (cards: ExamCard[], tab: TestTab, view: TestView) => cards.filter((c) => tabOf(c) === tab && viewOf(c) === view).length;

/** What a card covers, as its first line: the subject and chapter when it has them, else its type. */
export function cardEyebrow(c: ExamCard): string {
  const sub = c.subject_name;
  const ch = c.chapter_name;
  if (c.kind === 'subject') return sub ?? KIND_SHORT.subject;
  if (c.kind === 'chapter') return [sub, ch].filter(Boolean).join(' · ') || KIND_SHORT.chapter;
  if (c.kind === 'part') return sub ? `${sub} · ${KIND_SHORT.part}` : KIND_SHORT.part;
  if (c.kind === 'pyq') return c.exam_year ? `${KIND_SHORT.pyq} · ${c.exam_year}` : KIND_SHORT.pyq;
  return KIND_SHORT.full;
}

/**
 * Cards of one tab and view, grouped by month. `year` limits it to one year (the Grand Test library, which is
 * browsed by year); `null` lists every year, with the year in each heading. Upcoming tests list the soonest month
 * first, the rest newest first. Tests with no date sit in an "Undated" group so nothing is hidden.
 */
export function monthGroups(cards: ExamCard[], tab: TestTab, view: TestView, year: number | null, now: Date = new Date()): MonthGroup[] {
  const list = cards.filter((c) => tabOf(c) === tab && viewOf(c) === view);
  const byMonth = new Map<number, ExamCard[]>();
  const undated: ExamCard[] = [];
  for (const c of list) {
    const t = cardTime(c);
    if (t == null) {
      undated.push(c);
      continue;
    }
    const d = new Date(t);
    if (year != null && d.getFullYear() !== year) continue;
    const k = d.getFullYear() * 12 + d.getMonth();
    byMonth.set(k, [...(byMonth.get(k) ?? []), c]);
  }
  const asc = view === 'live';
  const months = [...byMonth.keys()].sort((a, b) => (asc ? a - b : b - a));
  const out: MonthGroup[] = months.map((k) => {
    const y = Math.floor(k / 12);
    const m = k % 12;
    return {
      key: `${y}-${m}`,
      title: `${MONTHS[m]} ${y}`,
      current: now.getFullYear() === y && now.getMonth() === m,
      cards: (byMonth.get(k) ?? []).sort((a, b) => ((cardTime(a) ?? 0) - (cardTime(b) ?? 0)) * (asc ? 1 : -1)),
    };
  });
  if (undated.length) out.push({ key: 'undated', title: 'Undated', cards: undated.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })) });
  return out;
}

/** Mini and Subject-wise tests are a library, not a calendar: grouped by subject, then chapter and title. */
export function subjectGroups(cards: ExamCard[], tab: TestTab, view: TestView): MonthGroup[] {
  const by = new Map<string, ExamCard[]>();
  for (const c of cards) {
    if (tabOf(c) !== tab || viewOf(c) !== view) continue;
    const name = c.subject_name ?? 'Other';
    by.set(name, [...(by.get(name) ?? []), c]);
  }
  const names = [...by.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  return names.map((n) => ({
    key: `subject-${n}`,
    title: n,
    cards: (by.get(n) ?? []).sort((a, b) => (a.chapter_name ?? '').localeCompare(b.chapter_name ?? '', undefined, { numeric: true }) || a.title.localeCompare(b.title, undefined, { numeric: true })),
  }));
}

/** What the list shows: months for anything dated, subjects for the Mini and Subject-wise library. */
export function listGroups(cards: ExamCard[], tab: TestTab, view: TestView, year: number, now: Date = new Date()): MonthGroup[] {
  if (view === 'library') return tab === 'grand' ? monthGroups(cards, tab, view, year, now) : subjectGroups(cards, tab, view);
  return monthGroups(cards, tab, view, null, now);
}

/** Years that have Grand Test library papers, newest first, always including this year. */
export function libraryYears(cards: ExamCard[], now: Date = new Date()): number[] {
  const ys = new Set<number>([now.getFullYear()]);
  for (const c of cards) {
    if (tabOf(c) !== 'grand' || viewOf(c) !== 'library') continue;
    const t = cardTime(c);
    if (t != null) ys.add(new Date(t).getFullYear());
  }
  return [...ys].sort((a, b) => b - a);
}

// ── Grand Test performance analysis ─────────────────────────────────────────
export const analysisUnlocked = (attempts: number, min = 2) => attempts >= min;
export type TrendWindow = 'all' | 'last20';
export const windowed = (a: GrandAttempt[], w: TrendWindow) => (w === 'last20' ? a.slice(-20) : a);

export type Metric = 'percentage' | 'percentile';
export type Order = 'strongest' | 'weakest';
export type SubjectStat = { name: string; percent: number; correct: number; total: number; percentile?: number };

/** Each subject across the chosen attempts: percentage is correct over all its questions; percentile is the average of my percentile in that subject, when known. */
export function subjectStats(attempts: GrandAttempt[]): SubjectStat[] {
  const m = new Map<string, { correct: number; total: number; pct: number[] }>();
  for (const a of attempts) {
    for (const s of a.subjects) {
      const cur = m.get(s.name) ?? { correct: 0, total: 0, pct: [] };
      if (s.percentile != null) cur.pct.push(s.percentile);
      m.set(s.name, { correct: cur.correct + s.correct, total: cur.total + s.total, pct: cur.pct });
    }
  }
  return [...m.entries()].map(([name, v]) => ({
    name, correct: v.correct, total: v.total,
    percent: v.total ? Math.round((v.correct * 100) / v.total) : 0,
    percentile: v.pct.length ? Math.round(v.pct.reduce((x, y) => x + y, 0) / v.pct.length) : undefined,
  }));
}

/** Orders by the chosen metric. A subject with no percentile sorts last when ordering by percentile, so nothing is invented for it. */
export function orderStats<T extends SubjectStat>(rows: T[], order: Order, metric: Metric): T[] {
  const val = (r: T) => (metric === 'percentile' ? r.percentile : r.percent);
  const dir = order === 'strongest' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir || a.name.localeCompare(b.name);
  });
}

/** Chapters of one subject across the chosen attempts. Chapters only have a percentage. */
export function chapterStats(attempts: GrandAttempt[], subject: string): SubjectStat[] {
  const m = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    for (const c of a.chapters) {
      if (c.subject !== subject) continue;
      const cur = m.get(c.name) ?? { correct: 0, total: 0 };
      m.set(c.name, { correct: cur.correct + c.correct, total: cur.total + c.total });
    }
  }
  return [...m.entries()].map(([name, v]) => ({ name, correct: v.correct, total: v.total, percent: v.total ? Math.round((v.correct * 100) / v.total) : 0 }));
}

/** The value of one point on the trend. A test with no percentile (too few students) has none, and is left off the percentile line. */
export const trendValue = (a: GrandAttempt, metric: Metric): number | null => (metric === 'percentile' ? (a.percentile != null ? Math.round(a.percentile) : null) : Math.round(a.percent));

/** "72% · 18 Nov 2026" for an attempted test: the saved percentage and the day it was attempted. Without marks, just the day. */
export function historyLine(c: ExamCard): string {
  const a = c.my_attempt;
  if (!a) return '';
  const d = a.submitted_at ? new Date(a.submitted_at) : null;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : '';
  const pct = a.score != null && a.total_marks ? `${Math.max(0, Math.round((a.score * 100) / a.total_marks))}%` : c.results_released ? '' : 'Result pending';
  return [pct, day].filter(Boolean).join(' · ');
}

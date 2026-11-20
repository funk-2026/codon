import type { ExamCard, ExamKind, GrandAttempt } from '@/src/api/exams';

/** The three Tests tabs. Full-length mocks and previous-year papers are Grand Tests; chapter and part tests are Mini; subject tests are Subject-wise. */
export type TestTab = 'grand' | 'mini' | 'subject';
export type TestView = 'live' | 'library' | 'attempted';

export const TEST_TABS: { key: TestTab; label: string }[] = [
  { key: 'grand', label: 'Grand Test' },
  { key: 'mini', label: 'Mini Test' },
  { key: 'subject', label: 'Subject-wise' },
];
export const TEST_VIEWS: Record<TestTab, { key: TestView; label: string }[]> = {
  grand: [{ key: 'live', label: 'Live & Upcoming' }, { key: 'library', label: 'Library' }, { key: 'attempted', label: 'Attempted' }],
  mini: [{ key: 'live', label: 'Live & Upcoming' }, { key: 'library', label: 'Past Tests' }, { key: 'attempted', label: 'Attempted' }],
  subject: [{ key: 'live', label: 'Live & Upcoming' }, { key: 'library', label: 'Past Tests' }, { key: 'attempted', label: 'Attempted' }],
};
export const YEARS = [2025, 2026, 2027] as const;
export const DEFAULT_YEAR = 2026;

const TAB_OF: Record<ExamKind, TestTab> = { full: 'grand', pyq: 'grand', part: 'mini', chapter: 'mini', subject: 'subject' };
export const tabOf = (c: ExamCard): TestTab => TAB_OF[c.kind] ?? 'mini';

const taken = (c: ExamCard) => c.my_attempt?.status === 'submitted';

export function viewOf(c: ExamCard): TestView {
  if (taken(c)) return 'attempted';
  if (c.phase === 'live' || c.phase === 'upcoming') return 'live';
  return 'library';
}

/** The date a card is filed under: its live start, otherwise when I submitted it. */
export function cardTime(c: ExamCard): number | null {
  const iso = c.opens_at ?? c.my_attempt?.submitted_at;
  return iso ? new Date(iso).getTime() : null;
}

export type MonthGroup = { key: string; title: string; cards: ExamCard[] };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Counts of each tab's attempted tests, for badges. */
export const countTab = (cards: ExamCard[], tab: TestTab, view: TestView) => cards.filter((c) => tabOf(c) === tab && viewOf(c) === view).length;

/**
 * Cards of one tab and view, grouped by month for the chosen year. Upcoming tests list the soonest month first;
 * the rest list the newest month first. Tests with no date at all sit in an "Undated" group so nothing is hidden.
 */
export function monthGroups(cards: ExamCard[], tab: TestTab, view: TestView, year: number): MonthGroup[] {
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
    if (d.getFullYear() !== year) continue;
    byMonth.set(d.getMonth(), [...(byMonth.get(d.getMonth()) ?? []), c]);
  }
  const asc = view === 'live';
  const months = [...byMonth.keys()].sort((a, b) => (asc ? a - b : b - a));
  const out: MonthGroup[] = months.map((m) => ({
    key: `${year}-${m}`,
    title: `${MONTHS[m]} ${year}`,
    cards: (byMonth.get(m) ?? []).sort((a, b) => ((cardTime(a) ?? 0) - (cardTime(b) ?? 0)) * (asc ? 1 : -1)),
  }));
  if (undated.length) out.push({ key: 'undated', title: 'Undated', cards: undated.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })) });
  return out;
}

// ── Grand Test performance analysis ─────────────────────────────────────────
export const analysisUnlocked = (attempts: number, min = 2) => attempts >= min;
export type TrendWindow = 'all' | 'last20';
export const windowed = (a: GrandAttempt[], w: TrendWindow) => (w === 'last20' ? a.slice(-20) : a);

export type SubjectStat = { name: string; percent: number; correct: number; total: number; percentile?: number };
/** Each subject across the chosen attempts: percentage correct of all its questions, strongest first. Percentile is the average of the test percentiles. */
export function subjectStats(attempts: GrandAttempt[]): SubjectStat[] {
  const m = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    for (const s of a.subjects) {
      const cur = m.get(s.name) ?? { correct: 0, total: 0 };
      m.set(s.name, { correct: cur.correct + s.correct, total: cur.total + s.total });
    }
  }
  const pcts = attempts.map((a) => a.percentile).filter((p): p is number => p != null);
  const percentile = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : undefined;
  return [...m.entries()]
    .map(([name, v]) => ({ name, correct: v.correct, total: v.total, percent: v.total ? Math.round((v.correct * 100) / v.total) : 0, percentile }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

/** Chapters of one subject across the chosen attempts, weakest first so the work to do is on top. */
export function chapterStats(attempts: GrandAttempt[], subject: string): SubjectStat[] {
  const m = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    for (const c of a.chapters) {
      if (c.subject !== subject) continue;
      const cur = m.get(c.name) ?? { correct: 0, total: 0 };
      m.set(c.name, { correct: cur.correct + c.correct, total: cur.total + c.total });
    }
  }
  return [...m.entries()]
    .map(([name, v]) => ({ name, correct: v.correct, total: v.total, percent: v.total ? Math.round((v.correct * 100) / v.total) : 0 }))
    .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
}

// Pure rules for the Tests tab and the exam hall (no React Native, so they are unit-tested).
import type { ExamCard, ExamKind, ExamStyle } from '@/src/api/exams';

export const KIND_LABEL: Record<ExamKind, string> = {
  full: 'Grand Test',
  pyq: 'Grand Test (previous-year paper)',
  subject: 'Subject-wise Test',
  part: 'Mini Test (part syllabus)',
  chapter: 'Mini Test (one chapter)',
};
export const STYLE_LABEL: Record<ExamStyle, string> = { neet: 'NEET style', school: 'School' };

/** "2 h 05 min", "9 min 30 s", "45 s": a countdown that reads at a glance. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

/** Timer for the exam hall: 3:00:00 style, never negative. */
export function formatClockHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Offset between the server's clock and this phone's, so countdowns follow the server. */
export function clockOffset(serverNowIso: string, receivedAt: number = Date.now()): number {
  const t = new Date(serverNowIso).getTime();
  return Number.isNaN(t) ? 0 : t - receivedAt;
}

/**
 * Where a test stands at `now`. The server's `phase` is only true at the moment it answered, so a countdown that
 * reaches zero would sit on "Starts in 0 s" forever. Live tests are re-derived from their own times.
 */
export function phaseAt(c: ExamCard, now: number): ExamCard['phase'] {
  if (c.delivery !== 'live' || !c.opens_at || !c.ends_at) return c.phase;
  const opens = new Date(c.opens_at).getTime();
  const ends = new Date(c.ends_at).getTime();
  if (Number.isNaN(opens) || Number.isNaN(ends)) return c.phase;
  return now < opens ? 'upcoming' : now < ends ? 'live' : 'ended';
}
export const withPhaseAt = (cards: ExamCard[], now: number): ExamCard[] =>
  cards.map((c) => {
    const phase = phaseAt(c, now);
    return phase === c.phase ? c : { ...c, phase };
  });

export type ExamGroups = {
  liveNow: ExamCard[];
  upcoming: ExamCard[];
  library: ExamCard[];
  mine: ExamCard[];
};

/** Sorts the Tests tab: live now, upcoming (soonest first), a library of anytime and past-live tests, and the ones I have taken. */
export function groupExams(cards: ExamCard[]): ExamGroups {
  const when = (c: ExamCard) => (c.opens_at ? new Date(c.opens_at).getTime() : 0);
  const liveNow = cards.filter((c) => c.phase === 'live').sort((a, b) => when(a) - when(b));
  const upcoming = cards.filter((c) => c.phase === 'upcoming').sort((a, b) => when(a) - when(b));
  const library = cards.filter((c) => c.phase === 'anytime' || c.phase === 'ended').sort((a, b) => when(b) - when(a));
  const mine = cards.filter((c) => c.my_attempt && c.my_attempt.status === 'submitted').sort(
    (a, b) => new Date(b.my_attempt?.submitted_at ?? 0).getTime() - new Date(a.my_attempt?.submitted_at ?? 0).getTime(),
  );
  return { liveNow, upcoming, library, mine };
}

/** What the primary button on a test card should say. */
export function cardAction(c: ExamCard): 'resume' | 'start' | 'remind' | 'reminded' | 'result' | 'practice' {
  if (c.my_attempt?.status === 'in_progress') return 'resume';
  if (c.phase === 'upcoming') return c.registered ? 'reminded' : 'remind';
  if (c.phase === 'live') return 'start';
  if (c.phase === 'ended') return c.my_attempt?.status === 'submitted' ? 'result' : 'practice';
  return c.my_attempt?.status === 'submitted' ? 'result' : 'start';
}

// ── Question palette (the five CBT states) ──────────────────────────────────
export type PaletteState = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';

export function paletteState(a: { answered: boolean; marked: boolean; visited: boolean }): PaletteState {
  if (a.answered && a.marked) return 'answered_marked';
  if (a.marked) return 'marked';
  if (a.answered) return 'answered';
  return a.visited ? 'not_answered' : 'not_visited';
}

export type Section = { name: string; from: number; to: number };

/** Splits an ordered list of question sections into runs: ["Physics","Physics","Chem"] -> Physics 0-1, Chem 2-2. */
export function sectionsOf(labels: (string | undefined)[]): Section[] {
  const out: Section[] = [];
  labels.forEach((l, i) => {
    const name = (l ?? '').trim();
    const last = out[out.length - 1];
    if (last && last.name === name) last.to = i;
    else out.push({ name, from: i, to: i });
  });
  // A paper with no labels at all has no sections.
  return out.length === 1 && out[0].name === '' ? [] : out.map((s) => ({ ...s, name: s.name || 'Other' }));
}

/** "Rank 120 of 4,812" and, when there is enough data, "top 3%"; an estimate says so. */
export function rankText(c: { rank: number; total: number; estimated?: boolean; top_percent?: number }): { line: string; sub?: string } {
  const n = (x: number) => x.toLocaleString('en-IN');
  return {
    line: `${c.estimated ? 'Estimated rank' : 'Rank'} ${n(c.rank)} of ${n(c.total)}`,
    sub: c.top_percent != null ? `Top ${c.top_percent}%` : undefined,
  };
}

/** A pattern warning (never a block): does this paper match the style's usual shape? */
export function patternHint(style: ExamStyle, kind: ExamKind, questions: number, minutes: number | undefined): string | null {
  if (style !== 'neet' || kind !== 'full') return null;
  const issues: string[] = [];
  if (questions !== 180) issues.push(`${questions} questions (NEET has 180)`);
  if (minutes != null && minutes !== 180) issues.push(`${minutes} minutes (NEET is 180)`);
  return issues.length ? `Differs from the NEET pattern: ${issues.join(', ')}. That is fine if it is on purpose.` : null;
}

// ── Starting a test ─────────────────────────────────────────────────────────
type TimedTest = { delivery?: string; opens_at?: string; late_entry_minutes?: number; extra_minutes?: number; duration_minutes?: number };

export type Window = { opens: number; lastStart: number; ends: number };

/** The live window of a test in epoch milliseconds, or null for an anytime test. Mirrors the server's rule. */
export function examWindow(t: TimedTest): Window | null {
  if (t.delivery !== 'live' || !t.opens_at || !t.duration_minutes || t.duration_minutes <= 0) return null;
  const opens = new Date(t.opens_at).getTime();
  if (Number.isNaN(opens)) return null;
  const extra = (t.extra_minutes ?? 0) * 60_000;
  return { opens, lastStart: opens + (t.late_entry_minutes ?? 0) * 60_000 + extra, ends: opens + t.duration_minutes * 60_000 + extra };
}

export type StartGate =
  | { state: 'open'; official: boolean }
  | { state: 'wait'; ms: number }
  | { state: 'late' };

/**
 * Can the student press Start now? 'wait' before a live test opens, 'late' once late entry closed (until the exam ends,
 * after which it can be taken as practice), 'open' otherwise. `official` is true for a live start inside the window.
 */
export function startGate(t: TimedTest, now: number): StartGate {
  const w = examWindow(t);
  if (!w) return { state: 'open', official: false };
  if (now < w.opens) return { state: 'wait', ms: w.opens - now };
  if (now < w.ends) return now > w.lastStart ? { state: 'late' } : { state: 'open', official: true };
  return { state: 'open', official: false };
}

// ── Tests home ──────────────────────────────────────────────────────────────
export type NextUp =
  | { kind: 'resume' | 'live' | 'upcoming'; card: ExamCard }
  | { kind: 'first'; card: ExamCard }
  | { kind: 'none' };

export type TestRow = { key: string; title: string; cards: ExamCard[] };
export type SeriesProgress = { id: string; title: string; total: number; done: number; next?: ExamCard; cards: ExamCard[] };
export type TestsHome = {
  next: NextUp;
  waiting: ExamCard[];
  rows: TestRow[];
  series: SeriesProgress[];
  resultsCount: number;
  unseenResults: number;
};

const taken = (c: ExamCard) => c.my_attempt?.status === 'submitted';
const opensAt = (c: ExamCard) => (c.opens_at ? new Date(c.opens_at).getTime() : 0);
const ROW_OF: Record<ExamKind, string> = { full: 'full', subject: 'subject', part: 'chapter', chapter: 'chapter', pyq: 'pyq' };
const ROW_TITLE: Record<string, string> = { full: 'Full-length mocks', subject: 'Subject tests', chapter: 'Chapter and mini tests', pyq: 'Previous-year papers' };

/**
 * One page for the Tests tab. "Next up" is the single thing to do now: resume, a live test still open for entry,
 * the soonest upcoming one, or for a student with no attempts a first full mock to set a baseline.
 */
export function buildTestsHome(cards: ExamCard[], filter: 'all' | 'new' | 'taken', now: number): TestsHome {
  const lastStartOpen = (c: ExamCard) => c.phase === 'live' && (!c.last_start_at || now <= new Date(c.last_start_at).getTime());
  const resume = cards.find((c) => c.my_attempt?.status === 'in_progress');
  const live = cards.filter((c) => c.phase === 'live' && !c.my_attempt).sort((a, b) => opensAt(a) - opensAt(b));
  const upcoming = cards.filter((c) => c.phase === 'upcoming').sort((a, b) => opensAt(a) - opensAt(b));
  const anyTaken = cards.some(taken);
  const firstMock = cards.find((c) => c.kind === 'full' && (c.phase === 'anytime' || c.phase === 'ended') && !c.requires_subscription)
    ?? cards.find((c) => c.kind === 'full' && (c.phase === 'anytime' || c.phase === 'ended'));

  let next: NextUp = { kind: 'none' };
  if (resume) next = { kind: 'resume', card: resume };
  else if (live[0] && lastStartOpen(live[0])) next = { kind: 'live', card: live[0] };
  else if (upcoming[0]) next = { kind: 'upcoming', card: upcoming[0] };
  else if (!anyTaken && firstMock) next = { kind: 'first', card: firstMock };

  const waiting = cards.filter((c) => taken(c) && !c.results_released);
  const shownInNext = next.kind === 'none' ? undefined : next.card.id;

  const pass = (c: ExamCard) => (filter === 'new' ? !c.my_attempt : filter === 'taken' ? taken(c) : true);
  const rows: TestRow[] = [];
  const soon = [...live, ...upcoming].filter((c) => c.id !== shownInNext && pass(c));
  if (soon.length) rows.push({ key: 'soon', title: 'Live and upcoming', cards: soon });
  const browse = cards.filter((c) => (c.phase === 'anytime' || c.phase === 'ended') && c.id !== shownInNext && pass(c));
  for (const key of ['full', 'subject', 'chapter', 'pyq']) {
    const list = browse.filter((c) => ROW_OF[c.kind] === key).sort((a, b) => (b.exam_year ?? 0) - (a.exam_year ?? 0) || a.title.localeCompare(b.title));
    if (list.length) rows.push({ key, title: ROW_TITLE[key], cards: list });
  }

  const bySeries = new Map<string, SeriesProgress>();
  for (const c of cards) {
    if (!c.series) continue;
    const s = bySeries.get(c.series.id) ?? { id: c.series.id, title: c.series.title, total: 0, done: 0, cards: [] };
    s.total += 1;
    s.cards.push(c);
    if (taken(c)) s.done += 1;
    bySeries.set(c.series.id, s);
  }
  const series = [...bySeries.values()].map((s) => ({
    ...s,
    cards: s.cards.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })),
    next: undefined as ExamCard | undefined,
  }));
  for (const s of series) s.next = s.cards.find((c) => !taken(c) && c.phase !== 'upcoming');

  const mine = cards.filter(taken);
  return { next, waiting, rows, series, resultsCount: mine.length, unseenResults: mine.filter((c) => c.results_released).length };
}

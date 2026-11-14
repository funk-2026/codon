// Pure rules for the Tests tab and the exam hall (no React Native, so they are unit-tested).
import type { ExamCard, ExamKind, ExamStyle } from '@/src/api/exams';

export const KIND_LABEL: Record<ExamKind, string> = {
  full: 'Full-length mock',
  pyq: 'Previous-year paper',
  subject: 'Subject test',
  part: 'Mini test',
  chapter: 'Chapter test',
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

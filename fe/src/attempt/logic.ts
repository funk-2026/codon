import type { Confidence, Option, UpsertAnswerRequest } from '@/src/api/attempts';

/**
 * Pure attempt-runtime logic (no React, no network) so the rules that decide
 * "how much time is left" and "what still needs syncing" are unit-tested.
 */

/**
 * Deadline in the DEVICE's clock. The server sends `expires_at` and its own
 * `server_now`; the difference between server_now and our clock is the skew,
 * and applying it means a phone with a wrong clock still shows the true time.
 */
export function deadlineOnDeviceClock(expiresAt: string | undefined, serverNow: string | undefined, deviceNowMs: number): number | null {
  if (!expiresAt) return null;
  const exp = Date.parse(expiresAt);
  if (Number.isNaN(exp)) return null;
  const sn = serverNow ? Date.parse(serverNow) : NaN;
  const skew = Number.isNaN(sn) ? 0 : sn - deviceNowMs; // server ahead of device => positive
  return exp - skew;
}

export function secondsLeft(deadlineMs: number | null, nowMs: number): number | null {
  if (deadlineMs == null) return null;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export type TimerLevel = 'normal' | 'warning' | 'danger';
export function timerLevel(left: number | null): TimerLevel {
  if (left == null) return 'normal';
  if (left <= 60) return 'danger';
  if (left <= 300) return 'warning';
  return 'normal';
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

// ── Answer sync queue ───────────────────────────────────────────────────────

export type PendingUpdate = UpsertAnswerRequest & { question_id: string; answered_at: string };
export type PendingQueue = Record<string, PendingUpdate>;

/**
 * Merge a new change into the queue. One entry per question: later fields win,
 * fields the new change doesn't mention are kept (so "mark for review" queued
 * after "select B" still sends B). `selected_option: null` (clear) is a real value.
 */
export function enqueue(queue: PendingQueue, questionId: string, change: UpsertAnswerRequest, nowIso: string): PendingQueue {
  const prev = queue[questionId];
  const merged: PendingUpdate = { ...(prev ?? {}), question_id: questionId, answered_at: nowIso };
  (Object.keys(change) as (keyof UpsertAnswerRequest)[]).forEach((k) => {
    if (change[k] !== undefined) (merged as any)[k] = change[k];
  });
  return { ...queue, [questionId]: merged };
}

/** Drop entries the server acknowledged (ok, or a permanent rejection that retrying can't fix). */
export function settle(queue: PendingQueue, results: { question_id: string; ok: boolean; code?: string }[]): { queue: PendingQueue; permanentFailures: string[] } {
  const next = { ...queue };
  const permanent: string[] = [];
  for (const r of results) {
    if (r.ok) delete next[r.question_id];
    else if (isPermanentFailure(r.code)) {
      delete next[r.question_id];
      permanent.push(r.question_id);
    }
  }
  return { queue: next, permanentFailures: permanent };
}

/** Failures where retrying the same payload will never succeed. */
export function isPermanentFailure(code?: string): boolean {
  return code === 'invalid_question' || code === 'answer_locked' || code === 'attempt_expired' || code === 'attempt_not_found';
}

export function queueToBatch(queue: PendingQueue): PendingUpdate[] {
  return Object.values(queue).sort((a, b) => a.answered_at.localeCompare(b.answered_at)).slice(0, 200);
}

/** Exponential backoff with a cap: 1s, 2s, 4s, 8s, 15s, 15s … */
export function backoffMs(failures: number): number {
  return Math.min(15000, 1000 * 2 ** Math.max(0, failures - 1));
}

// ── Palette ─────────────────────────────────────────────────────────────────

export type PaletteStatus = 'unanswered' | 'answered' | 'marked' | 'answered_marked';

export type LocalAnswer = { selected?: Option; marked?: boolean; confidence?: Confidence; revealed?: boolean };

export function paletteStatus(a: LocalAnswer | undefined): PaletteStatus {
  const answered = !!a?.selected;
  const marked = !!a?.marked;
  if (answered && marked) return 'answered_marked';
  if (marked) return 'marked';
  return answered ? 'answered' : 'unanswered';
}

export function paletteCounts(questionIds: string[], answers: Record<string, LocalAnswer>) {
  let answered = 0, marked = 0, unanswered = 0;
  for (const id of questionIds) {
    const a = answers[id];
    if (a?.selected) answered++; else unanswered++;
    if (a?.marked) marked++;
  }
  return { answered, marked, unanswered, total: questionIds.length };
}

/** First unanswered index after `from` (wrapping); -1 if everything is answered. */
export function nextUnanswered(questionIds: string[], answers: Record<string, LocalAnswer>, from: number): number {
  const n = questionIds.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (!answers[questionIds[idx]]?.selected) return idx;
  }
  return -1;
}

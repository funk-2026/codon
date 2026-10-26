import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/src/api/client';
import {
  revealAnswer, startAttempt, takeoverAttempt,
  type AttemptAnswer, type Confidence, type Option, type RevealResponse, type StudentAttempt,
} from '@/src/api/attempts';
import { getTestQuestions, type Question } from '@/src/api/tests';
import type { MediaMap } from '@/src/rich/ast';
import { deadlineOnDeviceClock, type LocalAnswer, type PendingQueue } from './logic';
import { queueKey, useAnswerSync } from './useAnswerSync';
import { kvGet, kvSet } from '@/src/storage/kv';

/** Device-local crossed-out options for one attempt. */
const struckKey = (attemptId: string) => `attempt-struck:${attemptId}`;

export type SessionPhase = 'loading' | 'ready' | 'error' | 'expired';

function toLocal(a: AttemptAnswer): LocalAnswer {
  return { selected: a.selected_option, marked: a.marked_for_review, confidence: a.confidence, revealed: !!a.revealed_at };
}

/**
 * Everything the question screen needs for one attempt: load/resume, answers by
 * question id, optimistic save, mark-for-review, confidence, tutor reveal, the
 * server-corrected deadline, and device-lock state.
 */
export function useAttemptSession(testId: string | undefined) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  // When the attempt started, on the device clock — drives the stopwatch for untimed tests.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lockedElsewhere, setLockedElsewhere] = useState(false);
  const [expiredAttemptId, setExpiredAttemptId] = useState<string | null>(null);
  const [reveals, setReveals] = useState<Record<string, RevealResponse>>({});
  const [rejected, setRejected] = useState<string[]>([]);
  // Options the student crossed out (CM-T10). Local only — never sent to the server —
  // but persisted per attempt so they survive leaving and resuming the test.
  const [struck, setStruck] = useState<Record<string, Option[]>>({});

  // time spent per question (seconds), seeded from the server on resume
  const spent = useRef<Record<string, number>>({});
  const enteredAt = useRef<{ qid: string; at: number } | null>(null);

  const sync = useAnswerSync(attempt?.id, {
    onExpired: () => {
      setExpiredAttemptId(attempt?.id ?? null);
      setPhase('expired');
    },
    onLockedElsewhere: () => setLockedElsewhere(true),
    onRejected: (ids) => setRejected((r) => [...new Set([...r, ...ids])]),
  });

  const load = useCallback(async () => {
    if (!testId) return;
    setPhase('loading');
    setError(null);
    try {
      const start = await startAttempt(testId);
      const qs = await getTestQuestions(testId);
      const ordered = [...qs.questions].sort((a, b) => (a.position ?? a.order_index) - (b.position ?? b.order_index));
      setAttempt(start.attempt);
      setQuestions(ordered);
      setMedia(qs.media ?? {});
      const map: Record<string, LocalAnswer> = {};
      const sp: Record<string, number> = {};
      const rv: Record<string, RevealResponse> = {};
      start.answers.forEach((a) => {
        map[a.question_id] = toLocal(a);
        if (a.time_spent_seconds) sp[a.question_id] = a.time_spent_seconds;
      });
      // Answers tapped but not yet saved when the app was killed live in the
      // persisted queue; useAnswerSync re-sends them, but the screen must show
      // them now too or the student sees their old answer and may re-tap.
      const unsent = await kvGet<PendingQueue>(queueKey(start.attempt.id), {});
      for (const u of Object.values(unsent)) {
        const cur = map[u.question_id] ?? { selected: undefined, marked: false };
        map[u.question_id] = {
          ...cur,
          ...(u.selected_option !== undefined ? { selected: u.selected_option ?? undefined } : {}),
          ...(u.marked_for_review !== undefined ? { marked: u.marked_for_review } : {}),
          ...(u.confidence !== undefined ? { confidence: u.confidence ?? undefined } : {}),
        };
        if (u.time_spent_seconds) sp[u.question_id] = Math.max(sp[u.question_id] ?? 0, u.time_spent_seconds);
      }
      spent.current = sp;
      // Tutor mode on resume: answers come back flagged `revealed` but without the
      // result, so re-fetch it (the reveal endpoint is idempotent). Without this a
      // checked question looks unchecked — live-looking options, "Check answer" and
      // "Clear my response" that silently do nothing.
      const revealedIds = start.answers.filter((a) => a.revealed_at).map((a) => a.question_id);
      const extraMedia: MediaMap = {};
      const results = await Promise.allSettled(revealedIds.map((qid) => revealAnswer(start.attempt.id, qid)));
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        rv[revealedIds[i]] = r.value;
        Object.assign(extraMedia, r.value.media ?? {});
      });
      setMedia((m) => ({ ...m, ...extraMedia }));
      setAnswers(map);
      setReveals(rv);
      setStruck(await kvGet<Record<string, Option[]>>(struckKey(start.attempt.id), {}));
      setDeadline(deadlineOnDeviceClock(start.attempt.expires_at, start.server_now, Date.now()));
      setStartedAt(deadlineOnDeviceClock(start.attempt.started_at, start.server_now, Date.now()));
      setLockedElsewhere(start.active_elsewhere);
      setPhase('ready');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'attempt_expired') {
        setExpiredAttemptId((e.details as any)?.attempt_id ?? null);
        setPhase('expired');
        return;
      }
      setError(e as Error);
      setPhase('error');
    }
  }, [testId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchLocal = (qid: string, p: Partial<LocalAnswer>) => setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...p } }));

  const writeStruck = useCallback(
    (fn: (s: Record<string, Option[]>) => Record<string, Option[]>) =>
      setStruck((cur) => {
        const next = fn(cur);
        if (attempt) void kvSet(struckKey(attempt.id), next);
        return next;
      }),
    [attempt],
  );

  /** Cross an option out / back in. Crossing out the selected answer is not allowed. */
  const toggleStrike = useCallback(
    (qid: string, opt: Option) => {
      if (lockedElsewhere || answers[qid]?.revealed || answers[qid]?.selected === opt) return;
      writeStruck((s) => {
        const cur = s[qid] ?? [];
        return { ...s, [qid]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
      });
    },
    [answers, lockedElsewhere, writeStruck],
  );

  const select = useCallback(
    (qid: string, opt: Option) => {
      if (lockedElsewhere || answers[qid]?.revealed) return;
      // choosing a crossed-out option un-crosses it
      if (struck[qid]?.includes(opt)) writeStruck((s) => ({ ...s, [qid]: (s[qid] ?? []).filter((o) => o !== opt) }));
      patchLocal(qid, { selected: opt });
      sync.save(qid, { selected_option: opt });
    },
    [answers, lockedElsewhere, sync, struck, writeStruck],
  );

  const clear = useCallback(
    (qid: string) => {
      if (lockedElsewhere || answers[qid]?.revealed) return;
      patchLocal(qid, { selected: undefined });
      sync.save(qid, { selected_option: null });
    },
    [answers, lockedElsewhere, sync],
  );

  const toggleMark = useCallback(
    (qid: string) => {
      if (lockedElsewhere) return;
      const next = !answers[qid]?.marked;
      patchLocal(qid, { marked: next });
      sync.save(qid, { marked_for_review: next });
    },
    [answers, lockedElsewhere, sync],
  );

  const setConfidence = useCallback(
    (qid: string, c: Confidence | undefined) => {
      if (lockedElsewhere) return;
      patchLocal(qid, { confidence: c });
      sync.save(qid, { confidence: c ?? null });
    },
    [lockedElsewhere, sync],
  );

  /** Tutor mode: flush the pending answer first so the server scores what the student sees. */
  const reveal = useCallback(
    async (qid: string) => {
      if (!attempt) return null;
      await sync.flushNow();
      const r = await revealAnswer(attempt.id, qid);
      setReveals((m) => ({ ...m, [qid]: r }));
      setMedia((m) => ({ ...m, ...(r.media ?? {}) }));
      patchLocal(qid, { revealed: true });
      return r;
    },
    [attempt, sync],
  );

  /** Call when the student moves to another question: banks time spent on the previous one. */
  const visit = useCallback(
    (qid: string | undefined) => {
      const now = Date.now();
      const prev = enteredAt.current;
      if (prev && prev.qid !== qid) {
        const delta = Math.round((now - prev.at) / 1000);
        if (delta >= 1) {
          spent.current[prev.qid] = (spent.current[prev.qid] ?? 0) + delta;
          sync.save(prev.qid, { time_spent_seconds: spent.current[prev.qid] });
        }
      }
      if (!prev || prev.qid !== qid) enteredAt.current = qid ? { qid, at: now } : null;
    },
    [sync],
  );

  const takeover = useCallback(async () => {
    if (!attempt) return;
    await takeoverAttempt(attempt.id);
    setLockedElsewhere(false);
    await load();
  }, [attempt, load]);

  const ids = useMemo(() => questions.map((q) => q.id), [questions]);

  return {
    phase, error, attempt, questions, ids, media, answers, deadline, startedAt,
    lockedElsewhere, expiredAttemptId, reveals, rejected, struck,
    tutor: attempt?.mode === 'tutor',
    select, clear, toggleMark, toggleStrike, setConfidence, reveal, visit, takeover, reload: load,
    sync,
  };
}

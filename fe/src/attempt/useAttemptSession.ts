import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/src/api/client';
import {
  revealAnswer, startAttempt, takeoverAttempt,
  type AttemptAnswer, type Confidence, type Option, type RevealResponse, type StudentAttempt,
} from '@/src/api/attempts';
import { getTestQuestions, type Question } from '@/src/api/tests';
import type { MediaMap } from '@/src/rich/ast';
import { deadlineOnDeviceClock, type LocalAnswer } from './logic';
import { useAnswerSync } from './useAnswerSync';

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
  const [lockedElsewhere, setLockedElsewhere] = useState(false);
  const [expiredAttemptId, setExpiredAttemptId] = useState<string | null>(null);
  const [reveals, setReveals] = useState<Record<string, RevealResponse>>({});
  const [rejected, setRejected] = useState<string[]>([]);

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
      spent.current = sp;
      setAnswers(map);
      setReveals(rv);
      setDeadline(deadlineOnDeviceClock(start.attempt.expires_at, start.server_now, Date.now()));
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

  const select = useCallback(
    (qid: string, opt: Option) => {
      if (lockedElsewhere || answers[qid]?.revealed) return;
      patchLocal(qid, { selected: opt });
      sync.save(qid, { selected_option: opt });
    },
    [answers, lockedElsewhere, sync],
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
    phase, error, attempt, questions, ids, media, answers, deadline,
    lockedElsewhere, expiredAttemptId, reveals, rejected,
    tutor: attempt?.mode === 'tutor',
    select, clear, toggleMark, setConfidence, reveal, visit, takeover, reload: load,
    sync,
  };
}

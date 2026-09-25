import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '@/src/api/client';
import { batchUpsertAnswers, upsertAnswer, type UpsertAnswerRequest } from '@/src/api/attempts';
import { kvDelete, kvGet, kvSet } from '@/src/storage/kv';
import { backoffMs, enqueue, isPermanentFailure, queueToBatch, settle, type PendingQueue } from './logic';

export type SyncStatus = 'idle' | 'saving' | 'retrying';

type Handlers = {
  /** Deadline passed on the server (409 attempt_expired). */
  onExpired?: () => void;
  /** Attempt was taken over by another device (409 attempt_active_elsewhere). */
  onLockedElsewhere?: () => void;
  /** Items the server permanently refused (e.g. answer_locked in tutor mode). */
  onRejected?: (questionIds: string[]) => void;
};

const key = (attemptId: string) => `attempt-queue:${attemptId}`;

/**
 * Optimistic answer saving that survives flaky networks (FE-4.x runtime).
 *
 * The UI updates instantly; changes go into a persisted per-attempt queue that
 * is flushed with backoff, on app foreground, and before submit. Nothing the
 * student tapped is silently lost: transient failures keep retrying, and
 * `pending` stays > 0 so the screen can say "N answers not saved yet".
 */
export function useAnswerSync(attemptId: string | undefined, handlers: Handlers = {}) {
  const queueRef = useRef<PendingQueue>({});
  const inFlight = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const stopped = useRef(false);

  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');

  const persist = useCallback(() => {
    if (!attemptId) return;
    const q = queueRef.current;
    setPending(Object.keys(q).length);
    if (Object.keys(q).length === 0) void kvDelete(key(attemptId));
    else void kvSet(key(attemptId), q);
  }, [attemptId]);

  const schedule = useCallback((ms: number, run: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!attemptId || stopped.current) return false;
    if (inFlight.current) return false;
    const batch = queueToBatch(queueRef.current);
    if (batch.length === 0) {
      setStatus('idle');
      return true;
    }
    inFlight.current = true;
    setStatus(failures.current > 0 ? 'retrying' : 'saving');
    try {
      let results: { question_id: string; ok: boolean; code?: string }[];
      if (batch.length === 1) {
        const { question_id, ...body } = batch[0];
        try {
          await upsertAnswer(attemptId, question_id, body as UpsertAnswerRequest);
          results = [{ question_id, ok: true }];
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500 && isPermanentFailure(e.code)) {
            if (e.code === 'attempt_expired' || e.code === 'attempt_not_found') throw e;
            results = [{ question_id, ok: false, code: e.code }];
          } else throw e;
        }
      } else {
        results = (await batchUpsertAnswers(attemptId, batch)).results;
      }
      const { queue, permanentFailures } = settle(queueRef.current, results);
      // Keep anything queued while this request was in flight (settle only removes acked ids,
      // but a newer change to the same question must survive).
      const merged: PendingQueue = { ...queue };
      for (const [qid, upd] of Object.entries(queueRef.current)) {
        const sent = batch.find((b) => b.question_id === qid);
        if (sent && upd.answered_at !== sent.answered_at) merged[qid] = upd; // changed mid-flight
      }
      queueRef.current = merged;
      persist();
      if (permanentFailures.length) handlersRef.current.onRejected?.(permanentFailures);
      failures.current = results.some((r) => !r.ok && !isPermanentFailure(r.code)) ? failures.current + 1 : 0;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'attempt_expired') {
        queueRef.current = {};
        persist();
        stopped.current = true;
        handlersRef.current.onExpired?.();
        return false;
      }
      if (e instanceof ApiError && e.code === 'attempt_active_elsewhere') {
        stopped.current = true;
        handlersRef.current.onLockedElsewhere?.();
        return false;
      }
      failures.current += 1; // network error / 5xx: keep the queue, retry later
    } finally {
      inFlight.current = false;
    }
    if (Object.keys(queueRef.current).length > 0) {
      setStatus('retrying');
      schedule(failures.current > 0 ? backoffMs(failures.current) : 300, () => void flush());
      return false;
    }
    setStatus('idle');
    return true;
  }, [attemptId, persist, schedule]);

  /** Queue a change and save soon. Safe to call on every tap. */
  const save = useCallback(
    (questionId: string, change: UpsertAnswerRequest) => {
      if (!attemptId) return;
      queueRef.current = enqueue(queueRef.current, questionId, change, new Date().toISOString());
      persist();
      schedule(failures.current > 0 ? backoffMs(failures.current) : 250, () => void flush());
    },
    [attemptId, persist, schedule, flush],
  );

  /** Force an immediate flush (retry button, before submit). Resolves true when nothing is left unsaved. */
  const flushNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    failures.current = 0;
    // If a request is in flight, wait for it, then flush what remains.
    for (let i = 0; i < 40 && inFlight.current; i++) await new Promise((r) => setTimeout(r, 100));
    return flush();
  }, [flush]);

  // Restore anything left over from a previous session (app killed mid-attempt).
  useEffect(() => {
    if (!attemptId) return;
    stopped.current = false;
    let cancelled = false;
    (async () => {
      const saved = await kvGet<PendingQueue>(key(attemptId), {});
      if (cancelled || Object.keys(saved).length === 0) return;
      // Anything queued in this session is newer than what was persisted.
      queueRef.current = { ...saved, ...queueRef.current };
      persist();
      void flush();
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [attemptId, flush, persist]);

  // Retry as soon as the app returns to the foreground (often == connectivity is back).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Object.keys(queueRef.current).length > 0) {
        failures.current = 0;
        void flush();
      }
    });
    return () => sub.remove();
  }, [flush]);

  return { save, flushNow, pending, status };
}

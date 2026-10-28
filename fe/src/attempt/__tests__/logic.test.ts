import {
  backoffMs, deadlineOnDeviceClock, enqueue, formatClock, isPermanentFailure, nextUnanswered,
  paletteCounts, paletteStatus, queueToBatch, secondsLeft, settle, timerLevel,
} from '../logic';

describe('deadline / clock skew', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  it('is null for untimed attempts', () => {
    expect(deadlineOnDeviceClock(undefined, undefined, now)).toBeNull();
    expect(secondsLeft(null, now)).toBeNull();
  });
  it('matches the server deadline when clocks agree', () => {
    const d = deadlineOnDeviceClock('2026-01-01T10:30:00Z', '2026-01-01T10:00:00Z', now)!;
    expect(secondsLeft(d, now)).toBe(1800);
  });
  it('corrects a device clock that is 10 minutes FAST', () => {
    const fastDevice = now + 10 * 60_000;
    const d = deadlineOnDeviceClock('2026-01-01T10:30:00Z', '2026-01-01T10:00:00Z', fastDevice)!;
    expect(secondsLeft(d, fastDevice)).toBe(1800); // still 30 min, not 20
  });
  it('corrects a device clock that is 10 minutes SLOW', () => {
    const slowDevice = now - 10 * 60_000;
    const d = deadlineOnDeviceClock('2026-01-01T10:30:00Z', '2026-01-01T10:00:00Z', slowDevice)!;
    expect(secondsLeft(d, slowDevice)).toBe(1800);
  });
  it('falls back to no skew if server_now is missing/garbage', () => {
    const d = deadlineOnDeviceClock('2026-01-01T10:30:00Z', 'nope', now)!;
    expect(secondsLeft(d, now)).toBe(1800);
  });
  it('never goes negative and rounds up', () => {
    expect(secondsLeft(now - 5000, now)).toBe(0);
    expect(secondsLeft(now + 1, now)).toBe(1);
  });
  it('timer levels', () => {
    expect(timerLevel(null)).toBe('normal');
    expect(timerLevel(301)).toBe('normal');
    expect(timerLevel(300)).toBe('warning');
    expect(timerLevel(61)).toBe('warning');
    expect(timerLevel(60)).toBe('danger');
    expect(timerLevel(0)).toBe('danger');
  });
  it('formats clocks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('answer queue', () => {
  const t1 = '2026-01-01T10:00:01.000Z';
  const t2 = '2026-01-01T10:00:02.000Z';
  it('keeps one entry per question and merges fields', () => {
    let q = enqueue({}, 'q1', { selected_option: 'B' }, t1);
    q = enqueue(q, 'q1', { marked_for_review: true }, t2);
    expect(Object.keys(q)).toEqual(['q1']);
    expect(q.q1).toMatchObject({ selected_option: 'B', marked_for_review: true, answered_at: t2 });
  });
  it('a clear (null) overrides an earlier selection', () => {
    let q = enqueue({}, 'q1', { selected_option: 'B' }, t1);
    q = enqueue(q, 'q1', { selected_option: null }, t2);
    expect(q.q1.selected_option).toBeNull();
  });
  it('does not overwrite with undefined', () => {
    let q = enqueue({}, 'q1', { selected_option: 'C' }, t1);
    q = enqueue(q, 'q1', { time_spent_seconds: 9, selected_option: undefined }, t2);
    expect(q.q1.selected_option).toBe('C');
  });
  it('is immutable', () => {
    const a = enqueue({}, 'q1', { selected_option: 'A' }, t1);
    const b = enqueue(a, 'q2', { selected_option: 'B' }, t2);
    expect(Object.keys(a)).toEqual(['q1']);
    expect(Object.keys(b).sort()).toEqual(['q1', 'q2']);
  });
  it('settle drops ok + permanent failures, keeps transient ones', () => {
    let q = enqueue({}, 'ok', { selected_option: 'A' }, t1);
    q = enqueue(q, 'bad', { selected_option: 'A' }, t1);
    q = enqueue(q, 'flaky', { selected_option: 'A' }, t1);
    const r = settle(q, [
      { question_id: 'ok', ok: true },
      { question_id: 'bad', ok: false, code: 'invalid_question' },
      { question_id: 'flaky', ok: false, code: 'internal' },
    ]);
    expect(Object.keys(r.queue)).toEqual(['flaky']);
    expect(r.permanentFailures).toEqual(['bad']);
  });
  it('batch is ordered oldest first and capped at 200', () => {
    let q = {};
    for (let i = 0; i < 250; i++) q = enqueue(q, `q${i}`, { selected_option: 'A' }, new Date(1_700_000_000_000 + i * 1000).toISOString());
    const b = queueToBatch(q);
    expect(b).toHaveLength(200);
    expect(b[0].question_id).toBe('q0');
  });
  it('permanent failure codes', () => {
    expect(isPermanentFailure('answer_locked')).toBe(true);
    expect(isPermanentFailure('attempt_active_elsewhere')).toBe(false);
    expect(isPermanentFailure(undefined)).toBe(false);
  });
  it('backoff grows then caps', () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
    expect(backoffMs(0)).toBe(1000);
  });
});

describe('palette', () => {
  it('status combos', () => {
    expect(paletteStatus(undefined)).toBe('unanswered');
    expect(paletteStatus({ selected: 'A' })).toBe('answered');
    expect(paletteStatus({ marked: true })).toBe('marked');
    expect(paletteStatus({ selected: 'A', marked: true })).toBe('answered_marked');
  });
  it('counts are keyed by question id (regression: palette used index keys)', () => {
    const ids = ['a', 'b', 'c'];
    const c = paletteCounts(ids, { b: { selected: 'C' }, c: { marked: true } });
    expect(c).toEqual({ answered: 1, marked: 1, unanswered: 2, total: 3 });
  });
  it('nextUnanswered wraps and reports -1 when done', () => {
    const ids = ['a', 'b', 'c'];
    expect(nextUnanswered(ids, { b: { selected: 'A' } }, 0)).toBe(2);
    expect(nextUnanswered(ids, { b: { selected: 'A' } }, 2)).toBe(0);
    expect(nextUnanswered(ids, { a: { selected: 'A' }, b: { selected: 'A' }, c: { selected: 'A' } }, 0)).toBe(-1);
  });
});

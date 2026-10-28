import { confidenceMatrix, formatDuration, timeAnalysis } from '../analysis';

const item = (position: number, p: { sel?: 'A' | null; ok?: boolean | null; t?: number; conf?: 'sure' | 'unsure' | 'guess'; subject?: string } = {}) => ({
  position,
  selected_option: p.sel === undefined ? ('A' as const) : p.sel,
  is_correct: p.ok === undefined ? true : p.ok,
  time_spent_seconds: p.t,
  confidence: p.conf,
  question_meta: { subject: p.subject },
});

describe('timeAnalysis', () => {
  it('needs at least 3 answered, timed questions', () => {
    expect(timeAnalysis([item(1, { t: 30 }), item(2, { t: 40 })])).toBeNull();
    // unanswered / untimed questions do not count
    expect(timeAnalysis([item(1, { t: 30 }), item(2, { t: 40 }), item(3, { sel: null, t: 90 }), item(4)])).toBeNull();
  });

  it('computes average, total, slowest and per-subject times', () => {
    const r = timeAnalysis([
      item(1, { t: 30, subject: 'Physics' }),
      item(2, { t: 90, subject: 'Physics', ok: false }),
      item(3, { t: 20, subject: 'Biology' }),
      item(4, { t: 40, subject: 'Biology' }),
      item(5, { t: 20, subject: 'Chemistry' }), // only one → no per-subject row
    ])!;
    expect(r.totalSeconds).toBe(200);
    expect(r.avgSeconds).toBe(40);
    expect(r.slowest).toEqual([
      { position: 2, seconds: 90, correct: false },
      { position: 4, seconds: 40, correct: true },
      { position: 1, seconds: 30, correct: true },
    ]);
    expect(r.bySubject).toEqual([
      { name: 'Physics', avgSeconds: 60, count: 2 },
      { name: 'Biology', avgSeconds: 30, count: 2 },
    ]);
  });

  it('flags rushed wrong answers and stuck questions', () => {
    const r = timeAnalysis([
      item(1, { t: 5, ok: false }), // rushed + wrong
      item(2, { t: 6, ok: true }), // fast but right → not "rushed wrong"
      item(3, { t: 40 }),
      item(4, { t: 49 }),
      item(5, { t: 200 }), // ≥ 2× avg and ≥ 60s → stuck
    ])!;
    expect(r.rushedWrong).toBe(1);
    expect(r.stuck).toBe(1);
  });
});

describe('confidenceMatrix', () => {
  it('is null when nothing was marked', () => {
    expect(confidenceMatrix([item(1), item(2)])).toBeNull();
  });

  it('counts correct/wrong per confidence and the two key cells', () => {
    const m = confidenceMatrix([
      item(1, { conf: 'sure', ok: true }),
      item(2, { conf: 'sure', ok: false }),
      item(3, { conf: 'sure', ok: false }),
      item(4, { conf: 'unsure', ok: true }),
      item(5, { conf: 'guess', ok: true }),
      item(6, { conf: 'guess', ok: false }),
      item(7, { conf: 'sure', sel: null, ok: null }), // unanswered: ignored
    ])!;
    expect(m.rows).toEqual([
      { key: 'sure', correct: 1, wrong: 2 },
      { key: 'unsure', correct: 1, wrong: 0 },
      { key: 'guess', correct: 1, wrong: 1 },
    ]);
    expect(m.confidentWrong).toBe(2);
    expect(m.unsureRight).toBe(2);
    expect(m.marked).toBe(6);
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatDuration(3720)).toBe('1h 02m');
    expect(formatDuration(-3)).toBe('0s');
  });
});

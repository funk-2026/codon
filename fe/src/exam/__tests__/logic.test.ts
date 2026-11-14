import { cardAction, clockOffset, formatClockHMS, formatCountdown, groupExams, paletteState, patternHint, rankText, sectionsOf } from '../logic';
import type { ExamCard } from '@/src/api/exams';

const card = (o: Partial<ExamCard>): ExamCard => ({
  id: 'x', title: 'T', kind: 'full', exam_style: 'neet', delivery: 'live', phase: 'anytime', results_released: true,
  late_entry_minutes: 15, total_questions: 180, requires_subscription: false, course_id: 'c', registered: false, ...o,
});

describe('formatCountdown / formatClockHMS', () => {
  it('reads at a glance', () => {
    expect(formatCountdown(2 * 3600_000 + 5 * 60_000)).toBe('2 h 05 min');
    expect(formatCountdown(9 * 60_000 + 30_000)).toBe('9 min 30 s');
    expect(formatCountdown(45_000)).toBe('45 s');
    expect(formatCountdown(50 * 3600_000)).toBe('2 d 2 h');
    expect(formatCountdown(-5)).toBe('0 s');
  });
  it('shows the exam timer', () => {
    expect(formatClockHMS(3 * 3600_000)).toBe('3:00:00');
    expect(formatClockHMS(65_000)).toBe('01:05');
    expect(formatClockHMS(-1)).toBe('00:00');
  });
});

describe('clockOffset', () => {
  it('is the server time minus the phone time', () => {
    expect(clockOffset('2027-05-02T10:00:10Z', new Date('2027-05-02T10:00:00Z').getTime())).toBe(10_000);
    expect(clockOffset('nope', 5)).toBe(0);
  });
});

describe('groupExams and cardAction', () => {
  const cards = [
    card({ id: 'a', phase: 'upcoming', opens_at: '2027-05-03T10:00:00Z' }),
    card({ id: 'b', phase: 'upcoming', opens_at: '2027-05-02T10:00:00Z' }),
    card({ id: 'c', phase: 'live', opens_at: '2027-05-01T10:00:00Z' }),
    card({ id: 'd', phase: 'anytime', delivery: 'anytime' }),
    card({ id: 'e', phase: 'ended', my_attempt: { id: '1', status: 'submitted', official: true, submitted_at: '2027-04-01T00:00:00Z' } }),
  ];
  it('puts the soonest upcoming first and keeps the rest apart', () => {
    const g = groupExams(cards);
    expect(g.upcoming.map((c) => c.id)).toEqual(['b', 'a']);
    expect(g.liveNow.map((c) => c.id)).toEqual(['c']);
    expect(g.library.map((c) => c.id).sort()).toEqual(['d', 'e']);
    expect(g.mine.map((c) => c.id)).toEqual(['e']);
  });
  it('chooses the button', () => {
    expect(cardAction(cards[0])).toBe('remind');
    expect(cardAction(card({ phase: 'upcoming', registered: true }))).toBe('reminded');
    expect(cardAction(cards[2])).toBe('start');
    expect(cardAction(card({ phase: 'live', my_attempt: { id: '1', status: 'in_progress', official: true } }))).toBe('resume');
    expect(cardAction(cards[4])).toBe('result');
    expect(cardAction(card({ phase: 'ended' }))).toBe('practice');
  });
});

describe('paletteState', () => {
  it('has the five exam states', () => {
    expect(paletteState({ answered: false, marked: false, visited: false })).toBe('not_visited');
    expect(paletteState({ answered: false, marked: false, visited: true })).toBe('not_answered');
    expect(paletteState({ answered: true, marked: false, visited: true })).toBe('answered');
    expect(paletteState({ answered: false, marked: true, visited: true })).toBe('marked');
    expect(paletteState({ answered: true, marked: true, visited: true })).toBe('answered_marked');
  });
});

describe('sectionsOf', () => {
  it('groups runs of the same label', () => {
    expect(sectionsOf(['Physics', 'Physics', 'Chemistry', 'Chemistry', 'Chemistry'])).toEqual([
      { name: 'Physics', from: 0, to: 1 }, { name: 'Chemistry', from: 2, to: 4 },
    ]);
  });
  it('has no sections for an unlabelled paper', () => {
    expect(sectionsOf([undefined, '', undefined])).toEqual([]);
  });
  it('names unlabelled runs between labelled ones', () => {
    expect(sectionsOf(['A', undefined]).map((s) => s.name)).toEqual(['A', 'Other']);
  });
});

describe('rankText and patternHint', () => {
  it('words a rank and an estimate', () => {
    expect(rankText({ rank: 120, total: 4812, top_percent: 3 })).toEqual({ line: 'Rank 120 of 4,812', sub: 'Top 3%' });
    expect(rankText({ rank: 5, total: 12, estimated: true }).line).toBe('Estimated rank 5 of 12');
  });
  it('warns, never blocks', () => {
    expect(patternHint('neet', 'full', 180, 180)).toBeNull();
    expect(patternHint('neet', 'full', 178, 150)).toContain('178 questions');
    expect(patternHint('school', 'full', 10, 10)).toBeNull();
  });
});

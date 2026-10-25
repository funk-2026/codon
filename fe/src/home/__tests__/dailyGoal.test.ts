import { answeredToday, DEFAULT_GOAL, normalizeGoal } from '../dailyGoal';

describe('answeredToday', () => {
  const now = new Date(2026, 9, 25, 18, 0, 0); // 25 Oct 2026, 18:00 local
  const at = (d: number, h: number) => new Date(2026, 9, d, h, 0, 0).toISOString();

  it('sums answered questions of attempts submitted today (local day)', () => {
    expect(
      answeredToday(
        [
          { status: 'submitted', submitted_at: at(25, 9), correct_count: 12, wrong_count: 3 },
          { status: 'submitted', submitted_at: at(25, 0), correct_count: 4, wrong_count: 1 }, // just after midnight
          { status: 'submitted', submitted_at: at(24, 23), correct_count: 50, wrong_count: 0 }, // yesterday
          { status: 'in_progress', submitted_at: undefined, correct_count: 7 }, // not submitted
          { status: 'submitted', submitted_at: 'garbage', correct_count: 9 },
        ],
        now,
      ),
    ).toBe(20);
  });

  it('treats missing counts as zero', () => {
    expect(answeredToday([{ status: 'submitted', submitted_at: at(25, 10) }], now)).toBe(0);
  });
});

describe('normalizeGoal', () => {
  it('accepts only the offered goals', () => {
    expect(normalizeGoal(30)).toBe(30);
    expect(normalizeGoal(17)).toBe(DEFAULT_GOAL);
    expect(normalizeGoal(null)).toBe(DEFAULT_GOAL);
    expect(normalizeGoal('20')).toBe(DEFAULT_GOAL);
  });
});

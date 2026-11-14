import { weekDays } from '../weekDays';

describe('weekDays', () => {
  const now = new Date(2026, 10, 14, 15, 0); // Sat 14 Nov 2026, local
  it('returns 7 days ending today', () => {
    const days = weekDays([], now);
    expect(days).toHaveLength(7);
    expect(days[6].today).toBe(true);
    expect(days.filter((d) => d.today)).toHaveLength(1);
    expect(days.every((d) => !d.done)).toBe(true);
  });
  it('marks days with a submitted attempt, ignoring in-progress and older ones', () => {
    const days = weekDays(
      [
        { status: 'submitted', submitted_at: new Date(2026, 10, 14, 9, 0).toISOString() },
        { status: 'submitted', submitted_at: new Date(2026, 10, 12, 22, 0).toISOString() },
        { status: 'in_progress', submitted_at: new Date(2026, 10, 13, 9, 0).toISOString() },
        { status: 'submitted', submitted_at: new Date(2026, 10, 1, 9, 0).toISOString() },
      ],
      now,
    );
    expect(days.map((d) => d.done)).toEqual([false, false, false, false, true, false, true]);
  });
});

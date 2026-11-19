import { currentWeek, dailyCounts, dayKey, monthCells } from '../monthCalendar';

const at = (y: number, m: number, d: number, extra: object = {}) => ({ status: 'submitted', submitted_at: new Date(y, m, d, 12).toISOString(), correct_count: 3, wrong_count: 2, ...extra });

describe('monthCalendar', () => {
  it('counts questions and tests per day, submitted attempts only', () => {
    const c = dailyCounts([at(2026, 10, 19), at(2026, 10, 19, { correct_count: 1, wrong_count: 0 }), at(2026, 10, 18, { status: 'in_progress' })]);
    expect(c.get('2026-11-19')).toEqual({ mcqs: 6, tests: 2 });
    expect(c.has('2026-11-18')).toBe(false);
  });
  it('the week starts on Monday and marks today and active days', () => {
    const now = new Date(2026, 10, 20, 9); // Friday
    const w = currentWeek(dailyCounts([at(2026, 10, 16)]), now);
    expect(w.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(w[0].key).toBe('2026-11-16');
    expect(w[0].active).toBe(true);
    expect(w[4].today).toBe(true);
    expect(w[5].future).toBe(true);
  });
  it('a Sunday still belongs to the week that began on Monday', () => {
    const w = currentWeek(new Map(), new Date(2026, 10, 22, 9));
    expect(w[0].key).toBe('2026-11-16');
    expect(w[6].today).toBe(true);
  });
  it('builds a month with counts on the right days', () => {
    const cells = monthCells(2026, 10, dailyCounts([at(2026, 10, 19)]), new Date(2026, 10, 20));
    const flat = cells.flat().filter(Boolean);
    expect(flat).toHaveLength(30);
    expect(flat.find((c) => c!.day === 19)!.count!.mcqs).toBe(5);
    expect(flat.find((c) => c!.day === 20)!.today).toBe(true);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2027-01-05'.replace('2027', '2026'));
  });
});

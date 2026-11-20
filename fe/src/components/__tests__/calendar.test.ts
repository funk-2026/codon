import { formatDMY, monthGrid, parseDMY, todayDMY } from '../calendar';

describe('calendar', () => {
  it('formats and parses', () => {
    expect(todayDMY(new Date(2027, 4, 3))).toBe('03/05/2027');
    expect(formatDMY(parseDMY('3/5/2027')!)).toBe('03/05/2027');
    expect(parseDMY('31/02/2027')).toBeNull();
    expect(parseDMY('nope')).toBeNull();
  });
  it('builds a Monday-first month grid', () => {
    const g = monthGrid(2027, 4); // May 2027 starts on Saturday
    expect(g[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
});

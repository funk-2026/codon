import { lastDays, niceMax, xAt, yAt } from '../chart';

describe('chart geometry', () => {
  it('picks a round top and four gridlines', () => {
    expect(niceMax([1, 2, 3])).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceMax([9]).max).toBe(12);
    expect(niceMax([]).max).toBe(4);
  });
  it('places points across the width and up the height', () => {
    expect(xAt(0, 3, 10, 110)).toBe(10);
    expect(xAt(2, 3, 10, 110)).toBe(110);
    expect(xAt(0, 1, 10, 110)).toBe(60);
    expect(yAt(0, 4, 0, 100)).toBe(100);
    expect(yAt(4, 4, 0, 100)).toBe(0);
  });
  it('lists the last days ending today', () => {
    const d = lastDays(3, new Date(2026, 10, 20));
    expect(d.map((x) => x.key)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });
});

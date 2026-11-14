import { daysUntil, formatExamDate, parseExamDate } from '../examDate';

describe('exam date helpers', () => {
  it('parses DD/MM/YYYY and refuses impossible dates', () => {
    expect(parseExamDate('03/05/2027')).toBe('2027-05-03');
    expect(parseExamDate('3/5/2027')).toBe('2027-05-03');
    expect(parseExamDate('31/02/2027')).toBeNull();
    expect(parseExamDate('2027-05-03')).toBeNull();
    expect(parseExamDate('')).toBeNull();
  });
  it('formats what the server sends', () => {
    expect(formatExamDate('2027-05-03T00:00:00Z')).toBe('03/05/2027');
    expect(formatExamDate('2027-05-03')).toBe('03/05/2027');
    expect(formatExamDate(null)).toBe('');
  });
  it('counts whole days, and is null with no date', () => {
    const now = new Date(2026, 10, 14, 23, 30); // late evening still counts as the 14th
    expect(daysUntil('2026-11-15', now)).toBe(1);
    expect(daysUntil('2026-11-14', now)).toBe(0);
    expect(daysUntil('2026-11-10', now)).toBe(-4);
    expect(daysUntil(null, now)).toBeNull();
  });
});

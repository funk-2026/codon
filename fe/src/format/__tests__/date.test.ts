import { formatDate, formatDateTime } from '../date';

describe('date helpers', () => {
  it('writes a date the same way everywhere', () => {
    expect(formatDate('2027-05-03T10:00:00Z')).toBe('3 May 2027');
  });
  it('returns an empty string for nothing or rubbish', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });
  it('includes the weekday and time', () => {
    expect(formatDateTime('2027-05-03T10:00:00Z')).toMatch(/Mon, 3 May/);
  });
});

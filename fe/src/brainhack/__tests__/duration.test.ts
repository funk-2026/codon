import { formatDuration, parseDuration } from '../duration';

describe('duration', () => {
  it('reads minutes and seconds', () => {
    expect(parseDuration('2:30')).toBe(150);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:02:03')).toBe(3723);
  });
  it('refuses what is not a time', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('2:75')).toBeNull();
    expect(parseDuration('two')).toBeNull();
    expect(parseDuration('1:2:3:4')).toBeNull();
  });
  it('writes it back', () => {
    expect(formatDuration(150)).toBe('2:30');
    expect(formatDuration(0)).toBe('');
  });
});

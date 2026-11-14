import { isOlderThan } from '../versionCompare';

describe('isOlderThan', () => {
  it('compares versions numerically', () => {
    expect(isOlderThan('1.0.0', '1.0.1')).toBe(true);
    expect(isOlderThan('1.2.0', '1.10.0')).toBe(true);
    expect(isOlderThan('2.0.0', '1.9.9')).toBe(false);
    expect(isOlderThan('1.2.3', '1.2.3')).toBe(false);
  });
  it('never blocks on a blank or malformed minimum', () => {
    expect(isOlderThan('1.0.0', '')).toBe(false);
    expect(isOlderThan('1.0.0', 'soon')).toBe(false);
    expect(isOlderThan('dev', '1.0.0')).toBe(false);
  });
});

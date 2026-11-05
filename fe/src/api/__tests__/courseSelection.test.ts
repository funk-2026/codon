import { defaultCourse, resolveCourse } from '../courseSelection';
import type { Course } from '../profile';

const c = (id: string, slug: string): Course => ({ id, name: slug, slug, is_active: true });
const neet = c('1', 'neet-ug');
const ninth = c('2', '9th-standard');
const tenth = c('3', '10th-standard');

describe('defaultCourse', () => {
  it('prefers NEET UG even when the API returns it last', () => {
    expect(defaultCourse([ninth, tenth, neet])?.id).toBe('1');
  });
  it('falls back to the first course when there is no NEET UG', () => {
    expect(defaultCourse([ninth, tenth])?.id).toBe('2');
  });
  it('is undefined for an empty list', () => {
    expect(defaultCourse([])).toBeUndefined();
  });
});

describe('resolveCourse', () => {
  it('returns the requested course', () => {
    expect(resolveCourse([neet, ninth, tenth], '3')?.id).toBe('3');
  });
  it('REGRESSION: an unknown or missing id falls back to the default, not undefined', () => {
    expect(resolveCourse([neet, ninth], 'nope')?.id).toBe('1');
    expect(resolveCourse([neet, ninth], undefined)?.id).toBe('1');
    expect(resolveCourse([neet, ninth], null)?.id).toBe('1');
  });
});

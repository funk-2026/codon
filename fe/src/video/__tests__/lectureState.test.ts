import { groupByChapter, lectureLength, lectureState, matchesFilter, PLAYBACK_SPEEDS } from '../lectureState';
import type { SubjectVideo } from '@/src/api/content';

const v = (o: Partial<SubjectVideo>): SubjectVideo => ({ id: 'a', title: 't', chapter_id: 'c1', chapter_name: 'One', chapter_order: 1, duration_seconds: 0, requires_subscription: false, progress_seconds: 0, is_completed: false, locked: false, ...o });

describe('lecture list rules', () => {
  it('classifies progress', () => {
    expect(lectureState(v({}))).toBe('unattempted');
    expect(lectureState(v({ progress_seconds: 20 }))).toBe('paused');
    expect(lectureState(v({ progress_seconds: 20, is_completed: true }))).toBe('completed');
  });
  it('filters by the five states, All by default', () => {
    expect(matchesFilter(v({ requires_subscription: true }), 'all')).toBe(true);
    expect(matchesFilter(v({ requires_subscription: true }), 'free')).toBe(false);
    expect(matchesFilter(v({}), 'free')).toBe(true);
    expect(matchesFilter(v({ progress_seconds: 5 }), 'paused')).toBe(true);
    expect(matchesFilter(v({ is_completed: true }), 'unattempted')).toBe(false);
  });
  it('groups by chapter in chapter order', () => {
    const g = groupByChapter([v({ id: '1', chapter_id: 'b', chapter_name: 'B', chapter_order: 2 }), v({ id: '2', chapter_id: 'a', chapter_name: 'A', chapter_order: 1 }), v({ id: '3', chapter_id: 'b', chapter_name: 'B', chapter_order: 2 })]);
    expect(g.map((x) => x.name)).toEqual(['A', 'B']);
    expect(g[1].videos.map((x) => x.id)).toEqual(['1', '3']);
  });
  it('formats lengths and lists the eight speeds', () => {
    expect(lectureLength(90)).toBe('1:30');
    expect(lectureLength(3725)).toBe('1:02:05');
    expect(lectureLength(0)).toBe('');
    expect(PLAYBACK_SPEEDS).toEqual([0.5, 0.75, 1, 1.2, 1.5, 1.8, 2, 3]);
  });
});

import { DEFAULT_STATE, mixValid, pyqPreset, tickLines, toBlueprint } from '../logic';

describe('toBlueprint', () => {
  it('leaves every filter out on All', () => {
    const bp = toBlueprint(DEFAULT_STATE, 'c1');
    expect(bp.filters).toEqual({});
    expect(bp.count).toBe(20);
    expect(bp.timing).toEqual({ timed: false });
    expect(bp.marking).toEqual({ preset: 'neet' });
  });
  it('maps questions-from, show and skip', () => {
    expect(toBlueprint({ ...DEFAULT_STATE, from: 'qbank', show: 'skipped', skipDays: 14 }, 'c').filters).toEqual({ source_types: ['qbank'], status: ['skipped'], exclude_attempted_within_days: 14 });
    // bookmarked ignores the Show row
    expect(toBlueprint({ ...DEFAULT_STATE, from: 'bookmarked', show: 'correct', bookmarkTypes: ['b1'] }, 'c').filters).toEqual({ status: ['bookmarked'], bookmark_collection_ids: ['b1'] });
  });
  it('makes a custom difficulty mix and tags with untagged', () => {
    const bp = toBlueprint({ ...DEFAULT_STATE, difficulty: 'custom', mix: { easy: 20, medium: 50, hard: 30 }, tagIds: ['t'], includeUntagged: true, timed: true, minutes: 50 }, 'c');
    expect(bp.difficulty_mix).toEqual({ easy: 0.2, medium: 0.5, hard: 0.3 });
    expect(bp.filters.include_untagged).toBe(true);
    expect(bp.timing).toEqual({ timed: true, duration_minutes: 50 });
  });
  it('PYQ presets use previous-year questions', () => {
    const s = pyqPreset(25);
    expect(s.count).toBe(25);
    expect(toBlueprint(s, 'c', { pyq: true }).filters).toEqual({ source_types: ['pyq'] });
  });
});

describe('mix and ticks', () => {
  it('needs the custom mix to total 100', () => {
    expect(mixValid({ ...DEFAULT_STATE, difficulty: 'custom', mix: { easy: 40, medium: 40, hard: 40 } })).toBe(false);
    expect(mixValid({ ...DEFAULT_STATE, difficulty: 'custom' })).toBe(true);
  });
  it('lists what was chosen', () => {
    const t = tickLines({ ...DEFAULT_STATE, subjectIds: ['s1'] }, { subjects: { s1: 'Biology' }, chapters: {}, tags: {} });
    expect(t[0]).toBe('20 MCQs');
    expect(t).toContain('Subjects: Biology');
    expect(t).toContain('Regular mode');
    expect(t).toContain('Timing: Untimed');
  });
});

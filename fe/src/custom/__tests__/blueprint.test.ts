import * as fs from 'fs';
import * as path from 'path';
import { blueprintKey, defaultBlueprint, normalizeSelection, pruneFilters, resolvedMarks, suggestedMinutes, toggleInList, validateBlueprint, type Limits } from '../blueprint';

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../contracts/blueprint-v1/vectors.json'), 'utf8'));
const lim: Limits = {
  min_questions: raw.limits.min_questions, max_questions: raw.limits.max_questions,
  min_duration: raw.limits.min_duration, max_duration: raw.limits.max_duration,
  allowed_sources: raw.limits.allowed_sources, tutor_enabled: raw.limits.tutor_enabled,
  status_filters_enabled: raw.limits.status_filters_enabled,
};

describe('golden vectors (shared with the Go server)', () => {
  it('loads the shared vectors', () => expect(raw.vectors.length).toBeGreaterThanOrEqual(20));
  for (const v of raw.vectors as any[]) {
    it(v.name, () => {
      const issues = validateBlueprint(v.input, lim);
      if (v.valid) {
        expect(issues).toEqual([]);
        if (v.resolved) {
          const marks = resolvedMarks({ ...defaultBlueprint('x'), ...v.input });
          expect(marks.correct).toBe(v.resolved.marking_correct);
          expect(marks.wrong).toBe(v.resolved.marking_wrong);
        }
      } else {
        expect(issues.map((i) => i.code).sort()).toEqual([...v.issue_codes].sort());
      }
    });
  }
});

describe('helpers', () => {
  it('toggleInList adds/removes without mutating', () => {
    const a = ['x'];
    expect(toggleInList(a, 'y')).toEqual(['x', 'y']);
    expect(toggleInList(a, 'x')).toEqual([]);
    expect(a).toEqual(['x']);
    expect(toggleInList(undefined, 'z')).toEqual(['z']);
  });
  it('pruneFilters drops empties so equal filters serialise identically', () => {
    expect(pruneFilters({ subject_ids: [], difficulty: ['easy'], exclude_attempted_within_days: 0, ncert: {} })).toEqual({ difficulty: ['easy'] });
    const a = defaultBlueprint('c1');
    const b = { ...a, filters: { subject_ids: [], tag_ids: [] } };
    expect(blueprintKey(a)).toBe(blueprintKey(b));
  });
  it('blueprintKey ignores the title (renaming must not re-run availability checks)', () => {
    const a = defaultBlueprint('c1');
    expect(blueprintKey(a)).toBe(blueprintKey({ ...a, title: 'Anything' }));
  });
  it('suggestedMinutes clamps', () => {
    expect(suggestedMinutes(20, 1, 5, 180)).toBe(20);
    expect(suggestedMinutes(2, 1, 5, 180)).toBe(5);
    expect(suggestedMinutes(500, 1, 5, 180)).toBe(180);
    expect(suggestedMinutes(7, 1.5, 5, 180)).toBe(11);
  });
  it('resolvedMarks presets', () => {
    const bp = defaultBlueprint('c');
    expect(resolvedMarks(bp)).toEqual({ correct: 4, wrong: -1 });
    expect(resolvedMarks({ ...bp, marking: { preset: 'no_negative' } })).toEqual({ correct: 1, wrong: 0 });
    expect(resolvedMarks({ ...bp, marking: { preset: 'custom', correct: 2, wrong: -0.5 } })).toEqual({ correct: 2, wrong: -0.5 });
  });
  const tree = [{ id: 's1', chapters: [{ id: 'c1', topics: [{ id: 't1' }, { id: 't2' }] }, { id: 'c2', topics: [] }] }];
  it('normalizeSelection removes ids covered by a broader selection', () => {
    expect(normalizeSelection({ subject_ids: ['s1'], chapter_ids: ['c1'], topic_ids: ['t1'] }, tree)).toEqual({ subject_ids: ['s1'] });
    expect(normalizeSelection({ chapter_ids: ['c1'], topic_ids: ['t1', 't2'] }, tree)).toEqual({ chapter_ids: ['c1'] });
    expect(normalizeSelection({ chapter_ids: ['c2'], topic_ids: ['t1'] }, tree)).toEqual({ chapter_ids: ['c2'], topic_ids: ['t1'] });
  });
});

import { applyPatch, summarizeBlueprint } from '../blueprint';

describe('applyPatch (server suggestions)', () => {
  const bp = { ...defaultBlueprint('c'), filters: { difficulty: ['hard' as const], ncert: { class: 11 }, status: ['incorrect' as const] }, count: 40 };
  it('clears a filter with an empty array', () => {
    const r = applyPatch(bp, { filters: { difficulty: [] } });
    expect(r.filters).toEqual({ ncert: { class: 11 }, status: ['incorrect'] });
  });
  it('null removes a key (ncert)', () => {
    expect(applyPatch(bp, { filters: { ncert: null } }).filters.ncert).toBeUndefined();
  });
  it('top-level count', () => {
    expect(applyPatch(bp, { count: 12 }).count).toBe(12);
  });
  it('does not mutate the input', () => {
    applyPatch(bp, { filters: { difficulty: [] }, count: 1 });
    expect(bp.count).toBe(40);
    expect(bp.filters.difficulty).toEqual(['hard']);
  });
  it('multi-key filter patch (tags)', () => {
    const b2 = { ...bp, filters: { tag_ids: ['a'], exclude_tag_ids: ['b'] } };
    expect(applyPatch(b2, { filters: { tag_ids: [], exclude_tag_ids: [] } }).filters).toEqual({});
  });
});

describe('summarizeBlueprint', () => {
  it('summarises', () => {
    const bp = { ...defaultBlueprint('c', 25), filters: { subject_ids: ['s1', 's2', 's3'], difficulty: ['easy' as const] }, timing: { timed: true, duration_minutes: 30 } };
    expect(summarizeBlueprint(bp, { subjects: { s1: 'Physics', s2: 'Chemistry', s3: 'Biology' } })).toBe('25 Qs · Physics, Chemistry +1 · easy · 30 min');
    expect(summarizeBlueprint(defaultBlueprint('c', 10))).toBe('10 Qs · untimed');
  });
});

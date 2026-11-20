import { pageRows, rangesOf, subjectOrder, toggleChoice, toggleSingleType } from '../logic';

describe('bookmark list rules', () => {
  it('groups into ranges of ten, the last one shorter', () => {
    expect(rangesOf(34).map((r) => r.label)).toEqual(['1-10', '11-20', '21-30', '31-34']);
    expect(rangesOf(10).map((r) => r.label)).toEqual(['1-10']);
    expect(rangesOf(0)).toEqual([]);
  });
  it('numbers rows from the start of the whole list', () => {
    const rows = Array.from({ length: 34 }, (_, i) => `q${i + 1}`);
    const page = pageRows(rows, rangesOf(34)[3]);
    expect(page.map((p) => p.n)).toEqual([31, 32, 33, 34]);
    expect(page[0].row).toBe('q31');
    expect(pageRows(rows, undefined)).toEqual([]);
  });
  it('multi-select adds and removes; an empty list means All', () => {
    expect(toggleChoice([], 'a')).toEqual(['a']);
    expect(toggleChoice(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleChoice(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleChoice(['a'], 'a')).toEqual([]);
  });
  it('tapping a type icon shows only that type, tapping again clears', () => {
    expect(toggleSingleType([], 'x')).toEqual(['x']);
    expect(toggleSingleType(['y', 'z'], 'x')).toEqual(['x']);
    expect(toggleSingleType(['x'], 'x')).toEqual([]);
  });
  it('lists Biology, Chemistry, Physics first', () => {
    expect(subjectOrder([{ name: 'Physics' }, { name: 'Zoology' }, { name: 'Biology' }, { name: 'Chemistry' }]).map((s) => s.name)).toEqual(['Biology', 'Chemistry', 'Physics', 'Zoology']);
  });
});

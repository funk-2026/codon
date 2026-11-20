import type { SchemaOverview } from '@/src/api/study';
import { applySchemaFilter, chapterProgress, EMPTY_FILTER, flattenSchema, groupByChapter, nextPulseIndex, parseSchemaCsv, sortTopics, subjectProgress, toggle, withStatus, filterSummary, heat, chapterAsked, subjectAsked, shareOf, statusCounts, matchesStatus } from '../logic';

const item = (id: string, subject: string, chapter: string, order: number) => ({ id, chapter_id: chapter, chapter_name: chapter, chapter_order: order, subject_name: subject });
const t = (id: string, status: 'yet_to_read' | 'yet_to_revise' | 'confident', by: Record<string, number>) => ({ id, name: id, total: Object.values(by).reduce((a, b) => a + b, 0), by_year: by, status });
const schema: SchemaOverview = {
  years: ['2022', '2021'],
  subjects: [
    { id: 's1', name: 'Biology', chapters: [{ id: 'c1', name: 'Genetics', topics: [t('a', 'confident', { '2022': 2 }), t('b', 'yet_to_read', { '2021': 5 })] }] },
    { id: 's2', name: 'Physics', chapters: [{ id: 'c2', name: 'Optics', topics: [t('c', 'yet_to_revise', { '2022': 1, '2021': 1 })] }] },
  ],
};

describe('groupByChapter', () => {
  const items = [item('1', 'Physics', 'Optics', 2), item('2', 'Biology', 'Genetics', 1), item('3', 'Physics', 'Motion', 1), item('4', 'Physics', 'Optics', 2)];
  it('orders chapters by syllabus and subjects Physics, Chemistry, Biology for All', () => {
    const g = groupByChapter(items, 'All');
    expect(g.map((x) => x.name)).toEqual(['Motion', 'Optics', 'Genetics']);
    expect(g[1].items).toHaveLength(2);
  });
  it('filters by subject and by chapter', () => {
    expect(groupByChapter(items, 'Biology').map((x) => x.name)).toEqual(['Genetics']);
    expect(groupByChapter(items, 'All', ['Optics']).map((x) => x.name)).toEqual(['Optics']);
  });
});

describe('pulse', () => {
  it('advances, and ends on the last item', () => {
    expect(nextPulseIndex(0, 3)).toBe(1);
    expect(nextPulseIndex(2, 3)).toBeNull();
  });
});

describe('schema', () => {
  it('counts Confident only', () => {
    expect(chapterProgress(schema.subjects[0].chapters[0])).toEqual({ confident: 1, total: 2 });
    expect(subjectProgress(schema.subjects[1])).toEqual({ confident: 0, total: 1 });
  });
  it('filters with All as the default and limits counts to chosen years', () => {
    const rows = flattenSchema(schema);
    expect(applySchemaFilter(rows, EMPTY_FILTER)).toHaveLength(3);
    expect(applySchemaFilter(rows, { ...EMPTY_FILTER, years: ['2021'] }).map((r) => r.topic.id)).toEqual(['b', 'c']);
    expect(applySchemaFilter(rows, { ...EMPTY_FILTER, statuses: ['confident'] }).map((r) => r.topic.id)).toEqual(['a']);
    expect(applySchemaFilter(rows, { ...EMPTY_FILTER, subjectIds: ['s2'] }).map((r) => r.topic.id)).toEqual(['c']);
  });
  it('Frq puts the most-asked first, Idx keeps order', () => {
    const rows = flattenSchema(schema);
    expect(sortTopics(rows, 'idx').map((r) => r.topic.id)).toEqual(['a', 'b', 'c']);
    expect(sortTopics(rows, 'frq').map((r) => r.topic.id)).toEqual(['b', 'a', 'c']);
    expect(sortTopics(rows, 'frq', ['2022']).map((r) => r.topic.id)).toEqual(['a', 'c', 'b']);
  });
  it('updates a status everywhere at once', () => {
    const next = withStatus(schema, 'b', 'confident');
    expect(subjectProgress(next.subjects[0]).confident).toBe(2);
    expect(schema.subjects[0].chapters[0].topics[1].status).toBe('yet_to_read');
  });
  it('toggles and summarises', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
    expect(filterSummary({ ...EMPTY_FILTER, years: ['2022 Re'], statuses: ['confident'] }, schema)).toBe('2022 Re · Confident');
  });
});

describe('parseSchemaCsv', () => {
  it('reads rows, skips a header, handles quotes, reports bad lines', () => {
    const r = parseSchemaCsv('subject,chapter,topic,year,subtopic,questions\nBiology,"Molecular Basis, Part 1",DNA,2022 Re,,3\nBiology,x,y,2021');
    expect(r.rows).toEqual([{ subject: 'Biology', chapter: 'Molecular Basis, Part 1', topic: 'DNA', year: '2022 Re', subtopic: '', questions: 3 }]);
    expect(r.errors).toHaveLength(1);
  });
});

describe('weightage shading', () => {
  it('scales against the biggest and eases the middle', () => {
    expect(heat(0, 10)).toBe(0);
    expect(heat(10, 10)).toBe(1);
    expect(heat(5, 10)).toBeGreaterThan(0.5);
    expect(heat(5, 0)).toBe(0);
  });
  it('adds up questions per chapter and subject, and the share of the whole', () => {
    expect(chapterAsked(schema.subjects[0].chapters[0])).toBe(7);
    expect(chapterAsked(schema.subjects[0].chapters[0], ['2022'])).toBe(2);
    expect(subjectAsked(schema.subjects[1])).toBe(2);
    expect(shareOf(7, 9)).toBe(78);
    expect(shareOf(1, 0)).toBe(0);
  });
});

describe('status bar and filter', () => {
  it('counts topics by status', () => {
    expect(statusCounts(schema.subjects[0].chapters[0].topics)).toEqual({ yet_to_read: 1, yet_to_revise: 0, confident: 1 });
  });
  it('filters by status, with All letting everything through', () => {
    const [a, b] = schema.subjects[0].chapters[0].topics;
    expect(matchesStatus(a, 'confident')).toBe(true);
    expect(matchesStatus(b, 'confident')).toBe(false);
    expect(matchesStatus(b, 'all')).toBe(true);
  });
});

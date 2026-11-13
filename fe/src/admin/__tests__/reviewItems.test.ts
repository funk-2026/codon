import { buildReviewItems, countByFilter, filterReview } from '../reviewItems';

describe('admin review items', () => {
  const items = buildReviewItems({
    tests: [{ id: 't1', title: 'Cell test', created_at: '2026-11-03T00:00:00Z', total_questions: 10, marks_per_correct: 4, marks_per_wrong: -1, course: { name: 'NEET' }, subject: { name: 'Biology' }, creator: { name: 'Asha' } }],
    content: [
      { id: 'c1', title: 'Cell video', content_type: 'video', created_at: '2026-11-01T00:00:00Z', chapter: { name: 'Cell' }, uploader: { phone_number: '999' } },
      { id: 'c2', title: 'Cell notes', content_type: 'document', created_at: '2026-11-02T00:00:00Z' },
    ],
    hacks: [{ id: 'h1', title: 'Mnemonic', category: 'Biology', read_minutes: 2, created_at: '2026-11-04T00:00:00Z' }],
    decks: [{ id: 'd1', title: 'Genetics', card_count: 1, created_at: '2026-11-05T00:00:00Z' }],
  });

  it('counts each kind and the total', () => {
    expect(countByFilter(items)).toEqual({ all: 5, tests: 1, lessons: 2, hacks: 1, decks: 1 });
  });

  it('lists the longest-waiting first and filters by kind', () => {
    expect(filterReview(items, 'all', '').map((i) => i.id)).toEqual(['c1', 'c2', 't1', 'h1', 'd1']);
    expect(filterReview(items, 'lessons', '').map((i) => i.id)).toEqual(['c1', 'c2']);
  });

  it('searches title and author', () => {
    expect(filterReview(items, 'all', 'asha').map((i) => i.id)).toEqual(['t1']);
    expect(filterReview(items, 'all', 'GENETICS').map((i) => i.id)).toEqual(['d1']);
  });

  it('describes decks and falls back for missing names', () => {
    expect(items.find((i) => i.id === 'd1')?.meta).toBe('1 card');
    expect(items.find((i) => i.id === 'c2')?.author).toBe('Unknown teacher');
  });
});

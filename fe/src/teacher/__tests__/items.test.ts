import { buildItems, filterItems, normalizeStatus, statusCounts } from '../items';

describe('teacher items', () => {
  const items = buildItems({
    tests: [{ id: 't1', title: 'Cell test', status: 'pending_review', created_at: '2026-11-01T00:00:00Z' }],
    content: [
      { id: 'c1', title: 'Cell video', content_type: 'video', status: 'published', created_at: '2026-11-03T00:00:00Z' },
      { id: 'c2', title: 'Cell notes', content_type: 'document', status: 'rejected', rejection_reason: 'Blurry', created_at: '2026-11-02T00:00:00Z' },
    ],
    hacks: [{ id: 'h1', title: 'Mnemonic', category: 'Biology', status: 'draft' }],
    decks: [{ id: 'd1', title: 'Genetics', status: 'approved', card_count: 1 }],
  });

  it('normalises the two spellings of in review and unknown values', () => {
    expect(normalizeStatus('pending_review')).toBe('pending');
    expect(normalizeStatus('pending')).toBe('pending');
    expect(normalizeStatus('???')).toBe('draft');
    expect(normalizeStatus(undefined)).toBe('draft');
  });

  it('counts every kind of item by status', () => {
    expect(statusCounts(items)).toEqual({ draft: 1, pending: 1, approved: 1, rejected: 1, published: 1 });
  });

  it('filters by segment, status and title, newest first', () => {
    expect(filterItems(items, { segment: 'lessons', status: 'all', query: '' }).map((i) => i.id)).toEqual(['c1', 'c2']);
    expect(filterItems(items, { segment: 'lessons', status: 'rejected', query: '' }).map((i) => i.id)).toEqual(['c2']);
    expect(filterItems(items, { segment: 'lessons', status: 'all', query: 'NOTES' }).map((i) => i.id)).toEqual(['c2']);
    expect(filterItems(items, { segment: 'decks', status: 'all', query: '' }).map((i) => i.breadcrumb)).toEqual(['1 card']);
  });

  it('keeps the reviewer note on rejected items', () => {
    expect(items.find((i) => i.id === 'c2')?.rejectionReason).toBe('Blurry');
  });
});

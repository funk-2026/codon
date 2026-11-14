import { bulkSummary, submitAll } from '../bulkSubmit';

const items = [
  { id: 'a', title: 'A', type: 'Test' as const },
  { id: 'b', title: 'B', type: 'Video' as const },
  { id: 'c', title: 'C', type: 'Deck' as const },
];

describe('submitAll', () => {
  it('sends everything in order', async () => {
    const order: string[] = [];
    const r = await submitAll(items, async (i) => { order.push(i.id); });
    expect(order).toEqual(['a', 'b', 'c']);
    expect(r).toEqual({ sent: 3, failed: [] });
    expect(bulkSummary(r)).toBe('Sent 3 for review');
  });
  it('keeps going after a failure and says which one', async () => {
    const r = await submitAll(items, async (i) => { if (i.id === 'b') throw new Error('needs a video'); });
    expect(r.sent).toBe(2);
    expect(r.failed).toEqual([{ id: 'b', title: 'B', reason: 'needs a video' }]);
    expect(bulkSummary(r)).toContain('“B”: needs a video');
  });
});

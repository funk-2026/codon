import { prefetchOrder } from '../prefetch';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const q = (stem: number[], opt: number[] = [], format = 'rich_v1') => ({
  question_text: stem.map((n) => `![x](media:${id(n)})`).join(' '),
  option_a: opt.map((n) => `![o](media:${id(n)})`).join(' '),
  option_b: '', option_c: '', option_d: '',
  content_format: format,
});

describe('prefetchOrder', () => {
  it('starts at the current question, wraps around, and dedupes', () => {
    const qs = [q([1]), q([2], [3]), q([1, 4]), q([5], [], 'plain')];
    expect(prefetchOrder(qs, 1)).toEqual([id(2), id(3), id(1), id(4)]);
  });
  it('ignores plain-text questions', () => {
    expect(prefetchOrder([q([9], [], 'plain')], 0)).toEqual([]);
  });
});

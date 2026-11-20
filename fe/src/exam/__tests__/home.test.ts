import { buildTestsHome } from '../logic';
import type { ExamCard } from '@/src/api/exams';

const card = (o: Partial<ExamCard>): ExamCard => ({
  id: 'x', title: 'T', kind: 'full', exam_style: 'neet', delivery: 'anytime', phase: 'anytime', results_released: true,
  late_entry_minutes: 0, total_questions: 180, requires_subscription: false, course_id: 'c', registered: false, ...o,
});

describe('buildTestsHome', () => {
  it('resume wins over everything', () => {
    const h = buildTestsHome([card({ id: 'a' }), card({ id: 'b', my_attempt: { id: 'at', status: 'in_progress', official: true } })], 'all', 0);
    expect(h.next).toMatchObject({ kind: 'resume', card: { id: 'b' } });
  });
  it('suggests a first full mock to a student with no attempts', () => {
    const h = buildTestsHome([card({ id: 'a', kind: 'subject' }), card({ id: 'b' })], 'all', 0);
    expect(h.next).toMatchObject({ kind: 'first', card: { id: 'b' } });
  });
  it('no suggestion once something is taken; upcoming is next', () => {
    const t = card({ id: 't', my_attempt: { id: 'at', status: 'submitted', official: true } });
    const u = card({ id: 'u', phase: 'upcoming', delivery: 'live', opens_at: '2030-01-01T00:00:00Z' });
    expect(buildTestsHome([t, u], 'all', 0).next).toMatchObject({ kind: 'upcoming' });
    expect(buildTestsHome([t], 'all', 0).next.kind).toBe('none');
  });
  it('groups into rows by kind and counts series progress', () => {
    const s = { id: 's', title: 'Mock series' };
    const h = buildTestsHome([
      card({ id: '1', title: 'Mock 1', series: s, my_attempt: { id: 'a', status: 'submitted', official: true } }),
      card({ id: '2', title: 'Mock 2', series: s }),
      card({ id: '3', kind: 'chapter' }),
    ], 'all', 0);
    expect(h.rows.map((r) => r.key)).toEqual(['full', 'chapter']);
    expect(h.series[0]).toMatchObject({ total: 2, done: 1, next: { id: '2' } });
    expect(h.resultsCount).toBe(1);
  });
  it('waiting lists submitted tests with hidden results; filter hides taken ones', () => {
    const w = card({ id: 'w', results_released: false, my_attempt: { id: 'a', status: 'submitted', official: true } });
    const n = card({ id: 'n', kind: 'subject' });
    expect(buildTestsHome([w, n], 'all', 0).waiting.map((c) => c.id)).toEqual(['w']);
    expect(buildTestsHome([w, n], 'new', 0).rows.flatMap((r) => r.cards.map((c) => c.id))).toEqual(['n']);
  });
});

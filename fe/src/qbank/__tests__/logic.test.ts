import { moduleMatches, moduleTitle, progressFraction, progressLine, solvedLine } from '../logic';
import type { QBankModule } from '@/src/api/qbank';

const m = (o: Partial<QBankModule>): QBankModule => ({ test_id: 't', title: 'T', chapter_id: 'c', chapter_name: 'Living world', chapter_order: 1, mcq_count: 40, requires_subscription: false, locked: false, state: 'unattempted', ...o });

describe('QBank rules', () => {
  it('shows the percentage on a solved module name only', () => {
    expect(moduleTitle(m({ state: 'completed', score_pct: 72 }))).toBe('Living world 72%');
    expect(moduleTitle(m({}))).toBe('Living world');
    expect(moduleTitle(m({ state: 'paused' }))).toBe('Living world');
  });
  it('says when it was solved', () => {
    expect(solvedLine(m({ state: 'completed', solved_at: '2026-09-22T12:00:00' }))).toBe('Solved on 22 Sep 2026');
    expect(solvedLine(m({}))).toBe('');
  });
  it('filters by the five states, All first', () => {
    expect(moduleMatches(m({ state: 'completed' }), 'all')).toBe(true);
    expect(moduleMatches(m({ requires_subscription: true }), 'free')).toBe(false);
    expect(moduleMatches(m({ state: 'paused' }), 'paused')).toBe(true);
    expect(moduleMatches(m({ state: 'completed' }), 'unattempted')).toBe(false);
  });
  it('writes the progress line', () => {
    expect(progressLine({ completed: 6, total: 20 })).toBe('6 / 20 modules completed');
    expect(progressFraction({ completed: 5, total: 20 })).toBe(0.25);
    expect(progressFraction({ completed: 0, total: 0 })).toBe(0);
  });
});

import { searchQBank } from '../logic';
describe('searchQBank', () => {
  it('finds subjects and chapters by name', () => {
    const subs = [{ subject_id: 's1', name: 'Biology', completed: 1, total: 2, modules: [{ test_id: 't1', title: 'QBank: Cell', chapter_id: 'c1', chapter_name: 'Cell', chapter_order: 1, mcq_count: 5, requires_subscription: false, locked: false, state: 'unattempted' as const }] }];
    expect(searchQBank(subs, 'bio').map((h) => h.kind)).toEqual(['subject']);
    expect(searchQBank(subs, 'cell')[0]).toMatchObject({ kind: 'chapter', testId: 't1' });
    expect(searchQBank(subs, '')).toEqual([]);
  });
});

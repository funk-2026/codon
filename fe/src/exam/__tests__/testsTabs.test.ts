import type { ExamCard, GrandAttempt } from '@/src/api/exams';
import { historyLine, analysisUnlocked, chapterStats, monthGroups, orderStats, subjectStats, tabOf, trendValue, viewOf, windowed } from '../testsTabs';

const card = (o: Partial<ExamCard>): ExamCard => ({ id: 'x', title: 'T', kind: 'full', exam_style: 'neet', delivery: 'anytime', phase: 'anytime', results_released: true, late_entry_minutes: 0, total_questions: 10, requires_subscription: false, course_id: 'c', registered: false, ...o });
const att = (o: Partial<GrandAttempt>): GrandAttempt => ({ attempt_id: 'a', test_id: 't', title: 'GT', at: '2026-01-01', score: 1, total_marks: 4, percent: 25, cohort: 0, subjects: [], chapters: [], ...o });

describe('tests tabs', () => {
  it('classifies kinds into the three tabs', () => {
    expect(tabOf(card({ kind: 'full' }))).toBe('grand');
    expect(tabOf(card({ kind: 'pyq' }))).toBe('grand');
    expect(tabOf(card({ kind: 'part' }))).toBe('mini');
    expect(tabOf(card({ kind: 'chapter' }))).toBe('mini');
    expect(tabOf(card({ kind: 'subject' }))).toBe('subject');
  });
  it('files a card under live, library or attempted', () => {
    expect(viewOf(card({ phase: 'upcoming' }))).toBe('live');
    expect(viewOf(card({ phase: 'live' }))).toBe('live');
    expect(viewOf(card({ phase: 'ended' }))).toBe('library');
    expect(viewOf(card({ my_attempt: { id: 'a', status: 'submitted', official: true } }))).toBe('attempted');
  });
  it('groups by month for the year, newest first, and keeps undated cards', () => {
    const g = monthGroups(
      [card({ id: 'a', opens_at: '2026-03-10T10:00:00' }), card({ id: 'b', opens_at: '2026-05-02T10:00:00' }), card({ id: 'c', opens_at: '2025-05-02T10:00:00' }), card({ id: 'd' })],
      'grand', 'library', 2026,
    );
    expect(g.map((x) => x.title)).toEqual(['May 2026', 'March 2026', 'Undated']);
  });
  it('lists upcoming months soonest first', () => {
    const g = monthGroups([card({ id: 'a', phase: 'upcoming', opens_at: '2026-09-10T10:00:00' }), card({ id: 'b', phase: 'upcoming', opens_at: '2026-07-10T10:00:00' })], 'grand', 'live', 2026);
    expect(g.map((x) => x.title)).toEqual(['July 2026', 'September 2026']);
  });
});

describe('grand analysis', () => {
  it('unlocks at two attempts', () => {
    expect(analysisUnlocked(1)).toBe(false);
    expect(analysisUnlocked(2)).toBe(true);
  });
  it('windows to the last 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => att({ attempt_id: String(i) }));
    expect(windowed(many, 'last20')).toHaveLength(20);
    expect(windowed(many, 'all')).toHaveLength(25);
  });
  it('ranks subjects strongest first and chapters weakest first', () => {
    const a = att({
      percentile: 80,
      subjects: [{ name: 'Physics', total: 10, attempted: 10, correct: 4, marks: 0, percent: 40 }, { name: 'Biology', total: 10, attempted: 10, correct: 9, marks: 0, percent: 90 }],
      chapters: [{ name: 'Optics', subject: 'Physics', total: 5, attempted: 5, correct: 1, marks: 0, percent: 20 }, { name: 'Motion', subject: 'Physics', total: 5, attempted: 5, correct: 3, marks: 0, percent: 60 }],
    });
    const s = orderStats(subjectStats([a]), 'strongest', 'percentage');
    expect(s.map((x) => x.name)).toEqual(['Biology', 'Physics']);
    expect(orderStats(subjectStats([a]), 'weakest', 'percentage')[0].name).toBe('Physics');
    expect(orderStats(chapterStats([a], 'Physics'), 'weakest', 'percentage').map((x) => x.name)).toEqual(['Optics', 'Motion']);
  });
  it('orders by percentile and keeps unknown percentiles last', () => {
    const a = att({ subjects: [{ name: 'A', total: 1, attempted: 1, correct: 1, marks: 1, percent: 100, percentile: 40 }, { name: 'B', total: 1, attempted: 1, correct: 0, marks: 0, percent: 0, percentile: 90 }, { name: 'C', total: 1, attempted: 1, correct: 1, marks: 1, percent: 100 }] });
    expect(orderStats(subjectStats([a]), 'strongest', 'percentile').map((x) => x.name)).toEqual(['B', 'A', 'C']);
    expect(trendValue(att({ percentile: undefined, percent: 55.4 }), 'percentile')).toBeNull();
    expect(trendValue(att({ percentile: 71.6, percent: 55.4 }), 'percentile')).toBe(72);
    expect(trendValue(att({ percent: 55.4 }), 'percentage')).toBe(55);
  });
});

describe('history rows', () => {
  it('shows the percentage and the day', () => {
    const c = card({ my_attempt: { id: 'a', status: 'submitted', official: true, submitted_at: '2026-11-18T10:00:00', score: 70, total_marks: 100 } });
    expect(historyLine(c)).toBe('70% · 18 Nov 2026');
    expect(historyLine(card({ results_released: false, my_attempt: { id: 'a', status: 'submitted', official: true, submitted_at: '2026-11-18T10:00:00' } }))).toBe('Result pending · 18 Nov 2026');
  });
  it('marks the current month', () => {
    const g = monthGroups([card({ opens_at: '2026-11-10T10:00:00' })], 'grand', 'library', 2026, new Date(2026, 10, 20));
    expect(g[0].current).toBe(true);
  });
});

import type { ExamCard, GrandAttempt } from '@/src/api/exams';
import { analysisUnlocked, chapterStats, monthGroups, subjectStats, tabOf, viewOf, windowed } from '../testsTabs';

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
    const s = subjectStats([a]);
    expect(s.map((x) => x.name)).toEqual(['Biology', 'Physics']);
    expect(s[0].percentile).toBe(80);
    expect(chapterStats([a], 'Physics').map((x) => x.name)).toEqual(['Optics', 'Motion']);
  });
});

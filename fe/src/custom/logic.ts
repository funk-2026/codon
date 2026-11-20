import type { Blueprint, Difficulty, QuestionStatus } from '@/src/api/customTests';

export const COUNTS = [10, 20, 30, 50, 70, 100] as const;
export const SKIP_DAYS = [0, 7, 14, 30] as const;
export const MINUTES = [10, 25, 50, 100] as const;

export type FromKey = 'all' | 'bookmarked' | 'qbank' | 'tests';
export type ShowKey = 'all' | 'unattempted' | 'incorrect' | 'correct' | 'skipped';
export type DiffKey = 'all' | Difficulty | 'custom';
export type OrderPick = 'random' | 'syllabus' | 'easy_first' | 'unattempted_first';
export type MarkingKey = 'neet' | 'no_negative' | 'custom';

/** Everything the three builder pages collect. Every group starts on All (or the first standard choice). */
export type CustomState = {
  count: (typeof COUNTS)[number];
  difficulty: DiffKey;
  mix: { easy: number; medium: number; hard: number };
  from: FromKey;
  bookmarkTypes: string[];
  show: ShowKey;
  skipDays: (typeof SKIP_DAYS)[number];
  order: OrderPick;
  subjectIds: string[];
  chapterIds: string[];
  tagIds: string[];
  includeUntagged: boolean;
  mode: 'exam' | 'tutor';
  marking: MarkingKey;
  custom: { correct: string; wrong: string };
  timed: boolean;
  minutes: (typeof MINUTES)[number];
  name: string;
};

export const DEFAULT_STATE: CustomState = {
  count: 20, difficulty: 'all', mix: { easy: 30, medium: 50, hard: 20 }, from: 'all', bookmarkTypes: [], show: 'all', skipDays: 0, order: 'random',
  subjectIds: [], chapterIds: [], tagIds: [], includeUntagged: false, mode: 'tutor', marking: 'neet', custom: { correct: '4', wrong: '-1' }, timed: false, minutes: 25, name: '',
};

/** The filters a template can leave for test time. Each one is a group in the builder. */
export const FILTER_KEYS = ['count', 'difficulty', 'from', 'subjects', 'tags', 'mode', 'marking', 'timing', 'skip', 'order'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export const FILTER_LABEL: Record<FilterKey, string> = {
  count: 'Number of questions', difficulty: 'Difficulty level', from: 'Questions from', subjects: 'Subjects', tags: 'Tags',
  mode: 'Mode', marking: 'Marking scheme', timing: 'Timing', skip: 'Skip recently attempted', order: 'Question order',
};

/** PYQ 10 and PYQ 25: every filter All, Tags = PYQs (previous-year questions), 10 or 25 questions. */
export const pyqPreset = (n: 10 | 25): CustomState => ({ ...DEFAULT_STATE, count: n as never, from: 'all', mode: 'tutor' });
export const PYQ_SOURCE = 'pyq';

export const mixTotal = (m: CustomState['mix']) => m.easy + m.medium + m.hard;
export const mixValid = (s: CustomState) => s.difficulty !== 'custom' || mixTotal(s.mix) === 100;

/** Turns the builder's choices into the blueprint the server validates and generates from. */
export function toBlueprint(s: CustomState, courseId: string, opts: { pyq?: boolean } = {}): Blueprint {
  const status: QuestionStatus[] = [];
  const f: Blueprint['filters'] = {};
  if (s.subjectIds.length) f.subject_ids = s.subjectIds;
  if (s.chapterIds.length) f.chapter_ids = s.chapterIds;
  if (s.difficulty === 'easy' || s.difficulty === 'medium' || s.difficulty === 'hard') f.difficulty = [s.difficulty];
  if (s.from === 'bookmarked') {
    status.push('bookmarked');
    if (s.bookmarkTypes.length) f.bookmark_collection_ids = s.bookmarkTypes;
  } else if (s.show !== 'all') status.push(s.show);
  if (status.length) f.status = status;
  if (opts.pyq) f.source_types = [PYQ_SOURCE];
  else if (s.from === 'qbank') f.source_types = ['qbank'];
  else if (s.from === 'tests') f.source_types = ['test_series'];
  if (s.tagIds.length) {
    f.tag_ids = s.tagIds;
    if (s.includeUntagged) f.include_untagged = true;
  }
  if (s.skipDays > 0) f.exclude_attempted_within_days = s.skipDays;
  const bp: Blueprint = {
    schema_version: 1, course_id: courseId, title: s.name.trim() || undefined, filters: f, count: s.count, order: s.order, mode: s.mode,
    timing: s.timed ? { timed: true, duration_minutes: s.minutes } : { timed: false },
    marking: s.marking === 'custom' ? { preset: 'custom', correct: Number(s.custom.correct) || 4, wrong: Number(s.custom.wrong) || 0 } : { preset: s.marking },
  };
  if (s.difficulty === 'custom') bp.difficulty_mix = { easy: s.mix.easy / 100, medium: s.mix.medium / 100, hard: s.mix.hard / 100 };
  return bp;
}

export type Names = { subjects: Record<string, string>; chapters: Record<string, string>; tags: Record<string, string> };

/** The tick list shown before the test is made, and again on the Start screen. */
export function tickLines(s: CustomState, n: Names, pyq = false): string[] {
  const out = [`${s.count} MCQs`];
  out.push(s.subjectIds.length ? `Subjects: ${s.subjectIds.map((i) => n.subjects[i] ?? 'Subject').join(', ')}` : 'Subjects: All subjects used');
  if (s.chapterIds.length) out.push(`Chapters: ${s.chapterIds.length} chosen`);
  out.push(pyq ? 'Tags: PYQs' : s.tagIds.length ? `Tags: ${s.tagIds.map((i) => n.tags[i] ?? 'Tag').join(', ')}${s.includeUntagged ? ' and untagged' : ''}` : 'Tags: All');
  out.push(`Difficulty: ${s.difficulty === 'custom' ? `Custom (${s.mix.easy}% easy, ${s.mix.medium}% medium, ${s.mix.hard}% hard)` : s.difficulty === 'all' ? 'All' : s.difficulty[0].toUpperCase() + s.difficulty.slice(1)}`);
  out.push(`Questions from: ${{ all: 'All', bookmarked: 'Bookmarked', qbank: 'QBank', tests: 'Tests' }[s.from]}`);
  if (s.from !== 'bookmarked' && s.show !== 'all') out.push(`Show: ${s.show[0].toUpperCase() + s.show.slice(1)}`);
  out.push(`${s.mode === 'tutor' ? 'Regular' : 'Exam'} mode`);
  out.push(`Marking: ${s.marking === 'neet' ? 'NEET +4 / −1' : s.marking === 'no_negative' ? 'No negative' : `+${s.custom.correct} / ${s.custom.wrong}`}`);
  out.push(s.timed ? `Timing: ${s.minutes} minutes` : 'Timing: Untimed');
  if (s.skipDays > 0) out.push(`Skip attempted in the last ${s.skipDays} days`);
  return out;
}

export const MAX_TEMPLATES = 3;

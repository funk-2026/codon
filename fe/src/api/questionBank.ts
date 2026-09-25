import { apiFetch, qs, type Paginated } from './client';
import type { MediaMap } from '@/src/rich/ast';
import type { AuthoredQuestion, Difficulty } from './tests';

// ── Taxonomy ────────────────────────────────────────────────────────────────

export type Topic = { id: string; chapter_id: string; name: string; order_index?: number };
/** GET /courses/:id/topics?chapter_id= */
export const listTopics = (courseId: string, chapterId?: string) =>
  apiFetch<{ topics: Topic[] }>(`/courses/${courseId}/topics${qs({ chapter_id: chapterId })}`);

/** POST /teacher/chapters/:chapter_id/topics — a teacher may add a missing topic. */
export const createTopic = (chapterId: string, name: string) =>
  apiFetch<Topic>(`/teacher/chapters/${chapterId}/topics`, { method: 'POST', body: JSON.stringify({ name }) });

export type TagRow = { id: string; slug: string; label: string; uses: number };
/** GET /tags?q= — canonical tags (aliases resolved), most-used first, max 20. */
export const searchTags = (q: string) => apiFetch<{ tags: TagRow[] }>(`/tags${qs({ q })}`);

// ── Question bank list ──────────────────────────────────────────────────────

export type MissingKind = 'difficulty' | 'chapter' | 'topic' | 'tags' | 'ncert' | 'alt_text';

export type QuestionBankParams = {
  course_id?: string;
  subject_id?: string;
  chapter_id?: string;
  test_id?: string;
  difficulty?: Difficulty;
  tag_id?: string;
  eligible?: boolean;
  flag_status?: string;
  reported?: boolean;
  missing?: MissingKind;
  q?: string;
  cursor?: string | null;
  limit?: number;
};

export type QuestionBankRow = AuthoredQuestion & {
  test: { id: string; title: string; status: string; module_type: string };
  report_count: number;
};

/** GET /teacher/questions */
export const listQuestionBank = (p: QuestionBankParams = {}) =>
  apiFetch<Paginated<QuestionBankRow> & { media: MediaMap }>(`/teacher/questions${qs({ ...p, cursor: p.cursor ?? undefined })}`);

// ── Duplicate check ─────────────────────────────────────────────────────────

export type DuplicateHit = { id: string; test_id?: string; question_text: string };

/** POST /teacher/questions/check-duplicate — warn-only. */
export const checkDuplicate = (b: {
  question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; content_format?: string; exclude_id?: string;
}) =>
  apiFetch<{ duplicates: DuplicateHit[]; warnings: { code: string; message: string }[] }>('/teacher/questions/check-duplicate', {
    method: 'POST',
    body: JSON.stringify({ content_format: 'rich_v1', ...b }),
  });

// ── Completeness / bulk edit ────────────────────────────────────────────────

export type CompletenessRow = {
  chapter_id: string | null;
  chapter: string;
  total: number;
  missing_difficulty: number;
  missing_topic: number;
  missing_tags: number;
  missing_ncert: number;
  missing_alt_text: number;
};

export const getCompleteness = (courseId?: string) =>
  apiFetch<{ chapters: CompletenessRow[]; totals: Record<string, number> }>(`/teacher/questions/completeness${qs({ course_id: courseId })}`);

export type BulkPatch = {
  subject_id?: string;
  chapter_id?: string;
  difficulty?: Difficulty;
  tags_add?: string[];
  tags_remove?: string[];
  custom_eligible?: boolean;
  move_to_test_id?: string;
};

/** POST /teacher/questions/bulk-update — up to 200 ids, all-or-nothing (403 `not_owner`). */
export const bulkUpdateQuestions = (ids: string[], patch: BulkPatch) =>
  apiFetch<{ updated: number }>('/teacher/questions/bulk-update', { method: 'POST', body: JSON.stringify({ ids, patch }) });

// ── Corrections on live questions ───────────────────────────────────────────

export type CorrectionRow = {
  id: string;
  question_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  proposed: Record<string, unknown>;
  created_at: string;
  review_note?: string;
};

/** POST /teacher/questions/:id/corrections — a content fix to a LIVE question goes through review. */
export const submitCorrection = (questionId: string, b: { reason: string; proposed: Record<string, unknown>; rescore?: boolean }) =>
  apiFetch<CorrectionRow>(`/teacher/questions/${questionId}/corrections`, { method: 'POST', body: JSON.stringify(b) });

export const listMyCorrections = () => apiFetch<{ items?: CorrectionRow[]; corrections?: CorrectionRow[] }>('/teacher/corrections');

// ── Stats / inventory ───────────────────────────────────────────────────────

export type QuestionStats = {
  attempts?: number;
  correct_pct?: number;
  avg_time_seconds?: number;
  option_distribution?: Record<string, number>;
  reports?: number;
  usage?: { custom_tests?: number };
} & Record<string, unknown>;

export const getQuestionStats = (id: string) => apiFetch<QuestionStats>(`/teacher/questions/${id}/stats`);

export const getInventory = (courseId?: string) => apiFetch<Record<string, unknown>>(`/teacher/inventory${qs({ course_id: courseId })}`);

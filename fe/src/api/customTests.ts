import { apiFetch, qs, newIdempotencyKey, type Paginated } from './client';
import type { StudentAttempt } from './attempts';
import type { Test } from './tests';

// ── Blueprint (contracts/blueprint-v1) ─────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'unattempted' | 'incorrect' | 'correct' | 'bookmarked';
export type CustomMode = 'exam' | 'tutor';
export type MarkingPreset = 'neet' | 'no_negative' | 'custom';
export type OrderKey = 'random' | 'syllabus' | 'easy_first' | 'hard_first' | 'unattempted_first';
export type StrategyKey = 'random' | 'weak_first' | 'unseen_first' | 'spaced';

export type BlueprintFilters = {
  subject_ids?: string[];
  chapter_ids?: string[];
  topic_ids?: string[];
  difficulty?: Difficulty[];
  status?: QuestionStatus[];
  bookmark_collection_ids?: string[];
  tag_ids?: string[];
  exclude_tag_ids?: string[];
  source_types?: string[];
  ncert?: { class?: number; page_from?: number; page_to?: number };
  exclude_attempted_within_days?: number;
};

export type Blueprint = {
  schema_version: number;
  course_id: string;
  title?: string;
  filters: BlueprintFilters;
  count: number;
  difficulty_mix?: Partial<Record<Difficulty, number>>;
  subject_weights?: 'even' | 'proportional' | Record<string, number>;
  order?: OrderKey;
  strategy?: StrategyKey;
  fallback?: 'fewer' | 'fail';
  mode?: CustomMode;
  timing: { timed: boolean; duration_minutes?: number };
  marking: { preset?: MarkingPreset; correct?: number; wrong?: number };
  seed?: number;
};

export type BlueprintIssue = { field: string; code: string; message: string };

// ── Builder config ─────────────────────────────────────────────────────────

export type TopicNode = { id: string; name: string; available: number };
export type ChapterNode = { id: string; name: string; available: number; topics: TopicNode[] };
export type SubjectNode = { id: string; name: string; available: number; chapters: ChapterNode[] };

export type Preset = { id: string; title: string; description?: string; blueprint: Blueprint; course_id?: string };

export type Quota = {
  tier: 'admin' | 'paid' | 'free';
  /** Free tier only. */
  max_questions?: number;
  daily_generations_left?: number;
  daily_generations_limit?: number;
  resets_at?: string;
};

export type BuilderConfig = {
  schema_version: number;
  course_id: string;
  subjects: SubjectNode[];
  difficulty: { key: Difficulty; label: string; available: number }[];
  statuses: { key: QuestionStatus; label: string; supported: boolean }[];
  sources: { key: string; label: string }[];
  tags: { id: string; label: string; uses: number }[];
  total_available: number;
  limits: {
    min_questions: number;
    max_questions: number;
    min_duration_minutes: number;
    max_duration_minutes: number;
    suggested_minutes_per_question: number;
  };
  modes: CustomMode[];
  marking_presets: { key: MarkingPreset; label: string; correct?: number; wrong?: number }[];
  orders: OrderKey[];
  strategies: StrategyKey[];
  presets: Preset[];
  flags: { tutor_mode: boolean; status_filters: boolean };
  entitlement: Quota;
};

/** GET /custom-tests/builder-config?course_id= */
export const getBuilderConfig = (courseId: string) =>
  apiFetch<BuilderConfig>(`/custom-tests/builder-config${qs({ course_id: courseId })}`);

// ── Count (dry run) ────────────────────────────────────────────────────────

export type CountBucket = { id?: string; key?: string; name: string; count: number };
export type Suggestion = { code: string; label: string; patch: Record<string, unknown>; gain: number };

export type CountResult = {
  available: number;
  requested: number;
  feasible_count: number;
  by_subject: CountBucket[];
  by_difficulty: CountBucket[];
  bottleneck?: { filter: string; reason: string; with_filter: number; without_filter: number };
  suggestions: Suggestion[];
  entitlement: { tier: Quota['tier']; course_id: string };
  /** Free tier: the count was clamped to this. */
  clamped_to?: number;
};

/** POST /custom-tests/count — cancellable; rate-limited (429 `rate_limited`). */
export const countBlueprint = (bp: Blueprint, signal?: AbortSignal) =>
  apiFetch<CountResult>('/custom-tests/count', { method: 'POST', body: JSON.stringify(bp), signal });

// ── Generate ───────────────────────────────────────────────────────────────

export type Relaxation = { code: string; message: string };
export type GenerateResult = { test: Test; relaxations: Relaxation[]; replayed: boolean };

/**
 * POST /custom-tests. Pass the SAME idempotency key on every retry of one user
 * action so a dropped response can't create two tests.
 */
export const generateTest = (bp: Blueprint, idempotencyKey: string = newIdempotencyKey()) =>
  apiFetch<GenerateResult>('/custom-tests', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(bp),
  });

/** Failure codes of POST /custom-tests worth a dedicated UI. */
export type GenerateErrorCode = 'invalid_blueprint' | 'pool_too_small' | 'quota_exceeded' | 'rate_limited' | 'too_many_tests';

// ── My custom tests ────────────────────────────────────────────────────────

export type CustomTestState = 'not_started' | 'in_progress' | 'completed';

export type CustomTestRow = {
  test: Test;
  state: CustomTestState;
  attempts_count: number;
  last_attempt?: {
    id: string;
    attempt_no: number;
    status: string;
    score?: number;
    total_marks?: number;
    submitted_at?: string;
    expires_at?: string;
  };
  summary: string;
};

/** GET /custom-tests */
export const listCustomTests = (p: { state?: CustomTestState; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<CustomTestRow>>(`/custom-tests${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export type CustomTestDetail = { test: Test; blueprint: Blueprint; summary: string; attempts: StudentAttempt[] };

/** GET /custom-tests/:id */
export const getCustomTest = (id: string) => apiFetch<CustomTestDetail>(`/custom-tests/${id}`);

/** PATCH /custom-tests/:id — rename. */
export const renameCustomTest = (id: string, title: string) =>
  apiFetch<Test>(`/custom-tests/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });

/** DELETE /custom-tests/:id — soft delete (attempts and analytics are kept). */
export const deleteCustomTest = (id: string) => apiFetch<{ message: string }>(`/custom-tests/${id}`, { method: 'DELETE' });

/** POST /custom-tests/:id/regenerate — same blueprint, fresh questions (a NEW test). */
export const regenerateCustomTest = (id: string, idempotencyKey: string = newIdempotencyKey()) =>
  apiFetch<GenerateResult>(`/custom-tests/${id}/regenerate`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } });

/** POST /custom-tests/from-attempt/:attempt_id — "Practise my mistakes". */
export const customFromAttempt = (
  attemptId: string,
  body: { include?: 'wrong' | 'unattempted' | 'both'; mode?: CustomMode; timing?: Blueprint['timing']; marking?: Blueprint['marking']; title?: string } = {},
  idempotencyKey: string = newIdempotencyKey(),
) =>
  apiFetch<GenerateResult>(`/custom-tests/from-attempt/${attemptId}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });

// ── Templates & sharing ────────────────────────────────────────────────────

export type Template = { id: string; title: string; blueprint: Blueprint; created_at: string; updated_at: string };

export const listTemplates = () => apiFetch<{ templates: Template[] }>('/custom-tests/templates');
export const createTemplate = (title: string, blueprint: Blueprint) =>
  apiFetch<Template>('/custom-tests/templates', { method: 'POST', body: JSON.stringify({ title, blueprint }) });
export const updateTemplate = (id: string, p: { title?: string; blueprint?: Blueprint }) =>
  apiFetch<Template>(`/custom-tests/templates/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
export const deleteTemplate = (id: string) => apiFetch<{ message: string }>(`/custom-tests/templates/${id}`, { method: 'DELETE' });

/** POST /custom-tests/share — shares the BLUEPRINT (never the questions). */
export const shareBlueprint = (blueprint: Blueprint) =>
  apiFetch<{ code: string; expires_at: string; deep_link: string }>('/custom-tests/share', { method: 'POST', body: JSON.stringify({ blueprint }) });

/** GET /custom-tests/shared/:code — 410 once expired. */
export const getShared = (code: string) =>
  apiFetch<{ blueprint: Blueprint; still_valid: boolean; issues: BlueprintIssue[] }>(`/custom-tests/shared/${encodeURIComponent(code)}`);

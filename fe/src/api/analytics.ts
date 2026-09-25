import { apiFetch, qs } from './client';

export type MasteryBucket = 'weak' | 'improving' | 'strong' | 'not_enough_data';

export type MasteryRow = {
  chapter_id: string | null;
  chapter: string;
  subject_id: string | null;
  subject: string;
  questions_attempted: number;
  answers: number;
  correct: number;
  /** correct ÷ answers, 0–1 */
  accuracy: number;
  last_practised: string | null;
  bucket: MasteryBucket;
};

/** GET /me/analytics/mastery */
export const getMastery = (p: { subject_id?: string } = {}) => apiFetch<{ chapters: MasteryRow[] }>(`/me/analytics/mastery${qs(p)}`);

export type Coverage = {
  seen: number;
  available: number;
  pct: number;
  subjects: { subject_id: string; subject: string; seen: number; available: number; pct: number }[];
};

/** GET /me/analytics/coverage?course_id= */
export const getCoverage = (courseId: string) => apiFetch<Coverage>(`/me/analytics/coverage${qs({ course_id: courseId })}`);

export type Patch = Record<string, unknown>;

export type WeakArea = MasteryRow & { suggestion: { label: string; patch: Patch } };

/** GET /me/analytics/weak-areas — weakest first. */
export const getWeakAreas = () => apiFetch<{ weak_areas: WeakArea[] }>('/me/analytics/weak-areas');

export type TrendPoint = { attempt_id: string; test_id: string; title: string; module: string; pct: number; submitted_at: string | null };

/** GET /me/analytics/trend — oldest first. */
export const getTrend = (p: { limit?: number; module?: string } = {}) => apiFetch<{ points: TrendPoint[] }>(`/me/analytics/trend${qs(p)}`);

export type Recommendation = { code: string; title: string; reason: string; patch: Patch };

/** GET /me/recommendations — up to 3, each with a blueprint patch the builder can pre-fill. */
export const getRecommendations = () => apiFetch<{ recommendations: Recommendation[] }>('/me/recommendations');

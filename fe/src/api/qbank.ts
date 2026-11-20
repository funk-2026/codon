import { apiFetch, qs } from './client';

export type QBankModule = {
  test_id: string;
  title: string;
  chapter_id: string;
  chapter_name: string;
  chapter_order: number;
  mcq_count: number;
  requires_subscription: boolean;
  locked: boolean;
  /** unattempted, paused (started, not finished) or completed. */
  state: 'unattempted' | 'paused' | 'completed';
  score_pct?: number;
  solved_at?: string;
  attempt_id?: string;
};
export type QBankSubject = { subject_id: string; name: string; completed: number; total: number; modules: QBankModule[] };

/** GET /qbank/overview: every QBank module by subject, with my result saved on it. */
export const getQBankOverview = (courseId?: string) => apiFetch<{ subjects: QBankSubject[] }>(`/qbank/overview${qs({ course_id: courseId })}`).then((r) => r.subjects ?? []);

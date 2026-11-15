import { apiFetch, qs } from './client';

export type ExamStyle = 'neet' | 'school';
export type ExamKind = 'chapter' | 'subject' | 'part' | 'full' | 'pyq';
export type ExamDelivery = 'anytime' | 'live';
export type ExamPhase = 'anytime' | 'upcoming' | 'live' | 'ended';

export type ExamCard = {
  id: string;
  title: string;
  kind: ExamKind;
  exam_style: ExamStyle;
  delivery: ExamDelivery;
  phase: ExamPhase;
  opens_at?: string;
  last_start_at?: string;
  ends_at?: string;
  results_at?: string;
  results_released: boolean;
  late_entry_minutes: number;
  duration_minutes?: number;
  total_questions: number;
  requires_subscription: boolean;
  course_id: string;
  exam_year?: number;
  author_name?: string;
  series?: { id: string; title: string };
  registered: boolean;
  my_attempt?: { id: string; status: string; official: boolean; submitted_at?: string };
};

/** GET /exams — published tests, each with where it stands for this student. */
export const listExams = (courseId?: string) =>
  apiFetch<{ tests: ExamCard[]; server_now: string }>(`/exams${qs({ course_id: courseId })}`);

export const registerForExam = (id: string) => apiFetch<{ registered: boolean }>(`/tests/${id}/register`, { method: 'POST' });
export const unregisterFromExam = (id: string) => apiFetch<{ registered: boolean }>(`/tests/${id}/register`, { method: 'DELETE' });

export type BoardEntry = { rank: number; name: string; score: number; is_me: boolean };
export type Leaderboard = {
  total: number;
  /** false for school-style tests: only your own position is shown. */
  public: boolean;
  entries: BoardEntry[];
  me?: { rank: number; score: number; total: number; estimated: boolean };
  locked?: boolean;
};
export const getLeaderboard = (testId: string) => apiFetch<Leaderboard>(`/tests/${testId}/leaderboard`);

export type SectionStat = {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  marks: number;
  negative: number;
  seconds: number;
  cohort_avg?: number;
  cohort_top?: number;
};
export type AttemptAnalysis = {
  sections: SectionStat[];
  hurried: { position: number; seconds: number }[];
  leave_count: number;
  leave_seconds: number;
  cohort?: { total: number; avg_score: number; top_score: number };
};
export const getAnalysis = (attemptId: string) => apiFetch<AttemptAnalysis>(`/attempts/${attemptId}/analysis`);

/** Counts one time the student left the app during an exam. */
export const reportLeftApp = (attemptId: string, seconds: number) =>
  apiFetch<{ status: string }>(`/attempts/${attemptId}/leave`, { method: 'POST', body: JSON.stringify({ seconds }) });

// ── Teacher ────────────────────────────────────────────────────────────────
export type SeriesRow = { id: string; course_id: string; title: string; description?: string };
export const listSeries = (courseId?: string) => apiFetch<{ series: SeriesRow[] }>(`/teacher/series${qs({ course_id: courseId })}`);
export const createSeries = (b: { course_id: string; title: string }) =>
  apiFetch<SeriesRow>('/teacher/series', { method: 'POST', body: JSON.stringify(b) });

// ── Admin ──────────────────────────────────────────────────────────────────
export type AdminExam = {
  id: string;
  title: string;
  kind: ExamKind;
  exam_style: ExamStyle;
  phase: ExamPhase;
  opens_at?: string;
  ends_at?: string;
  results_at?: string;
  extra_minutes: number;
  registered: number;
  started: number;
  in_progress: number;
  submitted: number;
  results_released: boolean;
};
export const adminListExams = () => apiFetch<{ exams: AdminExam[]; server_now: string }>('/admin/exams');
export const adminExtendExam = (id: string, minutes: number) =>
  apiFetch<{ extended_by: number }>(`/admin/exams/${id}/extend`, { method: 'POST', body: JSON.stringify({ minutes }) });
export const adminSetResultsAt = (id: string, resultsAt: string) =>
  apiFetch<{ results_at: string }>(`/admin/exams/${id}/results-at`, { method: 'POST', body: JSON.stringify({ results_at: resultsAt }) });
export type RescoreResult = { attempts: number; changed: number; max_drop: number; max_rise: number; applied: boolean };
export const adminRescoreExam = (id: string, dryRun: boolean) =>
  apiFetch<RescoreResult>(`/admin/exams/${id}/rescore`, { method: 'POST', body: JSON.stringify({ dry_run: dryRun }) });

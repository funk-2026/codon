import { apiFetch, qs } from './client';
import { Test } from './tests';
import type { MediaMap, RichFormat } from '@/src/rich/ast';

export type Confidence = 'sure' | 'unsure' | 'guess';
export type Option = 'A' | 'B' | 'C' | 'D';

export type StudentAttempt = {
  id: string;
  user_id: string;
  test_id: string;
  test?: Test;
  status: 'in_progress' | 'submitted';
  started_at: string;
  submitted_at?: string;
  time_taken_seconds?: number;
  score?: number;
  total_marks?: number;
  correct_count?: number;
  wrong_count?: number;
  unattempted_count?: number;
  mode?: 'exam' | 'tutor';
  /** Server-side deadline for timed tests. The client never decides expiry. */
  expires_at?: string;
  attempt_no?: number;
  auto_submitted?: boolean;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option?: Option;
  is_correct?: boolean;
  marks_awarded?: number;
  answered_at?: string;
  position?: number;
  marked_for_review?: boolean;
  time_spent_seconds?: number;
  confidence?: Confidence;
  revealed_at?: string;
};

export type StartAttemptResponse = {
  attempt: StudentAttempt;
  answers: AttemptAnswer[];
  /** Server clock at response time — used to correct device clock skew. */
  server_now: string;
  /** Attempt is open on another device: show read-only and offer takeover. */
  active_elsewhere: boolean;
};

/** POST /api/v1/tests/:id/attempts — starts or resumes. 409 `attempt_expired` if it ran out. */
export function startAttempt(testId: string): Promise<StartAttemptResponse> {
  return apiFetch<StartAttemptResponse>(`/tests/${testId}/attempts`, { method: 'POST' });
}

/**
 * Partial update: omitted fields are untouched, `selected_option: null` clears
 * the answer, toggling `marked_for_review` never wipes the answer.
 */
export type UpsertAnswerRequest = {
  selected_option?: Option | null;
  time_spent_seconds?: number;
  marked_for_review?: boolean;
  confidence?: Confidence | null;
  /** Client time of the change; server keeps the newest (last-write-wins). */
  answered_at?: string;
};

/** PUT /api/v1/attempts/:id/answers/:qid */
export function upsertAnswer(
  attemptId: string,
  questionId: string,
  data: UpsertAnswerRequest,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/attempts/${attemptId}/answers/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type BatchResult = { question_id: string; ok: boolean; code?: string; error?: string };

/** PUT /api/v1/attempts/:id/answers — up to 200 queued updates (offline recovery). */
export function batchUpsertAnswers(
  attemptId: string,
  answers: (UpsertAnswerRequest & { question_id: string })[],
): Promise<{ results: BatchResult[] }> {
  return apiFetch(`/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ answers }) });
}

export type RevealResponse = {
  question_id: string;
  correct_option: Option;
  explanation: string | null;
  is_correct: boolean;
  marks: number;
  content_format: RichFormat | string;
  media: MediaMap;
};

/** POST /api/v1/attempts/:id/answers/:qid/reveal — tutor mode only; locks the answer. */
export function revealAnswer(attemptId: string, questionId: string): Promise<RevealResponse> {
  return apiFetch<RevealResponse>(`/attempts/${attemptId}/answers/${questionId}/reveal`, { method: 'POST' });
}

/** POST /api/v1/attempts/:id/takeover — move an attempt open elsewhere to this device. */
export function takeoverAttempt(attemptId: string): Promise<{ message: string }> {
  return apiFetch(`/attempts/${attemptId}/takeover`, { method: 'POST' });
}

/** POST /api/v1/attempts/:id/submit */
export function submitAttempt(attemptId: string, timeTakenSeconds?: number): Promise<StudentAttempt> {
  return apiFetch<StudentAttempt>(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify(timeTakenSeconds != null ? { time_taken_seconds: timeTakenSeconds } : {}),
  });
}

export type BreakdownRow = {
  id?: string;
  name: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  /** correct ÷ attempted (0 when nothing attempted). */
  accuracy: number;
  marks: number;
};

export type AttemptBreakdown = {
  subjects: BreakdownRow[];
  chapters: BreakdownRow[];
  difficulty: BreakdownRow[];
};

export type AttemptResultResponse = {
  attempt: StudentAttempt;
  /** Any list may be empty (questions without metadata) — hide the section, don't fabricate. */
  breakdown?: AttemptBreakdown;
};

/** GET /api/v1/attempts/:id/result */
export function getAttemptResult(attemptId: string): Promise<AttemptResultResponse> {
  return apiFetch<AttemptResultResponse>(`/attempts/${attemptId}/result`, { method: 'GET' });
}

export type ReviewFilter = 'all' | 'correct' | 'wrong' | 'unattempted' | 'marked' | 'bookmarked';

export type ReviewItem = {
  question_id: string;
  position: number;
  content_format: RichFormat | string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: Option;
  explanation: string | null;
  selected_option: Option | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  marked_for_review: boolean;
  time_spent_seconds?: number;
  confidence?: Confidence;
  question_meta: {
    subject_id?: string;
    subject?: string;
    chapter_id?: string;
    chapter?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    ncert_class?: number;
    ncert_page?: number;
  };
  bookmarked: boolean;
  reported_by_me: boolean;
  my_rating?: number;
  cohort_correct_pct?: number;
  my_note?: string;
};

export type AttemptReviewResponse = {
  attempt_id: string;
  review: ReviewItem[];
  next_cursor: string | null;
  media: MediaMap;
};

/** GET /api/v1/attempts/:id/review — pass `limit` to paginate (cursor = last position). */
export function getAttemptReview(
  attemptId: string,
  opts: { filter?: ReviewFilter; limit?: number; cursor?: string | null } = {},
): Promise<AttemptReviewResponse> {
  return apiFetch<AttemptReviewResponse>(
    `/attempts/${attemptId}/review${qs({ filter: opts.filter, limit: opts.limit, cursor: opts.cursor ?? undefined })}`,
    { method: 'GET' },
  );
}

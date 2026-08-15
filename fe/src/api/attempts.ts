import { apiFetch } from './client';
import { Test, Question } from './tests';

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
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  question?: Question;
  selected_option?: string;
  is_correct?: boolean;
  marks_awarded?: number;
  answered_at?: string;
};

export type StartAttemptResponse = {
  attempt: StudentAttempt;
  answers: AttemptAnswer[];
};

/** POST /api/v1/tests/:id/attempts */
export function startAttempt(testId: string): Promise<StartAttemptResponse> {
  return apiFetch<StartAttemptResponse>(`/tests/${testId}/attempts`, { method: 'POST' });
}

export type UpsertAnswerRequest = {
  selected_option: string | null;
  time_taken_seconds?: number;
};

/** PUT /api/v1/attempts/:id/answers/:qid */
export function upsertAnswer(
  attemptId: string,
  questionId: string,
  data: UpsertAnswerRequest
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/attempts/${attemptId}/answers/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/attempts/:id/submit */
export function submitAttempt(attemptId: string): Promise<StudentAttempt> {
  return apiFetch<StudentAttempt>(`/attempts/${attemptId}/submit`, { method: 'POST' });
}

export type AttemptResultResponse = {
  attempt: StudentAttempt;
};

/** GET /api/v1/attempts/:id/result */
export function getAttemptResult(attemptId: string): Promise<AttemptResultResponse> {
  return apiFetch<AttemptResultResponse>(`/attempts/${attemptId}/result`, { method: 'GET' });
}

export type ReviewItem = {
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  selected_option: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
};

export type AttemptReviewResponse = {
  attempt_id: string;
  review: ReviewItem[];
};

/** GET /api/v1/attempts/:id/review */
export function getAttemptReview(attemptId: string): Promise<AttemptReviewResponse> {
  return apiFetch<AttemptReviewResponse>(`/attempts/${attemptId}/review`, { method: 'GET' });
}

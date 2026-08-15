import { apiFetch } from './client';
import { Course, Subject, Chapter } from './courses';

export type Test = {
  id: string;
  title: string;
  course_id: string;
  course?: Course;
  module_type: 'qbank' | 'test_series' | 'practice';
  requires_subscription: boolean;
  subject_id?: string;
  subject?: Subject;
  chapter_id?: string;
  chapter?: Chapter;
  total_questions: number;
  duration_minutes?: number;
  marks_per_correct: number;
  marks_per_wrong: number;
  status: string;
};

export type ListTestsResponse = {
  tests: Test[];
};

/** GET /api/v1/tests */
export function listTests(params?: {
  subject_id?: string;
  chapter_id?: string;
  module_type?: string;
}): Promise<ListTestsResponse> {
  const q = new URLSearchParams();
  if (params?.subject_id) q.append('subject_id', params.subject_id);
  if (params?.chapter_id) q.append('chapter_id', params.chapter_id);
  if (params?.module_type) q.append('module_type', params.module_type);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<ListTestsResponse>(`/tests${qs}`, { method: 'GET' });
}

export type GetTestResponse = {
  test: Test;
};

/** GET /api/v1/tests/:id */
export function getTest(id: string): Promise<GetTestResponse> {
  return apiFetch<GetTestResponse>(`/tests/${id}`, { method: 'GET' });
}

export type Question = {
  id: string;
  test_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
  order_index: number;
};

export type GetQuestionsResponse = {
  questions: Question[];
};

/** GET /api/v1/tests/:id/questions */
export function getTestQuestions(testId: string): Promise<GetQuestionsResponse> {
  return apiFetch<GetQuestionsResponse>(`/tests/${testId}/questions`, { method: 'GET' });
}

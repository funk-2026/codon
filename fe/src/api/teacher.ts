import { apiFetch } from './client';
import { ContentItem } from './content';
import { Test, Question } from './tests';

export type CreateTestRequest = {
  title: string;
  description?: string;
  course_id: string;
  module_type: 'qbank' | 'test_series' | 'practice';
  subject_id?: string;
  chapter_id?: string;
  duration_minutes?: number;
  marks_per_correct?: number;
  marks_per_wrong?: number;
  requires_subscription?: boolean;
};

/** POST /api/v1/teacher/tests */
export function createTest(data: CreateTestRequest): Promise<Test> {
  return apiFetch<Test>('/teacher/tests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/v1/teacher/tests/:id */
export function updateTest(id: string, data: Partial<CreateTestRequest>): Promise<Test> {
  return apiFetch<Test>(`/teacher/tests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/teacher/tests/:id/submit-for-review */
export function submitTestForReview(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/tests/${id}/submit-for-review`, { method: 'POST' });
}

/** GET /api/v1/teacher/tests */
export function listTeacherTests(): Promise<{ tests: Test[] }> {
  return apiFetch<{ tests: Test[] }>('/teacher/tests', { method: 'GET' });
}

export type TeacherTestDetail = {
  test: Test;
  questions: Question[];
};

/** GET /api/v1/teacher/tests/:id */
export function getTeacherTest(id: string): Promise<TeacherTestDetail> {
  return apiFetch<TeacherTestDetail>(`/teacher/tests/${id}`, { method: 'GET' });
}

export type CreateQuestionRequest = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
};

/** POST /api/v1/teacher/tests/:id/questions */
export function createQuestion(testId: string, data: CreateQuestionRequest): Promise<Question> {
  return apiFetch<Question>(`/teacher/tests/${testId}/questions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/teacher/tests/:id/csv-import */
export function importQuestionsCSV(testId: string, data: { file_key: string }): Promise<{ batch_id: string; message: string }> {
  return apiFetch<{ batch_id: string; message: string }>(`/teacher/tests/${testId}/csv-import`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** GET /api/v1/teacher/csv-imports/:id */
export type CSVImportStatus = 'processing' | 'completed' | 'completed_with_errors' | 'failed';

export type CSVImportBatch = {
  id: string;
  test_id: string;
  file_key: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: CSVImportStatus;
  created_at: string;
  completed_at?: string;
};

export type CSVImportRowError = {
  id: string;
  batch_id: string;
  row_number: number;
  error_message: string;
  raw_row_data: string;
};

export type GetCSVImportResponse = {
  batch: CSVImportBatch;
  errors: CSVImportRowError[];
};

export function getCSVImportReport(batchId: string): Promise<GetCSVImportResponse> {
  return apiFetch<GetCSVImportResponse>(`/teacher/csv-imports/${batchId}`, { method: 'GET' });
}

export type CreateContentRequest = {
  title: string;
  course_id: string;
  content_type: 'video' | 'document';
  chapter_id: string;
  file_key: string;
  requires_subscription?: boolean;
};

/** POST /api/v1/teacher/content */
export function createContent(data: CreateContentRequest): Promise<ContentItem> {
  return apiFetch<ContentItem>('/teacher/content', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/v1/teacher/content/:id */
export function updateContent(id: string, data: Partial<CreateContentRequest>): Promise<ContentItem> {
  return apiFetch<ContentItem>(`/teacher/content/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/teacher/content/:id/submit-for-review */
export function submitContentForReview(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/content/${id}/submit-for-review`, { method: 'POST' });
}

/** POST /api/v1/teacher/content/:id/publish */
export function publishContent(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/content/${id}/publish`, { method: 'POST' });
}

/** GET /api/v1/teacher/content */
export function listTeacherContent(): Promise<{ content: ContentItem[] }> {
  return apiFetch<{ content: ContentItem[] }>('/teacher/content', { method: 'GET' });
}

/** GET /api/v1/teacher/content/:id (Requires BE implementation) */
export function getTeacherContent(id: string): Promise<ContentItem> {
  return apiFetch<ContentItem>(`/teacher/content/${id}`, { method: 'GET' });
}

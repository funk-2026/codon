import { apiFetch } from './client';
import { ContentItem } from './content';
import { Test, AuthoredQuestion } from './tests';
import type { MediaMap } from '@/src/rich/ast';

export type CreateTestRequest = {
  title: string;
  description?: string;
  course_id: string;
  module_type: 'qbank' | 'test_series' | 'practice';  // 'custom' is student-generated only
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

/** DELETE /api/v1/teacher/tests/:id */
export function deleteTest(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/tests/${id}`, { method: 'DELETE' });
}

/** POST /api/v1/teacher/tests/:id/publish */
export function publishTest(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/tests/${id}/publish`, { method: 'POST' });
}

/** GET /api/v1/teacher/tests */
export function listTeacherTests(): Promise<{ tests: Test[] }> {
  return apiFetch<{ tests: Test[] }>('/teacher/tests', { method: 'GET' });
}

export type TeacherTestDetail = {
  test: Test;
  questions: AuthoredQuestion[];
  media: MediaMap;
};

/** GET /api/v1/teacher/tests/:id */
export function getTeacherTest(id: string): Promise<TeacherTestDetail> {
  return apiFetch<TeacherTestDetail>(`/teacher/tests/${id}`, { method: 'GET' });
}

export type CreateQuestionRequest = {
  /** `rich_v1` enables markup/images; omit for legacy plain text. */
  content_format?: 'plain' | 'rich_v1';
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  ncert_class?: number;
  ncert_page?: number;
  source_type?: string;
  source_year?: number;
  source_label?: string;
  custom_eligible?: boolean;
  /** Tag LABELS; unknown ones are created, aliases resolve to the canonical tag. */
  tags?: string[];
};

/** Create/update responses are the flat question plus non-blocking `warnings` and a `media` map. */
export type SavedQuestion = AuthoredQuestion & { warnings?: string[]; media?: MediaMap };

/** POST /api/v1/teacher/tests/:id/questions */
export function createQuestion(testId: string, data: CreateQuestionRequest): Promise<SavedQuestion> {
  return apiFetch<SavedQuestion>(`/teacher/tests/${testId}/questions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/v1/teacher/questions/:id */
export function updateQuestion(id: string, data: Partial<CreateQuestionRequest>): Promise<SavedQuestion> {
  return apiFetch<SavedQuestion>(`/teacher/questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** DELETE /api/v1/teacher/questions/:id */
export function deleteQuestion(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/teacher/questions/${id}`, { method: 'DELETE' });
}

export type CSVImportMode = 'validate' | 'commit' | 'update';

/**
 * POST /api/v1/teacher/tests/:id/csv-import
 * `validate` parses everything and reports problems WITHOUT saving anything;
 * `commit` inserts; `update` edits existing questions by `question_id`.
 */
export function importQuestionsCSV(
  testId: string,
  data: { file_key?: string; bundle_key?: string; mode?: CSVImportMode; allow_content_update?: boolean },
): Promise<{ batch_id: string; status: string }> {
  return apiFetch<{ batch_id: string; status: string }>(`/teacher/tests/${testId}/csv-import`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/teacher/csv-imports/:id/commit — commit a finished validate batch (idempotent; refuses if the file changed). */
export function commitCSVImport(validateBatchId: string): Promise<{ batch_id: string; status: string }> {
  return apiFetch(`/teacher/csv-imports/${validateBatchId}/commit`, { method: 'POST' });
}

export type CSVTemplateColumn = { name: string; required: boolean; description: string; allowed?: string[]; example: string };
export type CSVTemplate = { version: number; columns: CSVTemplateColumn[]; header: string; example_row: string[]; notes: string[] };

/** GET /api/v1/teacher/csv-template?version= — the column list is server-driven. */
export function getCSVTemplate(version: 1 | 2 = 2): Promise<CSVTemplate> {
  return apiFetch<CSVTemplate>(`/teacher/csv-template?version=${version}`);
}

/** GET /api/v1/teacher/csv-imports/:id */
export type CSVImportStatus = 'processing' | 'completed' | 'completed_with_errors' | 'failed';

export type CSVImportSummary = {
  rows: number;
  ok: number;
  errors: number;
  warnings: number;
  by_code: Record<string, number>;
  images_found: number;
  images_missing: string[] | null;
  unreferenced_images: string[] | null;
  template_version: number;
};

export type CSVImportBatch = {
  id: string;
  test_id: string;
  file_key: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  warning_rows?: number;
  status: CSVImportStatus;
  mode?: CSVImportMode;
  applied?: boolean;
  summary?: CSVImportSummary;
  parent_batch_id?: string;
  created_at: string;
  completed_at?: string;
};

export type CSVImportRowError = {
  id: string;
  batch_id: string;
  row_number: number;
  error_message: string;
  raw_row_data: string;
  code?: string;
  field?: string;
  severity?: 'error' | 'warning';
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

export type TeacherContentDetail = {
  content: ContentItem;
  url?: string;
};

/** GET /api/v1/teacher/content/:id */
export function getTeacherContent(id: string): Promise<TeacherContentDetail> {
  return apiFetch<TeacherContentDetail>(`/teacher/content/${id}`, { method: 'GET' });
}

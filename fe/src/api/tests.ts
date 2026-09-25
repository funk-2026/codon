import { apiFetch, qs } from './client';
import type { MediaMap, RichFormat } from '@/src/rich/ast';
import { Course, Subject, Chapter } from './courses';
import type { UserProfile } from './profile';

export type Test = {
  id: string;
  title: string;
  description?: string;
  course_id: string;
  course?: Course;
  module_type: 'qbank' | 'test_series' | 'practice' | 'custom';
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
  rejection_reason?: string;
  reviewed_at?: string;
  creator?: UserProfile;
  created_at?: string;
  /** authored (teacher) | generated (student custom test) */
  origin?: 'authored' | 'generated';
  visibility?: 'public' | 'private';
  mode?: 'exam' | 'tutor';
  expires_at?: string;
  rating_avg?: number;
  rating_count?: number;
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
  return apiFetch<ListTestsResponse>(`/tests${qs(params ?? {})}`, { method: 'GET' });
}

export type ActiveAttempt = {
  id: string;
  started_at: string;
  expires_at?: string;
  answered: number;
  total: number;
};

export type GetTestResponse = {
  test: Test & { my_rating?: number };
  /** Present when the student has an in-progress attempt → offer Resume. */
  active_attempt?: ActiveAttempt;
};

/** GET /api/v1/tests/:id */
export function getTest(id: string): Promise<GetTestResponse> {
  return apiFetch<GetTestResponse>(`/tests/${id}`, { method: 'GET' });
}

/** Question as shown DURING an attempt — never carries the answer or explanation. */
export type Question = {
  id: string;
  test_id: string;
  /** `plain` = legacy row, rendered verbatim. `rich_v1` = markup (see src/rich). */
  content_format: RichFormat | string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  order_index: number;
  position: number;
};

export type GetQuestionsResponse = {
  questions: Question[];
  attempt_id: string;
  /** id → resolved image. Signed URLs rotate; cache by id (see MediaImage). */
  media: MediaMap;
};

/** GET /api/v1/tests/:id/questions */
export function getTestQuestions(testId: string): Promise<GetQuestionsResponse> {
  return apiFetch<GetQuestionsResponse>(`/tests/${testId}/questions`, { method: 'GET' });
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Tag = { id: string; name: string; slug?: string };

/**
 * Question as seen by its AUTHOR (teacher/admin): includes the answer key,
 * explanation and metadata. Never shown to a student mid-attempt.
 */
export type AuthoredQuestion = Omit<Question, 'position'> & {
  position?: number;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  difficulty?: Difficulty;
  ncert_class?: number;
  ncert_page?: number;
  source_type?: string;
  source_year?: number;
  source_label?: string;
  custom_eligible?: boolean;
  question_type?: string;
  version?: number;
  lang?: string;
  flag_status?: 'active' | 'under_review' | 'retired' | string;
  tags?: Tag[];
  created_at?: string;
  updated_at?: string;
};

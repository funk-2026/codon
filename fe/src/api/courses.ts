import { apiFetch } from './client';
import { Course } from './profile';
export type { Course };

export type ListCoursesResponse = {
  courses: Course[];
};

/** GET /api/v1/courses */
export function listCourses(): Promise<ListCoursesResponse> {
  return apiFetch<ListCoursesResponse>('/courses', { method: 'GET' });
}

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  description: string;
  order_index: number;
  content_count?: number;
  test_count?: number;
};

export type Subject = {
  id: string;
  course_id: string;
  name: string;
  description: string;
  order_index: number;
  chapters: Chapter[];
};

export type CurriculumResponse = {
  course: Course & { subjects: Subject[] };
};

/** GET /api/v1/courses/:id/curriculum */
export function getCurriculum(courseId: string): Promise<CurriculumResponse> {
  return apiFetch<CurriculumResponse>(`/courses/${courseId}/curriculum`, { method: 'GET' });
}

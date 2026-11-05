import type { Course } from './profile';

/**
 * The course a teacher starts on. NEET UG when it exists (so the default doesn't depend on the order
 * the API happens to return), otherwise the first course.
 */
export function defaultCourse(courses: Course[]): Course | undefined {
  return courses.find((c) => c.slug === 'neet-ug') ?? courses[0];
}

/** Resolve a course id from navigation params, falling back to the default. */
export function resolveCourse(courses: Course[], id?: string | null): Course | undefined {
  return (id ? courses.find((c) => c.id === id) : undefined) ?? defaultCourse(courses);
}

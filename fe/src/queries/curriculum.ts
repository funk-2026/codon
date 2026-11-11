import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/auth/AuthContext';
import { getCurriculum, listCourses } from '@/src/api/courses';
import { getChapterContent, getContentItem } from '@/src/api/content';
import { ApiError } from '@/src/api/client';
import { listTests } from '@/src/api/tests';
import { keys } from './keys';
import { useMe } from './profile';

/** Subject → chapter tree for the course the signed-in student picked. */
export function useCurriculum() {
  const auth = useAuth();
  const courseId = auth.status === 'authenticated' ? auth.user.selected_course_id : null;
  return useQuery({
    queryKey: keys.curriculum(courseId),
    queryFn: () => getCurriculum(courseId as string),
    enabled: !!courseId,
    staleTime: 5 * 60_000, // the curriculum rarely changes
  });
}

export function useHasSubscription(): boolean {
  const me = useMe();
  return !!me.data?.active_subscription;
}

/** Videos and notes in a chapter (Learn). */
export const useChapterContent = (chapterId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.chapterContent(chapterId),
    queryFn: () => getChapterContent(chapterId as string),
    enabled: enabled && !!chapterId,
  });

/** Tests in a chapter (Practice), optionally ranked by rating. */
export const useChapterTests = (
  chapterId: string | undefined,
  kind: string | undefined,
  topRated: boolean,
  enabled = true,
) =>
  useQuery({
    queryKey: keys.chapterTests(chapterId, kind, topRated),
    queryFn: () =>
      listTests({ chapter_id: chapterId, module_type: kind, sort: topRated ? 'rating' : undefined }),
    enabled: enabled && !!chapterId,
  });

/** One video or note, plus the other items in its chapter (for the "next up" list). */
export const useContentItem = (id: string | undefined) =>
  useQuery({
    queryKey: ['content-item', id],
    queryFn: async () => {
      const res = await getContentItem(id as string);
      const siblings = res.content.chapter_id
        ? (await getChapterContent(res.content.chapter_id)).content.filter((c) => c.id !== id)
        : [];
      return { item: res.content, url: res.url, siblings };
    },
    enabled: !!id,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });

/** All courses (profile setup, teacher and admin pickers). Rarely changes. */
export const useCourses = () =>
  useQuery({ queryKey: ['courses'], queryFn: listCourses, select: (r) => r.courses, staleTime: 10 * 60_000 });

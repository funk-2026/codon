import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/src/api/profile';
import { listTeacherContent, listTeacherTests } from '@/src/api/teacher';
import { keys } from './keys';

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: getMe });

/** Items a teacher owns: content plus tests. */
export const useTeacherContentCount = () =>
  useQuery({
    queryKey: keys.teacher.contentCount(),
    queryFn: async () => {
      const [content, tests] = await Promise.all([listTeacherContent(), listTeacherTests()]);
      return (content.content?.length ?? 0) + (tests.tests?.length ?? 0);
    },
  });

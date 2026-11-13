import { useQuery } from '@tanstack/react-query';
import { listTeacherContent, listTeacherTests } from '@/src/api/teacher';
import { listTeacherBrainHacks } from '@/src/api/discover';
import { listTeacherDecks } from '@/src/api/flashcardsTeacher';
import { buildItems } from './items';

/**
 * Everything the teacher has authored, in one list. Brain Hacks and decks live in their own
 * tables, so a failure there must not blank the tests and lessons.
 */
export const useTeacherItems = () =>
  useQuery({
    queryKey: ['teacher', 'items'],
    queryFn: async () => {
      const [tests, content, hacks, decks] = await Promise.all([
        listTeacherTests(),
        listTeacherContent(),
        listTeacherBrainHacks().catch(() => ({ brain_hacks: [] })),
        listTeacherDecks().catch(() => ({ decks: [] })),
      ]);
      return buildItems({ tests: tests.tests, content: content.content, hacks: hacks.brain_hacks, decks: decks.decks });
    },
  });

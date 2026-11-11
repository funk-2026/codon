import { useQuery } from '@tanstack/react-query';
import { getCompleteness } from '@/src/api/questionBank';
import { listTeacherDecks } from '@/src/api/flashcardsTeacher';

export const useCompleteness = () =>
  useQuery({
    queryKey: ['teacher', 'completeness'],
    queryFn: () => getCompleteness().then((r) => ({ chapters: r.chapters ?? [], totals: r.totals ?? {} })),
  });

export const useTeacherDecks = () =>
  useQuery({ queryKey: ['teacher', 'decks'], queryFn: listTeacherDecks, select: (r) => r.decks });

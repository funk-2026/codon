import { useQuery } from '@tanstack/react-query';
import { listTeacherReports } from '@/src/api/moderation';
import { getCompleteness } from '@/src/api/questionBank';

/** Page size used to count: anything at the cap reads as "N+". */
export const INBOX_CAP = 20;

/**
 * What is waiting on the teacher: open student reports and questions missing metadata.
 * Drives the badges on Home and the Questions tab. (Corrections wait on a reviewer, not on the teacher, so they aren't counted.)
 */
export const useTeacherInbox = () =>
  useQuery({
    queryKey: ['teacher', 'inbox'],
    queryFn: async () => {
      const [reports, completeness] = await Promise.all([
        listTeacherReports({ status: 'open', limit: INBOX_CAP }).catch(() => ({ items: [] as unknown[] })),
        getCompleteness().catch(() => ({ totals: {} as Record<string, number> })),
      ]);
      const t = (completeness.totals ?? {}) as Record<string, number>;
      return {
        reports: (reports.items ?? []).length,
        needsTags: (t.missing_difficulty ?? 0) + (t.missing_tags ?? 0) + (t.missing_topic ?? 0) + (t.missing_alt_text ?? 0),
      };
    },
  });

export const countLabel = (n: number) => (n >= INBOX_CAP ? `${INBOX_CAP}+` : String(n));

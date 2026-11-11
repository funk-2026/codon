import { useQuery } from '@tanstack/react-query';
import { getAttempts, getRecentContent } from '@/src/api/profile';
import { getAttemptResult } from '@/src/api/attempts';
import { ApiError } from '@/src/api/client';
import { getModule } from '@/src/modules/registry';
import type { StudentAttempt } from '@/src/api/attempts';
import { keys } from './keys';

export type Attempt = {
  id: string;
  /** Needed to resume: the question screen starts/resumes by TEST id, not attempt id. */
  testId: string;
  title: string;
  breadcrumb: string;
  module: string;
  group: 'Today' | 'This Week' | 'Earlier';
  status: 'submitted' | 'in_progress';
  score?: string;
  scorePct?: number;
};

/** Raw attempts list, shared by the Practice tab, history and result screens. */
export const useAttempts = () => useQuery({ queryKey: keys.attempts, queryFn: getAttempts });

/** The student's attempts, grouped by recency for the history screen. */
export const useAttemptHistory = () =>
  useQuery({
    queryKey: keys.attempts,
    queryFn: getAttempts,
    select: (res): Attempt[] => {
      const now = new Date();
      return res.attempts.map((a: StudentAttempt): Attempt => {
          const startedAt = new Date(a.started_at);
          const diffMs = now.getTime() - startedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          let group: Attempt['group'] = 'Earlier';
          if (diffDays < 1) group = 'Today';
          else if (diffDays < 7) group = 'This Week';
          
          const module = getModule(a.test?.module_type).label;

          return {
            id: a.id,
            testId: a.test_id,
            title: a.test?.title || 'Unknown Test',
            breadcrumb: a.test?.subject?.name ? `${a.test.subject.name} › ${a.test.chapter?.name || 'General'}` : (a.test?.course?.name || 'General'),
            module,
            group,
            status: a.status,
            score: a.status === 'submitted' ? (a.total_marks ? `${a.score ?? 0}/${a.total_marks}` : `${a.score ?? 0}`) : undefined,
            scorePct: a.status === 'submitted' && (a.total_marks || 0) > 0 ? ((a.score || 0) / (a.total_marks || 1)) * 100 : undefined,
          };
        });
    },
  });

/** "Continue watching/reading" items on the Learn tab. */
export const useRecentContent = () => useQuery({ queryKey: keys.recentContent, queryFn: getRecentContent });

/**
 * An attempt's result. Right after a deadline the server may still be finalising it, so with
 * `expired` a 404 is retried a few times (1.5s apart) before it counts as a failure.
 */
export const useAttemptResult = (id: string | undefined, expired: boolean) =>
  useQuery({
    queryKey: [...keys.attempts, 'result', id],
    queryFn: () => getAttemptResult(id as string),
    enabled: !!id,
    retry: (count, err) => (expired && err instanceof ApiError && err.status === 404 ? count < 5 : false),
    retryDelay: 1500,
  });

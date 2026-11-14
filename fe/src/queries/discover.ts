import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { getExplore, listDecks, listNotifications, markNotificationsRead, quickCards, type NotificationAudience } from '@/src/api/discover';
import { listMyReports } from '@/src/api/reports';
import { getMyKYC } from '@/src/api/kyc';
import { keys } from './keys';

type Page = Awaited<ReturnType<typeof listNotifications>>;

/** Notifications for one view of the app: an admin can open the Teacher and Student views too, and each shows only its own. */
export const useNotifications = (audience: NotificationAudience) =>
  useInfiniteQuery({
    queryKey: [...keys.notifications, audience],
    queryFn: ({ pageParam }) => listNotifications({ limit: 30, cursor: pageParam ?? undefined, audience }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

/** Marks the given notifications (or all, when called with no ids) read, updating the list immediately. */
export function useMarkNotificationsRead(audience: NotificationAudience) {
  const qc = useQueryClient();
  const key = [...keys.notifications, audience];
  return useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids, audience),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<InfiniteData<Page>>(key);
      const now = new Date().toISOString();
      qc.setQueryData<InfiniteData<Page>>(key, (old) => {
        if (!old) return old;
        let cleared = 0;
        const pages = old.pages.map((pg) => ({
          ...pg,
          items: pg.items.map((n) => {
            if (n.read_at || (ids && !ids.includes(n.id))) return n;
            cleared++;
            return { ...n, read_at: now };
          }),
        }));
        pages[0] = { ...pages[0], unread_count: ids ? Math.max(0, pages[0].unread_count - cleared) : 0 };
        return { ...old, pages };
      });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
    },
  });
}

export const useMyReports = () =>
  useInfiniteQuery({
    queryKey: keys.myReports,
    queryFn: ({ pageParam }) => listMyReports({ limit: 20, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

export const useDecks = (courseId: string | null | undefined, q: string) =>
  useInfiniteQuery({
    queryKey: keys.decks(courseId, q),
    queryFn: ({ pageParam }) =>
      listDecks({ course_id: courseId ?? undefined, q: q || undefined, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

export const useMyKyc = () => useQuery({ queryKey: keys.myKyc, queryFn: getMyKYC });

export const useExplore = (courseId: string | null | undefined) =>
  useQuery({ queryKey: ['explore', courseId], queryFn: () => getExplore(courseId as string), enabled: !!courseId });

/** Size and time estimate of the Quick review set, shown on the Flashcards hero. */
export const useQuickPreview = (courseId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['quick-cards-preview', courseId],
    queryFn: () => quickCards({ course_id: courseId ?? undefined, limit: 10 }),
    enabled: enabled && !!courseId,
    staleTime: 60_000,
  });

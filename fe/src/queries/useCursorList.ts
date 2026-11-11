import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';

type Page<T> = { rows: T[]; media: Record<string, any>; next: string | null };
type Raw = { next_cursor: string | null; media?: Record<string, any> };

/**
 * A cursor-paginated list ("Load more") on top of useInfiniteQuery. Every list screen
 * used to hand-roll rows/cursor/loading/error/more state; this gives them one shape,
 * plus `setRows` for optimistic edits after approve/reject/delete.
 */
export function useCursorList<T, R extends Raw>(
  queryKey: QueryKey,
  fetchPage: (cursor?: string) => Promise<R>,
  pick: (raw: R) => T[],
  enabled = true,
) {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey,
    enabled,
    queryFn: async ({ pageParam }): Promise<Page<T>> => {
      const raw = await fetchPage(pageParam ?? undefined);
      return { rows: pick(raw), media: raw.media ?? {}, next: raw.next_cursor };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const media: Record<string, any> = Object.assign({}, ...(q.data?.pages.map((p) => p.media) ?? []));

  const setRows = (update: (prev: T[]) => T[]) =>
    qc.setQueryData<InfiniteData<Page<T>, string | null>>(queryKey, (old) => {
      if (!old) return old;
      const all = update(old.pages.flatMap((p) => p.rows));
      const last = old.pages[old.pages.length - 1];
      return { ...old, pages: [{ rows: all, media: Object.assign({}, ...old.pages.map((p) => p.media)), next: last.next }], pageParams: [old.pageParams[0]] };
    });

  return {
    rows,
    media,
    loading: q.isPending,
    error: q.isError,
    hasMore: q.hasNextPage,
    more: q.isFetchingNextPage,
    load: () => void q.refetch(),
    loadMore: () => q.fetchNextPage(),
    setRows,
  };
}

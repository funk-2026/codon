import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteBookmark, getBookmarkIds, putBookmark, type BookmarkIds, type BookmarkItemType } from '@/src/api/bookmarks';

/** Bookmark state for flash cards and lessons (questions have their own, richer context). */
export function useItemBookmark(type: Exclude<BookmarkItemType, 'question'>, id: string | undefined) {
  const qc = useQueryClient();
  const key = ['bookmark-ids', type] as const;
  const ids = useQuery({ queryKey: key, queryFn: () => getBookmarkIds(type), staleTime: 60_000 });
  const saved = !!id && !!ids.data?.ids.includes(id);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (saved) await deleteBookmark(type, id);
      else await putBookmark({ item_type: type, item_id: id });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<BookmarkIds>(key);
      qc.setQueryData<BookmarkIds>(key, (old) => {
        if (!old || !id) return old;
        return { ...old, ids: saved ? old.ids.filter((x) => x !== id) : [...old.ids, id] };
      });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['bookmarks'] });
      void qc.invalidateQueries({ queryKey: ['bookmark-collections'] });
    },
  });

  return { saved, toggle: () => toggle.mutate(), busy: toggle.isPending, failed: toggle.isError };
}

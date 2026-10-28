import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/src/api/client';
import { deleteBookmark, getBookmarkIds, putBookmark } from '@/src/api/bookmarks';
import { useAuth } from '@/src/auth/AuthContext';
import { track } from '@/src/analytics/track';

/**
 * In-memory set of bookmarked question ids (FE-3.1). One source of truth so the
 * bookmark icon is correct instantly on every screen (runtime, review, lists)
 * and a toggle on one screen shows on the others without refetching.
 * Toggles are optimistic and roll back if the server refuses.
 */
type Ctx = {
  ready: boolean;
  isBookmarked: (questionId: string) => boolean;
  /** Returns the new state; throws ApiError on failure (state already rolled back). */
  toggle: (questionId: string, collectionId?: string) => Promise<boolean>;
  /** Save into (or move to) a specific list. Throws ApiError on failure. */
  saveTo: (questionId: string, collectionId: string) => Promise<void>;
  /** The list a bookmarked question is in (undefined if not bookmarked or unknown). */
  collectionOf: (questionId: string) => string | undefined;
  count: number;
};

const BookmarksContext = createContext<Ctx>({
  ready: false, isBookmarked: () => false, toggle: async () => false, saveTo: async () => {}, collectionOf: () => undefined, count: 0,
});

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [colOf, setColOf] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const busy = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setIds(new Set());
      setColOf(new Map());
      setReady(false);
      return;
    }
    let cancelled = false;
    getBookmarkIds('question')
      .then((r) => {
        if (cancelled) return;
        setIds(new Set(r.ids));
        const m = new Map<string, string>();
        for (const [cid, qids] of Object.entries(r.by_collection ?? {})) for (const q of qids ?? []) m.set(q, cid);
        setColOf(m);
        setReady(true);
      })
      .catch(() => !cancelled && setReady(true)); // an empty set is a safe fallback; toggles still work
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  const toggle = useCallback(
    async (questionId: string, collectionId?: string) => {
      if (busy.current.has(questionId)) return ids.has(questionId); // ignore double-taps
      busy.current.add(questionId);
      const was = ids.has(questionId);
      const apply = (on: boolean) =>
        setIds((s) => {
          const n = new Set(s);
          if (on) n.add(questionId);
          else n.delete(questionId);
          return n;
        });
      apply(!was);
      try {
        if (was) {
          await deleteBookmark('question', questionId);
          setColOf((m) => { const n = new Map(m); n.delete(questionId); return n; });
        } else {
          const b = await putBookmark({ item_type: 'question', item_id: questionId, collection_id: collectionId });
          setColOf((m) => new Map(m).set(questionId, b.collection_id));
        }
        track('bookmark.toggled', { on: !was });
        return !was;
      } catch (e) {
        apply(was); // roll back
        throw e instanceof ApiError ? e : new ApiError('Could not update bookmark', 0);
      } finally {
        busy.current.delete(questionId);
      }
    },
    [ids],
  );

  const saveTo = useCallback(async (questionId: string, collectionId: string) => {
    const b = await putBookmark({ item_type: 'question', item_id: questionId, collection_id: collectionId });
    setIds((s) => new Set(s).add(questionId));
    setColOf((m) => new Map(m).set(questionId, b.collection_id ?? collectionId));
    track('bookmark.toggled', { on: true, chosen: true });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ready, isBookmarked: (id) => ids.has(id), toggle, saveTo, collectionOf: (id) => colOf.get(id), count: ids.size }),
    [ready, ids, toggle, saveTo, colOf],
  );
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export const useBookmarks = () => useContext(BookmarksContext);

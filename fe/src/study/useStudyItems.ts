import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/auth/AuthContext';
import { listPulse } from '@/src/api/study';
import { useDecks } from '@/src/queries/discover';
import type { ChapterItem } from './logic';

export type StudyKind = 'pulse' | 'flashcards';
export type StudyItem = ChapterItem & { id: string; title: string; meta: string; done: boolean; locked: boolean; /** Cards due or new; 0 means caught up, so the deck opens plain revision. */ queued: number; body?: string };

const MAX_PAGES = 20;

/** The items of Pulse or Flashcards in one shape, so one list screen serves both. Decks without a chapter sit under "General". */
export function useStudyItems(kind: StudyKind) {
  const { user } = useAuth();
  const course = user?.selected_course_id ?? undefined;
  const pulse = useQuery({ queryKey: ['pulse', course], queryFn: () => listPulse(course), enabled: kind === 'pulse' });
  const decks = useDecks(kind === 'flashcards' ? course : null, '');
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = decks;
  const pages = decks.data?.pages.length ?? 0;
  useEffect(() => {
    if (kind === 'flashcards' && hasNextPage && !isFetchingNextPage && pages < MAX_PAGES) void fetchNextPage();
  }, [kind, hasNextPage, isFetchingNextPage, fetchNextPage, pages]);

  const items = useMemo<StudyItem[]>(() => {
    if (kind === 'pulse') {
      return (pulse.data ?? []).map((p) => ({ id: p.id, title: p.title, meta: p.read ? 'Read' : '', done: p.read, locked: false, queued: 0, body: p.body, chapter_id: p.chapter_id, chapter_name: p.chapter_name, chapter_order: p.chapter_order, subject_name: p.subject_name }));
    }
    return (decks.data?.pages.flatMap((pg) => pg.decks) ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      meta: `${d.card_count} cards${d.progress?.due ? ` · ${d.progress.due} due` : ''}`,
      done: d.card_count > 0 && (d.progress?.learned ?? 0) >= d.card_count,
      locked: !!d.locked,
      queued: d.progress ? d.progress.due + d.progress.new : d.card_count,
      chapter_id: d.chapter_id ?? 'none',
      chapter_name: d.chapter_name ?? 'General',
      chapter_order: d.chapter_order ?? 9999,
      subject_name: d.subject_name ?? 'General',
    }));
  }, [kind, pulse.data, decks.data]);

  const q = kind === 'pulse' ? pulse : decks;
  return { items, isPending: q.isPending, isError: q.isError, refetch: () => void q.refetch() };
}

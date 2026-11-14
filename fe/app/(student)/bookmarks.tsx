import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookmarkSimple, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, SegmentedControl, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useFlag } from '@/src/config/AppConfigContext';
import { QuestionPreviewCard, RichContent, type MediaMap } from '@/src/rich';
import { listBookmarkCollections, listBookmarks, putBookmark, deleteBookmark, type BookmarkCollection, type BookmarkItemType, type BookmarkRow } from '@/src/api/bookmarks';
import { useBookmarks } from '@/src/bookmarks/BookmarksContext';
import { ROUTES } from '@/src/navigation/routes';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

const PAGE = 20;

export default function BookmarksRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { toggle } = useBookmarks();
  const customOn = useFlag('custom_test.enabled');

  const queryClient = useQueryClient();
  const collectionsQuery = useQuery({ queryKey: ['bookmark-collections'], queryFn: listBookmarkCollections, select: (r) => r.collections });
  const collections: BookmarkCollection[] = collectionsQuery.data ?? [];
  const [kind, setKind] = useState<BookmarkItemType>('question');
  const [active, setActive] = useState<string | 'all'>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const list = useInfiniteQuery({
    queryKey: ['bookmarks', kind, active, query],
    queryFn: ({ pageParam }) =>
      listBookmarks({ item_type: kind, collection_id: kind === 'question' && active !== 'all' ? active : undefined, q: query || undefined, limit: PAGE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows: BookmarkRow[] = list.data?.pages.flatMap((p) => p.items) ?? [];
  const media: MediaMap = Object.assign({}, ...(list.data?.pages.map((p) => p.media ?? {}) ?? []));
  const cursor = list.hasNextPage ? 'more' : null;
  const loading = list.isPending;
  const more = list.isFetchingNextPage;
  const error = list.isError;
  const load = () => void list.refetch();
  const loadMore = () => void list.fetchNextPage().then((r) => { if (r.isError) show('Couldn’t load more.', 'error'); });
  const refreshBookmarks = () => {
    void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    void queryClient.invalidateQueries({ queryKey: ['bookmark-collections'] });
  };
  const [moveRow, setMoveRow] = useState<BookmarkRow | null>(null);


  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);



  const remove = async (row: BookmarkRow) => {
    try {
      await toggle(row.item_id); // optimistic global state; deletes on the server
      refreshBookmarks();
    } catch {
      show('Couldn’t remove the bookmark.', 'error');
    }
  };

  const removeItem = async (row: BookmarkRow) => {
    try {
      await deleteBookmark(row.item_type, row.item_id);
      void queryClient.invalidateQueries({ queryKey: ['bookmark-ids'] });
      refreshBookmarks();
    } catch {
      show('Couldn’t remove the bookmark.', 'error');
    }
  };

  const move = async (row: BookmarkRow, to: BookmarkCollection) => {
    setMoveRow(null);
    try {
      await putBookmark({ item_type: 'question', item_id: row.item_id, collection_id: to.id });
      refreshBookmarks();
      show(`Moved to ${to.label}`, 'success');
    } catch {
      show('Couldn’t move it. Try again.', 'error');
    }
  };

  const practise = () =>
    router.push({
      pathname: ROUTES.student.customBuilder,
      params: { patch: JSON.stringify({ filters: { status: ['bookmarked'], ...(active !== 'all' ? { bookmark_collection_ids: [active] } : {}) } }) },
    });

  const chip = (on: boolean) => ({
    minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <Screen>
      <ScreenHeader title="Bookmarks" />

      <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
        <InputField label="Search bookmarks" value={q} onChangeText={setQ} autoCorrect={false} />
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
        <SegmentedControl
          options={[{ key: 'question' as const, label: 'Questions' }, { key: 'flashcard' as const, label: 'Flash cards' }, { key: 'content' as const, label: 'Lessons' }]}
          value={kind}
          onChange={(k) => { setKind(k); setActive('all'); }}
        />
      </View>

      {kind === 'question' ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        <Pressable onPress={() => setActive('all')} accessibilityRole="button" accessibilityState={{ selected: active === 'all' }} style={chip(active === 'all')}>
          <Text style={[type['type/caption'], { color: active === 'all' ? color('accent/default') : color('text/secondary') }]}>All</Text>
        </Pressable>
        {collections.map((c) => (
          <Pressable key={c.id} onPress={() => setActive(c.id)} accessibilityRole="button" accessibilityState={{ selected: active === c.id }} style={chip(active === c.id)}>
            <Text style={[type['type/caption'], { color: active === c.id ? color('accent/default') : color('text/secondary') }]}>{c.label} · {c.count}</Text>
          </Pressable>
        ))}
      </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={180} radius={radius.lg} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load your bookmarks" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BookmarkSimple size={32} color={color('text/tertiary')} />}
            title={query ? 'No matches' : 'No bookmarks yet'}
            description={query ? 'Try a different search.' : kind === 'question' ? 'Tap the bookmark icon on any question while practising or reviewing to save it here.' : kind === 'flashcard' ? 'Tap the bookmark icon while studying a flash card to save it here.' : 'Tap the bookmark icon on a lesson to save it here.'}
          />
        ) : (
          <>
            {customOn && kind === 'question' ? <SecondaryButton label={active === 'all' ? 'Practise my bookmarks' : 'Practise this list'} onPress={practise} /> : null}
            {rows.map((r, i) =>
              r.question ? (
                <View key={r.id} style={{ gap: space.xs }}>
                  <QuestionPreviewCard q={r.question} index={i} media={media} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.md }}>
                    <TextButton label="Move" onPress={() => setMoveRow(r)} />
                    <TextButton label="Remove" onPress={() => remove(r)} />
                  </View>
                </View>
              ) : r.flashcard ? (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: ROUTES.student.flashcardStudy, params: { deckId: String(r.flashcard?.deck_id), all: '1' } })}
                  accessibilityRole="button"
                  style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}
                >
                  <RichContent value={String(r.flashcard.front ?? '')} format={String(r.flashcard.content_format ?? 'plain')} media={media} variant="stem" />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.md }}>
                    <TextButton label="Remove" onPress={() => void removeItem(r)} />
                  </View>
                </Pressable>
              ) : r.content ? (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: r.content?.content_type === 'video' ? ROUTES.student.videoPlayer : ROUTES.student.contentReader, params: { id: r.item_id } })}
                  accessibilityRole="button"
                  style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}
                >
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{r.content.content_type === 'video' ? 'Video lesson' : 'Notes'}</Text>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{String(r.content.title ?? '')}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.md }}>
                    <TextButton label="Remove" onPress={() => void removeItem(r)} />
                  </View>
                </Pressable>
              ) : null,
            )}
            {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!moveRow} onClose={() => setMoveRow(null)} title="Move to…">
        <View style={{ gap: space.sm }}>
          {collections.map((c) => (
            <PrimaryButton key={c.id} label={c.label} onPress={() => moveRow && move(moveRow, c)} disabled={moveRow?.collection_id === c.id} />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

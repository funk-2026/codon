import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookmarkSimple, CaretLeft, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useFlag } from '@/src/config/AppConfigContext';
import { QuestionPreviewCard, type MediaMap } from '@/src/rich';
import { listBookmarkCollections, listBookmarks, putBookmark, type BookmarkCollection, type BookmarkRow } from '@/src/api/bookmarks';
import { useBookmarks } from '@/src/bookmarks/BookmarksContext';

const PAGE = 20;

export default function BookmarksRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { toggle } = useBookmarks();
  const customOn = useFlag('custom_test.enabled');

  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [active, setActive] = useState<string | 'all'>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [moveRow, setMoveRow] = useState<BookmarkRow | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    listBookmarkCollections().then((r) => setCollections(r.collections)).catch(() => {});
  }, []);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const r = await listBookmarks({ item_type: 'question', collection_id: active === 'all' ? undefined : active, q: query || undefined, limit: PAGE });
      if (my !== seq.current) return;
      setRows(r.items);
      setMedia(r.media ?? {});
      setCursor(r.next_cursor);
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [active, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const r = await listBookmarks({ item_type: 'question', collection_id: active === 'all' ? undefined : active, q: query || undefined, limit: PAGE, cursor });
      setRows((p) => [...p, ...r.items]);
      setMedia((m) => ({ ...m, ...(r.media ?? {}) }));
      setCursor(r.next_cursor);
    } catch {
      show('Couldn’t load more.', 'error');
    } finally {
      setMore(false);
    }
  };

  const remove = async (row: BookmarkRow) => {
    try {
      await toggle(row.item_id); // optimistic global state; deletes on the server
      setRows((p) => p.filter((r) => r.id !== row.id));
      setCollections((cs) => cs.map((c) => (c.id === row.collection_id ? { ...c, count: Math.max(0, c.count - 1) } : c)));
    } catch {
      show('Couldn’t remove the bookmark.', 'error');
    }
  };

  const move = async (row: BookmarkRow, to: BookmarkCollection) => {
    setMoveRow(null);
    try {
      await putBookmark({ item_type: 'question', item_id: row.item_id, collection_id: to.id });
      if (active !== 'all') setRows((p) => p.filter((r) => r.id !== row.id));
      else setRows((p) => p.map((r) => (r.id === row.id ? { ...r, collection_id: to.id } : r)));
      show(`Moved to ${to.label}`, 'success');
    } catch {
      show('Couldn’t move it. Try again.', 'error');
    }
  };

  const practise = () =>
    router.push({
      pathname: '/(student)/(practice)/custom-builder',
      params: { patch: JSON.stringify({ filters: { status: ['bookmarked'], ...(active !== 'all' ? { bookmark_collection_ids: [active] } : {}) } }) },
    });

  const chip = (on: boolean) => ({
    minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Bookmarks</Text>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
        <InputField label="Search bookmarks" value={q} onChangeText={setQ} autoCorrect={false} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        <Pressable onPress={() => setActive('all')} accessibilityRole="button" accessibilityState={{ selected: active === 'all' }} style={chip(active === 'all')}>
          <Text style={[type['type/caption'], { color: active === 'all' ? color('accent/default') : color('text/secondary') }]}>All</Text>
        </Pressable>
        {collections.map((c) => (
          <Pressable key={c.id} onPress={() => setActive(c.id)} accessibilityRole="button" accessibilityState={{ selected: active === c.id }} style={chip(active === c.id)}>
            <Text style={[type['type/caption'], { color: active === c.id ? color('accent/default') : color('text/secondary') }]}>{c.label} · {c.count}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={180} radius={radius.lg} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load your bookmarks" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BookmarkSimple size={32} color={color('text/tertiary')} />}
            title={query ? 'No matches' : 'No bookmarks yet'}
            description={query ? 'Try a different search.' : 'Tap the bookmark icon on any question while practising or reviewing to save it here.'}
          />
        ) : (
          <>
            {customOn ? <SecondaryButton label={active === 'all' ? 'Practise my bookmarks' : 'Practise this list'} onPress={practise} /> : null}
            {rows.map((r, i) =>
              r.question ? (
                <View key={r.id} style={{ gap: space.xs }}>
                  <QuestionPreviewCard q={r.question} index={i} media={media} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.md }}>
                    <TextButton label="Move" onPress={() => setMoveRow(r)} />
                    <TextButton label="Remove" onPress={() => remove(r)} />
                  </View>
                </View>
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
    </SafeAreaView>
  );
}

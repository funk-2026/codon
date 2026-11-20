import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { BookmarkSimple, CaretRight, Check, MagnifyingGlass, Square, CheckSquare, X } from 'phosphor-react-native';
import { BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SegmentedControl, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getCurriculum } from '@/src/api/courses';
import { getBookmarkSummary, listBookmarkCollections, listBookmarks, type BookmarkRow } from '@/src/api/bookmarks';
import { plainText, type MediaMap } from '@/src/rich';
import { TypeIcon } from '@/src/bookmarks/TypeIcon';
import { pageRows, rangesOf, subjectOrder, toggleChoice, toggleSingleType, TYPE_ORDER } from '@/src/bookmarks/logic';
import { setReattempt } from '@/src/bookmarks/reattemptStore';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { usePullRefresh } from '@/src/components/PullRefresh';

type Tab = 'question' | 'flashcard' | 'pulse';
type Scope = 'landing' | 'all' | string; // a subject id once inside one subject

/** Bookmarks: a landing with the three bookmark types and the subjects, then a list inside All subjects or one subject. */
export default function BookmarksRoute() {
  const { color, type, space, radius } = useTheme();
  const pull = usePullRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('question');
  const [scope, setScope] = useState<Scope>('landing');
  const [types, setTypes] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [rangeIx, setRangeIx] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftTypes, setDraftTypes] = useState<string[]>([]);
  const [draftChapters, setDraftChapters] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const itemType = tab === 'flashcard' ? 'flashcard' : tab === 'pulse' ? 'pulse' : 'question';
  const collections = useQuery({ queryKey: ['bookmark-collections'], queryFn: listBookmarkCollections, select: (r) => r.collections });
  const summary = useQuery({ queryKey: ['bookmark-summary', itemType], queryFn: () => getBookmarkSummary(itemType) });
  const curriculum = useQuery({ queryKey: ['curriculum', user?.selected_course_id], queryFn: () => getCurriculum(String(user?.selected_course_id)), enabled: !!user?.selected_course_id, staleTime: 10 * 60_000 });
  const cols = useMemo(() => [...(collections.data ?? [])].sort((a, b) => TYPE_ORDER.indexOf(a.key as never) - TYPE_ORDER.indexOf(b.key as never)), [collections.data]);
  const keyOf = useMemo(() => Object.fromEntries(cols.map((c) => [c.id, c.key])), [cols]);
  const countOfType = (id: string) => (summary.data?.by_collection ?? []).find((x) => x.collection_id === id)?.count ?? 0;
  const subjects = subjectOrder(summary.data?.by_subject ?? []);
  const subjectName = (id?: string) => (summary.data?.by_subject ?? []).find((s) => s.subject_id === id)?.name ?? '';
  const subjectChapters = scope !== 'landing' && scope !== 'all' ? (curriculum.data?.course.subjects.find((s) => s.id === scope)?.chapters ?? []) : [];

  const inList = scope !== 'landing';
  const list = useInfiniteQuery({
    queryKey: ['bookmarks-list', itemType, scope, types.join(','), chapters.join(','), query],
    queryFn: ({ pageParam }) => listBookmarks({
      item_type: itemType, limit: 50, cursor: pageParam ?? undefined, q: query || undefined,
      ...(types.length ? { collection_ids: types.join(',') } : {}),
      ...(scope !== 'all' ? { subject_ids: scope } : {}),
      ...(chapters.length ? { chapter_ids: chapters.join(',') } : {}),
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: inList,
  });
  useRefetchOnFocus(() => { void summary.refetch(); void collections.refetch(); void list.refetch(); });
  // Lists are short, so every page is fetched and the numbering and ranges cover the whole list.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const pages = list.data?.pages ?? [];
  const rows: BookmarkRow[] = pages.flatMap((p) => p.items);
  const media: MediaMap = Object.assign({}, ...pages.map((p) => p.media ?? {}));
  const ranges = rangesOf(rows.length);
  const range = ranges[Math.min(rangeIx, Math.max(0, ranges.length - 1))];
  const visible = pageRows(rows, range);

  const goScope = (s: Scope, preset: string[] = []) => { setScope(s); setTypes(preset); setChapters([]); setRangeIx(0); setSearching(false); setQ(''); };
  const back = () => (scope === 'landing' ? router.back() : goScope('landing'));
  const changeTab = (t: Tab) => { setTab(t); goScope('landing'); };

  const open = (row: BookmarkRow, index: number) => {
    if (tab === 'pulse') {
      if (row.pulse) router.push({ pathname: ROUTES.student.pulseReader, params: { id: row.pulse.id, subject: 'All' } });
      return;
    }
    if (tab === 'flashcard') {
      const deck = row.deck?.id ?? (row.flashcard as { deck_id?: string } | undefined)?.deck_id;
      if (deck) router.push({ pathname: ROUTES.student.flashcardStudy, params: { deckId: deck, all: '1' } });
      return;
    }
    setReattempt({ rows, media, collectionKey: keyOf });
    router.push({ pathname: ROUTES.student.bookmarkSolve, params: { start: String(index) } });
  };

  const typeStrip = (
    <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center', paddingVertical: space.xs }}>
      {cols.map((c) => {
        const on = types.length === 1 && types[0] === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => (inList ? (setTypes(toggleSingleType(types, c.id)), setRangeIx(0)) : goScope('all', [c.id]))}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.label}, ${countOfType(c.id)}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: on ? color('accent/tint') : 'transparent' }}
          >
            <TypeIcon typeKey={c.key} size={22} />
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>({countOfType(c.id)})</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const title = scope === 'landing' ? 'Bookmarks' : scope === 'all' ? 'All subjects' : subjectName(scope) || 'Bookmarks';
  const noun = tab === 'flashcard' ? 'flashcards' : tab === 'pulse' ? 'pulse items' : 'questions';

  return (
    <Screen>
      <ScreenHeader
        title={title}
        onBack={back}
        right={(
          <Pressable onPress={() => setSearching((s) => !s)} accessibilityRole="button" accessibilityLabel="Search bookmarks" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {searching ? <X size={22} color={color('text/primary')} /> : <MagnifyingGlass size={22} color={color('text/primary')} />}
          </Pressable>
        )}
      />
      <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
        <SegmentedControl options={[{ key: 'question' as const, label: 'Questions' }, { key: 'flashcard' as const, label: 'Flashcards' }, { key: 'pulse' as const, label: 'Pulse' }]} value={tab} onChange={changeTab} />
        {searching ? (
          <View style={{ marginTop: space.sm }}>
            <InputField value={q} onChangeText={(t) => { setQ(t); if (scope === 'landing') goScope('all'); }} placeholder={`Search ${noun}`} autoFocus />
          </View>
        ) : null}
      </View>

      <ScrollView refreshControl={pull.control} contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] + insets.bottom, gap: space.sm }} showsVerticalScrollIndicator={false}>
        {scope === 'landing' ? (
          summary.isPending ? (
            <SkeletonBlock height={160} radius={radius.lg} />
          ) : summary.isError ? (
            <ErrorBanner onRetry={() => void summary.refetch()} />
          ) : (
            <>
              <Pressable onPress={() => goScope('all')} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>All subjects ({summary.data.total})</Text>
                <CaretRight size={18} color={color('text/tertiary')} />
              </Pressable>
              {typeStrip}
              {subjects.map((s) => (
                <Pressable key={s.subject_id} onPress={() => goScope(s.subject_id)} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                  <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name} ({s.count})</Text>
                  <CaretRight size={18} color={color('text/tertiary')} />
                </Pressable>
              ))}
              {summary.data.total === 0 ? <Text style={[type['type/body-m'], { color: color('text/tertiary'), textAlign: 'center', marginTop: space.md }]}>Nothing saved yet. Bookmark {tab === 'flashcard' ? 'a flashcard deck' : tab === 'pulse' ? 'a Pulse item' : 'a question'} to find it here.</Text> : null}
            </>
          )
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>{typeStrip}</View>
              <SecondaryButton label={types.length + chapters.length > 0 ? `Filter (${types.length + chapters.length})` : 'Filter'} onPress={() => { setDraftTypes(types); setDraftChapters(chapters); setFilterOpen(true); }} />
            </View>
            {list.isPending ? (
              <SkeletonBlock height={120} radius={radius.lg} />
            ) : list.isError ? (
              <ErrorBanner onRetry={() => void list.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState icon={<BookmarkSimple size={32} color={color('text/tertiary')} />} title={types.length || chapters.length || query ? 'No matches' : `No ${noun} here yet`} description={types.length || chapters.length || query ? 'Try a different filter.' : `Bookmarked ${noun} show up here.`} action={types.length || chapters.length || query ? <SecondaryButton label="Clear filters" onPress={() => { setTypes([]); setChapters([]); setQ(''); setRangeIx(0); }} /> : undefined} />
            ) : (
              <>
                <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>{rows.length} {rows.length === 1 ? noun.replace(/s$/, '') : noun}</Text>
                {ranges.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.xs }}>
                    {ranges.map((r) => {
                      const on = r.index === range?.index;
                      return (
                        <Pressable key={r.label} onPress={() => setRangeIx(r.index)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}>
                          <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{r.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
                {visible.map(({ n, row }) => {
                  const text = tab === 'pulse'
                    ? row.pulse?.title ?? ''
                    : row.deck
                    ? row.deck.title
                    : tab === 'flashcard'
                    ? plainText(String((row.flashcard as { front?: string } | undefined)?.front ?? ''), String((row.flashcard as { content_format?: string } | undefined)?.content_format ?? 'plain'))
                    : plainText(row.question?.question_text ?? '', row.question?.content_format ?? 'plain');
                  return (
                    <Pressable key={row.id} onPress={() => open(row, n - 1)} accessibilityRole="button" accessibilityLabel={`${n}. ${text}`} style={({ pressed }) => [{ flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, minHeight: 64, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/tertiary'), width: 28 }]}>{n}.</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[type['type/body-m'], { color: color('text/primary') }]} numberOfLines={2}>{text || 'Open to read'}</Text>
                        {tab === 'question' ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{subjectName(row.question?.subject_id)}</Text> : null}
                        {tab === 'pulse' && row.pulse ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{row.pulse.subject} › {row.pulse.chapter}</Text> : null}
                        {row.deck ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{row.deck.card_count} cards{row.deck.chapter ? ` · ${row.deck.chapter}` : ''}</Text> : null}
                      </View>
                      <TypeIcon typeKey={keyOf[row.collection_id] ?? 'revise_later'} />
                    </Pressable>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" maxHeightPct={0.9}>
        <ScrollView contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>BOOKMARK TYPE</Text>
          <Choice label="All" on={draftTypes.length === 0} onPress={() => setDraftTypes([])} />
          {cols.map((c) => <Choice key={c.id} label="" icon={<TypeIcon typeKey={c.key} />} on={draftTypes.includes(c.id)} onPress={() => setDraftTypes(toggleChoice(draftTypes, c.id))} />)}
          {scope !== 'all' && scope !== 'landing' ? (
            <>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.sm }]}>CHAPTERS ({subjectChapters.length})</Text>
              <Choice label="All chapters" on={draftChapters.length === 0} onPress={() => setDraftChapters([])} />
              {subjectChapters.map((c) => <Choice key={c.id} label={c.name} on={draftChapters.includes(c.id)} onPress={() => setDraftChapters(toggleChoice(draftChapters, c.id))} />)}
            </>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <TextButton label="Clear" onPress={() => { setDraftTypes([]); setDraftChapters([]); }} />
            <View style={{ flex: 1 }}><PrimaryButton label="Apply" onPress={() => { setTypes(draftTypes); setChapters(draftChapters); setRangeIx(0); setFilterOpen(false); }} /></View>
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function Choice({ label, icon, on, onPress }: { label: string; icon?: React.ReactNode; on: boolean; onPress: () => void }) {
  const { color, type, space } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label || 'Bookmark type'} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {on ? <CheckSquare size={22} color={color('accent/default')} weight="fill" /> : <Square size={22} color={color('text/tertiary')} />}
      {icon}
      {label ? <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>{label}</Text> : null}
      {on ? <Check size={0} color="transparent" /> : null}
    </Pressable>
  );
}

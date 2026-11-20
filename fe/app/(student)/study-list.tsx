import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretRight, CheckCircle, Funnel, ListBullets, Lock, MagnifyingGlass } from 'phosphor-react-native';
import { BottomSheet, EmptyState, ErrorBanner, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { groupByChapter, LOCAL_SUBJECTS, searchMatch, toggle, type LocalSubject } from '@/src/study/logic';
import { useStudyItems, type StudyItem, type StudyKind } from '@/src/study/useStudyItems';

/**
 * One combined list for a subject: chapter names as small headings, every item a tappable row beneath its chapter.
 * Index jumps to a chapter inside the same list; Filter limits the chapters. There is no chapter or topic picker page.
 */
export default function StudyListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; subject?: string; q?: string }>();
  const kind: StudyKind = params.kind === 'flashcards' ? 'flashcards' : 'pulse';
  const subject: LocalSubject = LOCAL_SUBJECTS.find((s) => s === params.subject) ?? 'All';
  const { items, isPending, isError, refetch } = useStudyItems(kind);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'index' | 'filter' | null>(null);
  const [q, setQ] = useState(params.q ?? '');
  const scroller = useRef<ScrollViewInstance>(null);
  const ys = useRef<Record<string, number>>({});

  const visible = items.filter((i) => searchMatch(i.title, i.chapter_name, q));
  const groups = groupByChapter(visible, subject, chapterIds);
  const allGroups = groupByChapter(items, subject);

  const openItem = (it: StudyItem) => {
    if (kind === 'pulse') return router.push({ pathname: ROUTES.student.pulseReader, params: { id: it.id, subject } });
    if (it.locked) return router.push(ROUTES.student.subscriptionPlans);
    router.push({ pathname: ROUTES.student.flashcardStudy, params: it.queued > 0 ? { deckId: it.id } : { deckId: it.id, all: '1' } });
  };
  const jump = (id: string) => {
    setSheet(null);
    // After the sheet closes, scroll to where that chapter's heading sits.
    setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, (ys.current[id] ?? 0) - 8), animated: true }), 250);
  };

  const headerRight = (
    <View style={{ flexDirection: 'row' }}>
      <Pressable onPress={() => setSheet('index')} accessibilityRole="button" accessibilityLabel="Index of chapters" style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
        <ListBullets size={22} color={color('text/primary')} />
      </Pressable>
      <Pressable onPress={() => { setDraft(chapterIds); setSheet('filter'); }} accessibilityRole="button" accessibilityLabel={`Filter${chapterIds.length ? `, ${chapterIds.length} chapters chosen` : ''}`} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Funnel size={22} color={chapterIds.length ? color('accent/default') : color('text/primary')} weight={chapterIds.length ? 'fill' : 'regular'} />
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title={`${kind === 'pulse' ? 'Pulse' : 'Flashcards'} · ${subject}`} right={headerRight} />
      <View style={{ paddingHorizontal: space.md, paddingTop: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color('border/subtle'), backgroundColor: color('bg/surface'), paddingHorizontal: space.sm }}>
          <MagnifyingGlass size={18} color={color('text/tertiary')} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { flex: 1, color: color('text/primary'), minHeight: 44 }]} />
        </View>
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {isPending ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={56} radius={radius.md} />)
        ) : isError ? (
          <ErrorBanner onRetry={refetch} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<MagnifyingGlass size={32} color={color('text/tertiary')} />} title="Nothing here" description={q || chapterIds.length ? 'No items match.' : 'Nothing has been added for this subject yet.'} action={q || chapterIds.length ? <TextButton label="Clear" onPress={() => { setQ(''); setChapterIds([]); }} /> : undefined} />
        ) : (
          groups.map((g) => (
            <View key={g.id} onLayout={(e) => { ys.current[g.id] = e.nativeEvent.layout.y + space.md; }} style={{ gap: space.xs }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                {g.name.toUpperCase()}{subject === 'All' ? ` · ${g.subject}` : ''}
              </Text>
              {g.items.map((it) => (
                <Pressable key={it.id} onPress={() => openItem(it)} accessibilityRole="button" accessibilityLabel={`${it.title}. ${it.meta}`} style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{it.title}</Text>
                    {it.meta ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{it.meta}</Text> : null}
                  </View>
                  {it.locked ? <Lock size={18} color={color('text/tertiary')} weight="fill" /> : it.done ? <CheckCircle size={20} color={color('semantic/success')} weight="fill" /> : <CaretRight size={16} color={color('text/tertiary')} />}
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={sheet === 'index'} onClose={() => setSheet(null)} title="Chapters" maxHeightPct={0.8}>
        <View style={{ gap: 2, paddingBottom: space.lg }}>
          {allGroups.map((g) => (
            <Pressable key={g.id} onPress={() => jump(g.id)} accessibilityRole="button" disabled={!groups.some((x) => x.id === g.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', opacity: groups.some((x) => x.id === g.id) ? 1 : 0.4 }}>
              <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{g.name}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{g.items.length}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'filter'} onClose={() => setSheet(null)} title="Filter chapters" maxHeightPct={0.85}>
        <View style={{ gap: 2, paddingBottom: space.lg }}>
          {[{ id: '', name: 'All chapters' }, ...allGroups].map((g) => {
            const on = g.id === '' ? draft.length === 0 : draft.includes(g.id);
            return (
              <Pressable key={g.id || 'all'} onPress={() => setDraft((d) => (g.id === '' ? [] : toggle(d, g.id)))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: on ? color('accent/default') : color('border/strong'), backgroundColor: on ? color('accent/default') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <CheckCircle size={14} color={color('accent/on-accent')} weight="fill" /> : null}
                </View>
                <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{g.name}</Text>
              </Pressable>
            );
          })}
          <PrimaryButton label="Apply" onPress={() => { setChapterIds(draft); setSheet(null); }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

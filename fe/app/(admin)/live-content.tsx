import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cards, ClipboardText, FileText, Lightbulb, PlayCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SegmentedControl, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { ReasonSheet } from '@/src/admin/ReasonSheet';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListContent, adminListTests } from '@/src/api/admin';
import { adminListBrainHacks, adminListDecks } from '@/src/api/contentReview';
import { takedown, type TakedownKind } from '@/src/api/adminOps';
import { allPages } from '@/src/api/paginate';
import { shadow } from '@/src/theme/elevation';

type Seg = 'tests' | 'lessons' | 'hacks' | 'decks';
type Row = { id: string; title: string; meta: string; kind: TakedownKind; icon: 'test' | 'video' | 'document' | 'hack' | 'deck' };

const SEGMENTS: { key: Seg; label: string }[] = [
  { key: 'tests', label: 'Tests' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'hacks', label: 'Hacks' },
  { key: 'decks', label: 'Decks' },
];
const ICON = { test: ClipboardText, video: PlayCircle, document: FileText, hack: Lightbulb, deck: Cards } as const;

/** Everything students can see right now, so an admin can pull something back with a reason. */
export default function LiveContentRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [seg, setSeg] = useState<Seg>('tests');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const live = useQuery({
    queryKey: ['admin', 'live', seg],
    queryFn: async (): Promise<Row[]> => {
      if (seg === 'tests') {
        const r = await allPages((cursor) => adminListTests('published', { cursor, limit: 200 }).then((x) => ({ items: x.tests, next: x.next_cursor })));
        return r.items.map((t) => ({ id: t.id, title: t.title, meta: [t.course?.name, t.subject?.name].filter(Boolean).join(' · ') || 'Test', kind: 'tests', icon: 'test' }));
      }
      if (seg === 'lessons') {
        const r = await allPages((cursor) => adminListContent('published', { cursor, limit: 200 }).then((x) => ({ items: x.content, next: x.next_cursor })));
        return r.items.map((c) => ({ id: c.id, title: c.title, meta: [c.course?.name, c.chapter?.name].filter(Boolean).join(' · ') || 'Lesson', kind: 'content', icon: c.content_type === 'video' ? 'video' : 'document' }));
      }
      if (seg === 'hacks') {
        const r = await allPages((cursor) => adminListBrainHacks('published', cursor).then((x) => ({ items: x.brain_hacks, next: x.next_cursor })));
        return r.items.map((h) => ({ id: h.id, title: h.title, meta: h.category, kind: 'brain-hacks', icon: 'hack' }));
      }
      const r = await allPages((cursor) => adminListDecks('published', cursor).then((x) => ({ items: x.decks, next: x.next_cursor })));
      return r.items.map((d) => ({ id: d.id, title: d.title, meta: `${d.card_count} card${d.card_count === 1 ? '' : 's'}`, kind: 'flashcard-decks', icon: 'deck' }));
    },
  });
  const rows = useMemo(() => (live.data ?? []).filter((r) => !query.trim() || r.title.toLowerCase().includes(query.trim().toLowerCase())), [live.data, query]);

  const doTakedown = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    try {
      await takedown(target.kind, target.id, reason);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'live'] });
      show('Taken down. The author can fix it and resubmit.', 'success');
      setTarget(null);
    } catch (e) {
      show(e instanceof Error && e.message ? e.message : 'Couldn’t take it down. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Live content" />
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <SegmentedControl options={SEGMENTS} value={seg} onChange={(k) => { setSeg(k); setQuery(''); }} />
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <TreeToolbar query={query} onQuery={setQuery} placeholder="Search live content" />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xs, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {live.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={64} radius={radius.md} />)
        ) : live.isError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load live content"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={() => void live.refetch()} />}
          />
        ) : rows.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>{query ? 'Nothing matches.' : 'Nothing is live here yet.'}</Text>
        ) : (
          rows.map((r) => {
            const Icon = ICON[r.icon];
            return (
              <View key={r.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center' }, shadow()]}>
                <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={color('accent/default')} />
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{r.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>{r.meta}</Text>
                </View>
                <Pressable onPress={() => setTarget(r)} accessibilityRole="button" accessibilityLabel={`Take down ${r.title}`} hitSlop={8}>
                  <Text style={[type['type/body-m-medium'], { color: color('semantic/danger') }]}>Take down</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
      <ReasonSheet
        visible={!!target}
        title={`Take down “${target?.title ?? ''}”?`}
        description="Students stop seeing it right away. The author gets your reason and can fix it and resubmit."
        confirmLabel="Take down"
        busy={busy}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => void doTakedown(reason)}
      />
    </Screen>
  );
}

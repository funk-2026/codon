import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Cards, ClipboardText, FileText, Lightbulb, Plus, PlayCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SegmentedControl, SkeletonBlock, StatusBadge, TextButton, type BadgeStatus, Screen, TAB_EDGES } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ManageAllBanner } from '@/src/teacher/ManageAllBanner';
import { filterItems, STATUS_LABEL, type ItemStatus, type ItemType, type Segment, type TeacherItem } from '@/src/teacher/items';
import { useTeacherItems } from '@/src/teacher/useTeacherItems';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'tests', label: 'Tests' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'hacks', label: 'Hacks' },
  { key: 'decks', label: 'Decks' },
];

const CREATE: Record<Segment, { label: string; href: Href }> = {
  tests: { label: 'New test', href: ROUTES.teacher.createTest },
  lessons: { label: 'New lesson', href: ROUTES.teacher.createContent },
  hacks: { label: 'New Brain Hack', href: ROUTES.teacher.createBrainHack },
  decks: { label: 'New deck', href: ROUTES.teacher.flashcardDeck },
};

const EMPTY: Record<Segment, { title: string; text: string }> = {
  tests: { title: 'No tests yet', text: 'Build a Q Bank or Test Series test from your own questions or a CSV.' },
  lessons: { title: 'No lessons yet', text: 'Upload a video lecture or a document for a chapter.' },
  hacks: { title: 'No Brain Hacks yet', text: 'Share a short, practical tip students can read in a minute.' },
  decks: { title: 'No decks yet', text: 'Make a deck of quick-recall cards: a prompt on the front, the answer on the back.' },
};

const STATUS_CHIPS: { key: ItemStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: STATUS_LABEL.draft },
  { key: 'pending', label: STATUS_LABEL.pending },
  { key: 'approved', label: STATUS_LABEL.approved },
  { key: 'published', label: STATUS_LABEL.published },
  { key: 'rejected', label: STATUS_LABEL.rejected },
];

const ICON: Record<ItemType, React.ComponentType<{ size: number; color: string }>> = {
  Test: ClipboardText,
  Video: PlayCircle,
  Document: FileText,
  'Brain Hack': Lightbulb,
  Deck: Cards,
};

const BADGE: Record<ItemStatus, BadgeStatus> = { draft: 'draft', pending: 'pending', approved: 'approved', rejected: 'rejected', published: 'published' };

const isSegment = (v?: string): v is Segment => SEGMENTS.some((s) => s.key === v);
const isStatus = (v?: string): v is ItemStatus => STATUS_CHIPS.some((s) => s.key === v && v !== 'all');

/** Everything the teacher has made, one list at a time. The "+" always creates the kind you're looking at. */
export default function TeacherContentRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ segment?: string; status?: string }>();

  const [segment, setSegment] = useState<Segment>(isSegment(params.segment) ? params.segment : 'tests');
  const [status, setStatus] = useState<ItemStatus | 'all'>(isStatus(params.status) ? params.status : 'all');
  const [query, setQuery] = useState('');

  // Home links here with a segment and status already chosen.
  useEffect(() => {
    if (isSegment(params.segment)) setSegment(params.segment);
    setStatus(isStatus(params.status) ? params.status : 'all');
  }, [params.segment, params.status]);

  const itemsQuery = useTeacherItems();
  useRefetchOnFocus(() => itemsQuery.refetch());
  const items = itemsQuery.data;
  const shown = useMemo(() => (items ? filterItems(items, { segment, status, query }) : []), [items, segment, status, query]);

  const open = (item: TeacherItem) =>
    item.type === 'Deck'
      ? router.push({ pathname: ROUTES.teacher.flashcardDeck, params: { id: item.id } })
      : router.push({ pathname: ROUTES.teacher.contentPreview, params: { id: item.id, type: item.type } });

  const create = CREATE[segment];
  const hasAny = (items ?? []).some((i) => filterItems([i], { segment, status: 'all', query: '' }).length > 0);

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Content</Text>
        <Pressable
          onPress={() => router.push(create.href)}
          accessibilityRole="button"
          accessibilityLabel={create.label}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: space['2xs'], backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'), borderRadius: radius.pill, paddingHorizontal: space.sm, minHeight: 36 },
          ]}
        >
          <Plus size={18} color={color('action/on-primary')} weight="bold" />
          <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>{create.label}</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <SegmentedControl options={SEGMENTS} value={segment} onChange={(k) => { setSegment(k); setQuery(''); }} />
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <TreeToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by title"
          chips={{ options: STATUS_CHIPS, value: status, onChange: (k) => setStatus(k as ItemStatus | 'all') }}
        />
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
        <ManageAllBanner />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space['3xl'], gap: space.xs }}
        showsVerticalScrollIndicator={false}
      >
        {itemsQuery.isPending ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} height={64} radius={radius.md} />)
        ) : itemsQuery.isError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load your content"
            description="Something went wrong fetching your work."
            action={<TextButton label="Retry" onPress={() => void itemsQuery.refetch()} />}
          />
        ) : !hasAny ? (
          <EmptyState title={EMPTY[segment].title} description={EMPTY[segment].text} action={<TextButton label={create.label} onPress={() => router.push(create.href)} />} />
        ) : shown.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>Nothing matches these filters.</Text>
        ) : (
          shown.map((item) => {
            const Icon = ICON[item.type];
            return (
              <Pressable
                key={item.id}
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${STATUS_LABEL[item.status]}`}
                style={({ pressed }) => [
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={color('accent/default')} />
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
                    {item.breadcrumb}{item.rating ? ` · ★ ${item.rating.avg.toFixed(1)} (${item.rating.count})` : ''}
                  </Text>
                </View>
                <StatusBadge status={BADGE[item.status]} label={STATUS_LABEL[item.status]} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

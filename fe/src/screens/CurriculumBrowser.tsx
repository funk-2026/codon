import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  CaretRight,
  MagnifyingGlass,
  Lock,
  Atom,
  Flask,
  Leaf,
  Folder,
  PlayCircle,
  FileText,
  Exam,
  WarningCircle,
} from 'phosphor-react-native';
import { Chip, EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { getModule } from '@/src/modules/registry';
import { ROUTES } from '@/src/navigation/routes';
import { useChapterContent, useChapterTests, useCurriculum, useHasSubscription } from '@/src/queries/curriculum';
import { inputText } from '@/src/theme/inputs';

/**
 * Subject → chapter → items browser. Learn lists a chapter's videos and notes,
 * Practice lists its tests; everything else (breadcrumbs, search, locked sheet,
 * loading and error states) is shared.
 */
export type BrowserMode = 'learn' | 'practice';

type Level = 'subject' | 'chapter' | 'leaf';
type LeafKind = 'test' | 'video' | 'document';

type Row = {
  id: string;
  title: string;
  level: Level;
  count?: number;
  meta?: string;
  locked?: boolean;
  leafKind?: LeafKind;
  children?: Row[];
};

const pluralize = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const levelNoun = (level: Level) => (level === 'subject' ? 'chapter' : 'item');

function subjectIcon(title: string, ink: string) {
  const t = title.toLowerCase();
  if (t.includes('physics')) return <Atom size={22} color={ink} weight="duotone" />;
  if (t.includes('chemistry')) return <Flask size={22} color={ink} weight="duotone" />;
  if (t.includes('botany') || t.includes('zoology')) return <Leaf size={22} color={ink} weight="duotone" />;
  return <Folder size={22} color={ink} weight="duotone" />;
}

function leafIcon(kind: LeafKind | undefined, ink: string) {
  if (kind === 'video') return <PlayCircle size={22} color={ink} weight="duotone" />;
  if (kind === 'document') return <FileText size={22} color={ink} weight="duotone" />;
  return <Exam size={22} color={ink} weight="duotone" />;
}

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 260 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function CurriculumBrowser({ mode }: { mode: BrowserMode }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ path?: string; kind?: string }>();
  const selfRoute = mode === 'learn' ? ROUTES.student.learnHierarchy : ROUTES.student.practiceHierarchy;

  const pathIds = useMemo(() => (params.path ? params.path.split('/').filter(Boolean) : []), [params.path]);
  const inChapter = pathIds.length === 2;
  const chapterId = pathIds[1];

  const [query, setQuery] = useState('');
  const [topRated, setTopRated] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const curriculum = useCurriculum();
  const hasSub = useHasSubscription();
  const tests = useChapterTests(chapterId, params.kind, topRated, mode === 'practice' && inChapter);
  const content = useChapterContent(chapterId, mode === 'learn' && inChapter);
  const leafQuery = mode === 'practice' ? tests : content;
  const leafActive = inChapter;

  const loading = curriculum.isPending || (leafActive && leafQuery.isPending);
  const failed = curriculum.isError || (leafActive && leafQuery.isError);
  const retry = () => {
    if (curriculum.isError) void curriculum.refetch();
    if (leafActive && leafQuery.isError) void leafQuery.refetch();
  };

  const courseName = curriculum.data?.course.name ?? 'Course';

  const { crumbs, rows } = useMemo(() => {
    const subjects: Row[] = (curriculum.data?.course.subjects ?? []).map((s) => ({
      id: s.id,
      title: s.name,
      level: 'subject',
      count: s.chapters?.length ?? 0,
      children: (s.chapters ?? []).map((c) => ({
        id: c.id,
        title: c.name,
        level: 'chapter' as const,
        count: mode === 'learn' ? c.content_count ?? 0 : undefined,
      })),
    }));

    const leafRows: Row[] =
      mode === 'practice'
        ? (tests.data?.tests ?? []).map((t) => ({
            id: t.id,
            title: t.title,
            level: 'leaf' as const,
            leafKind: 'test' as const,
            // ratings show once there are enough to mean something (>= 5)
            meta: `${t.total_questions} questions · ${t.duration_minutes || 0} min${
              (t.rating_count ?? 0) >= 5 ? ` · ★ ${(t.rating_avg ?? 0).toFixed(1)} (${t.rating_count})` : ''
            }`,
            locked: t.requires_subscription && !hasSub,
          }))
        : (content.data?.content ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            level: 'leaf' as const,
            leafKind: c.content_type === 'video' ? ('video' as const) : ('document' as const),
            locked: c.requires_subscription && !hasSub,
          }));

    const trail: { id: string; title: string; path: string }[] = [];
    let layer: Row[] = subjects;
    let acc = '';
    for (let i = 0; i < pathIds.length; i++) {
      const found = layer.find((r) => r.id === pathIds[i]);
      if (!found) break;
      acc = acc ? `${acc}/${found.id}` : found.id;
      trail.push({ id: found.id, title: found.title, path: acc });
      layer = i === 0 ? found.children ?? [] : leafRows;
    }
    return { crumbs: trail, rows: layer };
  }, [curriculum.data, tests.data, content.data, pathIds, hasSub, mode]);

  const currentLevel: Level = crumbs.length === 0 ? 'subject' : crumbs.length === 1 ? 'chapter' : 'leaf';
  const currentTitle = crumbs.length
    ? crumbs[crumbs.length - 1].title
    : mode === 'practice'
      ? getModule(params.kind).label
      : 'Subjects';

  const filtered = rows.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  const open = (row: Row) => {
    if (row.level === 'leaf') {
      if (row.locked) return setSheetVisible(true);
      const target =
        row.leafKind === 'test'
          ? ROUTES.student.testPreStart
          : row.leafKind === 'video'
            ? ROUTES.student.videoPlayer
            : ROUTES.student.contentReader;
      router.push({ pathname: target, params: { id: row.id } });
      return;
    }
    const nextPath = pathIds.length ? `${pathIds.join('/')}/${row.id}` : row.id;
    router.push({ pathname: selfRoute, params: { path: nextPath, kind: params.kind } });
  };

  const jumpTo = (path: string) => router.dismissTo({ pathname: selfRoute, params: { path, kind: params.kind } });

  return (
    <Screen>
      <ScreenHeader title={currentTitle} />
      <View style={[styles.crumbRow, { paddingHorizontal: space.md, gap: space['2xs'], marginTop: space['2xs'] }]}>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{courseName}</Text>
        {crumbs.map((c, i) => (
          <View key={c.id} style={[styles.crumbRow, { gap: space['2xs'] }]}>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>›</Text>
            <Pressable onPress={() => jumpTo(c.path)} disabled={i === crumbs.length - 1}>
              <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{c.title}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm },
          ]}
        >
          <MagnifyingGlass size={18} color={color('text/tertiary')} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search in ${currentTitle}`}
            placeholderTextColor={color('text/tertiary')}
            style={[inputText(type['type/body-m']), { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm }]}
          />
        </View>
      </View>

      {mode === 'practice' && inChapter ? (
        <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.sm }}>
          <Chip size="sm" label="Newest" selected={!topRated} onPress={() => setTopRated(false)} />
          <Chip size="sm" label="Top rated" selected={topRated} onPress={() => setTopRated(true)} />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, marginTop: space.md }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: space.xs }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} height={64} radius={radius.md} />
            ))}
          </View>
        ) : failed ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load this section"
            description="Something went wrong loading the curriculum. Check your connection and try again."
            action={<TextButton label="Retry" onPress={retry} />}
          />
        ) : rows.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
            <Folder size={28} color={color('text/tertiary')} weight="duotone" />
            <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>Nothing published here yet</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              New {levelNoun(currentLevel)}s for this topic are on the way.
            </Text>
          </View>
        ) : query && filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space['2xl'] }}>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No matches for &lsquo;{query}&rsquo;.</Text>
          </View>
        ) : (
          <View style={{ gap: space.xs, paddingBottom: space['3xl'] }}>
            {filtered.map((row, i) => (
              <Stagger key={row.id} delayMs={i * 50}>
                <Pressable
                  onPress={() => open(row)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                    {row.level === 'leaf'
                      ? leafIcon(row.leafKind, color('accent/default'))
                      : row.level === 'subject'
                        ? subjectIcon(row.title, color('accent/default'))
                        : <Folder size={22} color={color('accent/default')} weight="duotone" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>
                      {row.title}
                    </Text>
                    {row.level !== 'leaf' && row.count != null ? (
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        {pluralize(row.count, row.level === 'subject' ? 'chapter' : 'item')}
                      </Text>
                    ) : row.meta ? (
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{row.meta}</Text>
                    ) : null}
                  </View>
                  {row.locked ? (
                    <Lock size={20} color={color('text/tertiary')} />
                  ) : (
                    <CaretRight size={20} color={color('text/tertiary')} />
                  )}
                </Pressable>
              </Stagger>
            ))}
          </View>
        )}
      </ScrollView>

      {sheetVisible ? (
        <LockedSheet
          onClose={() => setSheetVisible(false)}
          onViewPlans={() => {
            setSheetVisible(false);
            router.push(ROUTES.student.subscriptionPlans);
          }}
        />
      ) : null}
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}

function LockedSheet({ onClose, onViewPlans }: { onClose: () => void; onViewPlans: () => void }) {
  const { color, type, space, radius } = useTheme();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 240 });
  }, [rise]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.value) * 300 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <Animated.View
        style={[
          { backgroundColor: color('bg/surface'), borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.sm },
          style,
        ]}
      >
        <Text style={[type['type/h2'], { color: color('text/primary') }]}>This is part of NEET UG Pro</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          Unlock full-length test series, the complete question bank, and all video classes.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.pill,
              borderWidth: 1, borderColor: color('border/strong'), opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={onViewPlans}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.pill,
              backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'),
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>View Plans</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

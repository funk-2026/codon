import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CaretDown,
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
import { Chip, EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { ROUTES } from '@/src/navigation/routes';
import { useChapterContent, useChapterTests, useCurriculum, useHasSubscription } from '@/src/queries/curriculum';
import { inputText } from '@/src/theme/inputs';
import { LockedSheet } from './LockedSheet';

/**
 * Subject → chapter → item as one nested accordion, so a tab never leaves its screen to browse.
 * Practice kinds list a chapter's tests; Learn kinds list its videos or notes.
 * One subject is open at a time; chapters open independently and load their items on first open.
 */
export type TreeKind = 'qbank' | 'test_series' | 'video' | 'document';

const isLearn = (k: TreeKind) => k === 'video' || k === 'document';
const pluralize = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function subjectIcon(title: string, ink: string) {
  const t = title.toLowerCase();
  if (t.includes('physics')) return <Atom size={22} color={ink} weight="duotone" />;
  if (t.includes('chemistry')) return <Flask size={22} color={ink} weight="duotone" />;
  if (t.includes('botany') || t.includes('zoology')) return <Leaf size={22} color={ink} weight="duotone" />;
  return <Folder size={22} color={ink} weight="duotone" />;
}

function leafIcon(kind: TreeKind, ink: string) {
  if (kind === 'video') return <PlayCircle size={20} color={ink} weight="duotone" />;
  if (kind === 'document') return <FileText size={20} color={ink} weight="duotone" />;
  return <Exam size={20} color={ink} weight="duotone" />;
}

/** Search box (and, for tests, the sort chips) shown above the tree. Lives outside it so it stays put across segments. */
export function TreeToolbar({
  query,
  onQuery,
  sort,
}: {
  query: string;
  onQuery: (q: string) => void;
  sort?: { topRated: boolean; onChange: (topRated: boolean) => void };
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <View>
      <View style={[styles.searchRow, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm }]}>
        <MagnifyingGlass size={18} color={color('text/tertiary')} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search subjects and chapters"
          placeholderTextColor={color('text/tertiary')}
          style={[inputText(type['type/body-m']), { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm }]}
        />
      </View>
      {sort ? (
        <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm }}>
          <Chip size="sm" label="Newest" selected={!sort.topRated} onPress={() => sort.onChange(false)} />
          <Chip size="sm" label="Top rated" selected={sort.topRated} onPress={() => sort.onChange(true)} />
        </View>
      ) : null}
    </View>
  );
}

export function CurriculumTree({ kind, query, topRated = false }: { kind: TreeKind; query: string; topRated?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const curriculum = useCurriculum();
  const hasSub = useHasSubscription();

  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const q = query.trim().toLowerCase();
  const subjects = useMemo(() => {
    const all = curriculum.data?.course.subjects ?? [];
    if (!q) return all.map((s) => ({ ...s, chapters: s.chapters ?? [] }));
    return all
      .map((s) => {
        const subjectHit = s.name.toLowerCase().includes(q);
        const chapters = (s.chapters ?? []).filter((c) => subjectHit || c.name.toLowerCase().includes(q));
        return { ...s, chapters };
      })
      .filter((s) => s.chapters.length > 0 || s.name.toLowerCase().includes(q));
  }, [curriculum.data, q]);

  const openLeaf = (leafKind: TreeKind, id: string, locked: boolean) => {
    if (locked) return setSheetVisible(true);
    const pathname = isLearn(leafKind)
      ? leafKind === 'video'
        ? ROUTES.student.videoPlayer
        : ROUTES.student.contentReader
      : ROUTES.student.testPreStart;
    router.push({ pathname, params: { id } });
  };

  if (curriculum.isPending) {
    return (
      <View style={{ gap: space.xs }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} height={64} radius={radius.md} />
        ))}
      </View>
    );
  }
  if (curriculum.isError) {
    return (
      <EmptyState
        icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
        title="Couldn't load this section"
        description="Something went wrong loading the curriculum. Check your connection and try again."
        action={<TextButton label="Retry" onPress={() => void curriculum.refetch()} />}
      />
    );
  }

  return (
    <View>
      {subjects.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
          <Folder size={28} color={color('text/tertiary')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
            {q ? `No matches for ‘${query}’` : 'Nothing published here yet'}
          </Text>
          {!q ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              New chapters for this course are on the way.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space.xs }}>
          {subjects.map((s) => {
            const expanded = q ? true : openSubject === s.id;
            return (
              <View key={s.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, overflow: 'hidden' }, shadow()]}>
                <Pressable
                  onPress={() => setOpenSubject(expanded && !q ? null : s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${s.name}, ${pluralize(s.chapters.length, 'chapter')}`}
                  style={({ pressed }) => [styles.row, { padding: space.sm, opacity: pressed ? 0.94 : 1 }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                    {subjectIcon(s.name, color('accent/default'))}
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{s.name}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                      {pluralize(s.chapters.length, 'chapter')}
                    </Text>
                  </View>
                  {expanded ? <CaretDown size={20} color={color('text/tertiary')} /> : <CaretRight size={20} color={color('text/tertiary')} />}
                </Pressable>

                {expanded ? (
                  <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color('border/subtle') }}>
                    {s.chapters.length === 0 ? (
                      <Text style={[type['type/body-m'], { color: color('text/secondary'), padding: space.md }]}>No chapters yet.</Text>
                    ) : (
                      s.chapters.map((c, i) => (
                        <ChapterRow
                          key={c.id}
                          chapterId={c.id}
                          title={c.name}
                          kind={kind}
                          topRated={topRated}
                          hasSub={hasSub}
                          expanded={!!openChapters[c.id]}
                          last={i === s.chapters.length - 1}
                          onToggle={() => setOpenChapters((m) => ({ ...m, [c.id]: !m[c.id] }))}
                          onOpenLeaf={openLeaf}
                        />
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {sheetVisible ? (
        <LockedSheet
          onClose={() => setSheetVisible(false)}
          onViewPlans={() => {
            setSheetVisible(false);
            router.push(ROUTES.student.subscriptionPlans);
          }}
        />
      ) : null}
    </View>
  );
}

type TreeLeaf = { id: string; title: string; meta?: string; locked: boolean };

function ChapterRow({
  chapterId,
  title,
  kind,
  topRated,
  hasSub,
  expanded,
  last,
  onToggle,
  onOpenLeaf,
}: {
  chapterId: string;
  title: string;
  kind: TreeKind;
  topRated: boolean;
  hasSub: boolean;
  expanded: boolean;
  last: boolean;
  onToggle: () => void;
  onOpenLeaf: (kind: TreeKind, id: string, locked: boolean) => void;
}) {
  const { color, type, space, radius } = useTheme();
  const learn = isLearn(kind);
  // Items load on first open only, and React Query keeps them for the next visit.
  const tests = useChapterTests(chapterId, kind, topRated, !learn && expanded);
  const content = useChapterContent(chapterId, learn && expanded);
  const query = learn ? content : tests;

  const leaves: TreeLeaf[] = learn
    ? (content.data?.content ?? [])
        .filter((c) => (kind === 'video' ? c.content_type === 'video' : c.content_type !== 'video'))
        .map((c) => ({ id: c.id, title: c.title, locked: c.requires_subscription && !hasSub }))
    : (tests.data?.tests ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        // ratings show once there are enough to mean something (>= 5)
        meta: `${t.total_questions} questions · ${t.duration_minutes || 0} min${
          (t.rating_count ?? 0) >= 5 ? ` · ★ ${(t.rating_avg ?? 0).toFixed(1)} (${t.rating_count})` : ''
        }`,
        locked: t.requires_subscription && !hasSub,
      }));

  return (
    <View style={!last || expanded ? { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: color('border/subtle') } : undefined}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.row, { paddingVertical: space.sm, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }]}
      >
        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={2}>{title}</Text>
        {expanded ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: space['2xs'] }}>
          {query.isPending ? (
            <>
              <SkeletonBlock height={44} radius={radius.sm} />
              <SkeletonBlock height={44} radius={radius.sm} />
            </>
          ) : query.isError ? (
            <TextButton label="Couldn’t load. Retry" onPress={() => void query.refetch()} />
          ) : leaves.length === 0 ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingVertical: space.xs }]}>Nothing published here yet.</Text>
          ) : (
            leaves.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => onOpenLeaf(kind, l.id, l.locked)}
                accessibilityRole="button"
                accessibilityLabel={l.locked ? `${l.title}, locked` : l.title}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                {leafIcon(kind, color('accent/default'))}
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{l.title}</Text>
                  {l.meta ? <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{l.meta}</Text> : null}
                </View>
                {l.locked ? <Lock size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

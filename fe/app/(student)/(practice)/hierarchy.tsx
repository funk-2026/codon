import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  CaretLeft,
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
} from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getCurriculum } from '@/src/api/courses';
import { listTests } from '@/src/api/tests';
import type { Subject, Chapter } from '@/src/api/courses';
import type { Test } from '@/src/api/tests';

type Level = 'subject' | 'chapter' | 'subchapter' | 'leaf';

type Row = {
  id: string;
  title: string;
  level: Level;
  count?: number;
  meta?: string;
  locked?: boolean;
  leafKind?: 'test' | 'video' | 'document';
  children?: Row[];
};

const COURSE_NAME = 'Course';

function pluralize(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function levelNoun(level: Level): string {
  if (level === 'subject') return 'chapter';
  if (level === 'chapter') return 'sub-chapter';
  if (level === 'subchapter') return 'item';
  return 'item';
}

function subjectIcon(id: string, ink: string) {
  if (id === 'physics') return <Atom size={22} color={ink} weight="duotone" />;
  if (id === 'chemistry') return <Flask size={22} color={ink} weight="duotone" />;
  if (id === 'botany') return <Leaf size={22} color={ink} weight="duotone" />;
  if (id === 'zoology') return <Leaf size={22} color={ink} weight="duotone" />;
  return <Folder size={22} color={ink} weight="duotone" />;
}

function leafIcon(kind: Row['leafKind'], ink: string) {
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

export default function HierarchyBrowserRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ path?: string; kind?: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseName, setCourseName] = useState('Course');
  
  // Tests fetched dynamically when viewing a chapter
  const [leafTests, setLeafTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  const pathIds = useMemo(
    () => (params.path ? params.path.split('/').filter(Boolean) : []),
    [params.path],
  );

  useEffect(() => {
    async function init() {
      if (!user?.selected_course_id) return;
      try {
        const res = await getCurriculum(user.selected_course_id);
        setSubjects(res.subjects || []);
        setCourseName(res.course.name);
      } catch (err) {
        console.error('Failed to load curriculum', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user?.selected_course_id]);

  useEffect(() => {
    if (pathIds.length === 2) {
      setLoadingTests(true);
      listTests({ chapter_id: pathIds[1], module_type: params.kind })
        .then(res => setLeafTests(res.tests || []))
        .catch(console.error)
        .finally(() => setLoadingTests(false));
    } else {
      setLeafTests([]);
    }
  }, [pathIds.length, pathIds[1], params.kind]);

  const crumbs = useMemo(() => {
    const out: { id: string; title: string; path: string }[] = [];
    let currentLayerRows: Row[] = subjects.map(s => ({
      id: s.id,
      title: s.name,
      level: 'subject',
      count: s.chapters?.length || 0,
      children: (s.chapters || []).map(c => ({
        id: c.id,
        title: c.name,
        level: 'chapter',
      })),
    }));

    let acc = '';
    for (let i = 0; i < pathIds.length; i++) {
      const id = pathIds[i];
      const found = currentLayerRows.find((r) => r.id === id);
      if (!found) break;
      acc = acc ? `${acc}/${id}` : id;
      out.push({ id: found.id, title: found.title, path: acc });
      
      // If we are at the chapter level (pathIds.length === 2), the currentLayerRows will be the dynamically loaded tests
      if (i === 0) {
        currentLayerRows = found.children ?? [];
      } else if (i === 1) {
        currentLayerRows = leafTests.map(t => ({
          id: t.id,
          title: t.title,
          level: 'leaf',
          leafKind: 'test',
          meta: `${t.total_questions} questions · ${t.duration_minutes || 0} min`,
          locked: t.requires_subscription,
        }));
      }
    }
    
    // If we're at the leaf level but tests haven't loaded yet, return empty for now
    if (pathIds.length === 2 && leafTests.length === 0) {
       currentLayerRows = [];
    }

    return { crumbs: out, currentLayer: currentLayerRows };
  }, [pathIds, subjects, leafTests]);

  const currentLevel: Level = crumbs.crumbs.length === 0
    ? 'subject'
    : crumbs.crumbs.length === 1 
      ? 'chapter' 
      : 'leaf';

  const currentTitle = crumbs.crumbs.length
    ? crumbs.crumbs[crumbs.crumbs.length - 1].title
    : (params.kind === 'test_series' ? 'Test Series' : params.kind === 'qbank' ? 'Q Bank' : 'Practice');

  const [query, setQuery] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);

  const filtered = crumbs.currentLayer.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()),
  );

  const goDeeper = (row: Row) => {
    if (row.level === 'leaf') {
      if (row.locked) {
        setSheetVisible(true);
        return;
      }
      if (row.leafKind === 'test') {
        router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: row.id } });
      } else if (row.leafKind === 'video') {
        router.push({ pathname: '/(student)/(learn)/video-player', params: { id: row.id } });
      } else {
        router.push({ pathname: '/(student)/(learn)/content-reader', params: { id: row.id } });
      }
      return;
    }
    const nextPath = pathIds.length ? `${pathIds.join('/')}/${row.id}` : row.id;
    router.push({
      pathname: '/(student)/(practice)/hierarchy',
      params: { path: nextPath, kind: params.kind },
    });
  };

  const jumpTo = (path: string) => {
    router.replace({
      pathname: '/(student)/(practice)/hierarchy',
      params: { path, kind: params.kind },
    });
  };

  const goBack = () => {
    if (pathIds.length === 0) {
      router.back();
      return;
    }
    const parent = pathIds.slice(0, -1).join('/');
    router.replace({
      pathname: '/(student)/(practice)/hierarchy',
      params: { path: parent, kind: params.kind },
    });
  };

  const emptyNoun = levelNoun(currentLevel);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Header */}
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={space.xs} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <View style={[styles.crumbRow, { gap: space['2xs'] }]}>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                {courseName}
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>›</Text>
              {crumbs.crumbs.map((c, i) => (
                <View key={c.id} style={[styles.crumbRow, { gap: space['2xs'] }]}>
                  <Pressable onPress={() => jumpTo(c.path)}>
                    <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
                      {c.title}
                    </Text>
                  </Pressable>
                  {i < crumbs.crumbs.length - 1 ? (
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>›</Text>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: 2 }]}>
              {currentTitle}
            </Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: color('bg/sunken'),
              borderRadius: radius.sm,
              paddingHorizontal: space.sm,
            },
          ]}
        >
          <MagnifyingGlass size={18} color={color('text/tertiary')} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search in ${currentTitle}`}
            placeholderTextColor={color('text/tertiary')}
            style={[
              type['type/body-m'],
              { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm },
            ]}
          />
        </View>
      </View>

      {/* Rows */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, marginTop: space.md }}
        showsVerticalScrollIndicator={false}
      >
        {loading || loadingTests ? (
          <View style={{ alignItems: 'center', paddingVertical: space['2xl'] }}>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Loading...</Text>
          </View>
        ) : crumbs.currentLayer.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
            <Folder size={28} color={color('text/tertiary')} weight="duotone" />
            <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
              Nothing published here yet
            </Text>
            <Text
              style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}
            >
              New {pluralize(0, emptyNoun).split(' ')[1]} for this topic are on the way.
            </Text>
          </View>
        ) : query && filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space['2xl'] }}>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              No matches for &lsquo;{query}&rsquo;.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space.xs, paddingBottom: space['3xl'] }}>
            {filtered.map((row, i) => (
              <Stagger key={row.id} delayMs={i * 50}>
                <Pressable
                  onPress={() => goDeeper(row)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: color('bg/surface'),
                      borderRadius: radius.md,
                      padding: space.sm,
                      opacity: pressed ? 0.94 : 1,
                    },
                    shadow(),
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: color('accent/tint'), borderRadius: radius.sm },
                    ]}
                  >
                    {row.level === 'leaf'
                      ? leafIcon(row.leafKind, color('accent/default'))
                      : row.level === 'subject'
                        ? subjectIcon(row.id, color('accent/default'))
                        : <Folder size={22} color={color('accent/default')} weight="duotone" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text
                      style={[type['type/h3'], { color: color('text/primary') }]}
                      numberOfLines={1}
                    >
                      {row.title}
                    </Text>
                    {row.level !== 'leaf' && row.count != null ? (
                      <Text
                        style={[
                          type['type/caption'],
                          { color: color('text/tertiary'), marginTop: 2 },
                        ]}
                      >
                        {pluralize(row.count, levelNoun(row.level))}
                      </Text>
                    ) : row.meta ? (
                      <Text
                        style={[
                          type['type/caption'],
                          { color: color('text/tertiary'), marginTop: 2 },
                        ]}
                      >
                        {row.meta}
                      </Text>
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

      {/* Locked bottom sheet */}
      {sheetVisible ? (
        <LockedSheet
          onClose={() => setSheetVisible(false)}
          onViewPlans={() => {
            setSheetVisible(false);
            router.push('/(student)/(profile)/subscription-plans');
          }}
        />
      ) : null}
      <View style={{ height: insets.bottom }} />
    </SafeAreaView>
  );
}

function LockedSheet({
  onClose,
  onViewPlans,
}: {
  onClose: () => void;
  onViewPlans: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 240 });
  }, [rise]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * 300 }],
  }));
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <Animated.View
        style={[
          {
            backgroundColor: color('bg/surface'),
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.lg,
            gap: space.sm,
          },
          style,
        ]}
      >
        <Text style={[type['type/h2'], { color: color('text/primary') }]}>
          This is part of NEET UG Pro
        </Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          Unlock full-length test series, the complete question bank, and all video classes.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: space.sm,
              alignItems: 'center',
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: color('border/strong'),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>
              Not now
            </Text>
          </Pressable>
          <Pressable
            onPress={onViewPlans}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: space.sm,
              alignItems: 'center',
              borderRadius: radius.pill,
              backgroundColor: pressed ? color('accent/pressed') : color('accent/default'),
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('accent/on-accent') }]}>
              View Plans
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  crumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

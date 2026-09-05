import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretLeft, CaretRight, Folder } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Level = 'subject' | 'chapter';

type Node = {
  id: string;
  title: string;
  level: Level;
  children?: Node[];
};

function levelNoun(level: Level | 'root'): 'chapter' | 'subject' {
  if (level === 'root') return 'subject';
  return 'chapter';
}

function pluralize(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
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

export default function CourseStructureManagerRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ path?: string; pickerMode?: string; returnTo?: string }>();
  const pickerMode = params.pickerMode === '1';
  const returnTo: '/(teacher)/create-test' | '/(teacher)/create-content' =
    params.returnTo === '/(teacher)/create-content'
      ? '/(teacher)/create-content'
      : '/(teacher)/create-test';
  const extraParams = pickerMode ? { pickerMode: '1', returnTo: params.returnTo ?? '' } : {};

  const [tree, setTree] = useState<Node[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');

  useMemo(() => {
    import('@/src/api/courses').then(({ listCourses, getCurriculum }) => {
      listCourses().then((cRes) => {
        const course = cRes.courses[0];
        if (course) {
          setCourseId(course.id);
          setCourseName(course.name);
          getCurriculum(course.id).then((res) => {
            const fetchedTree: Node[] = res.course.subjects.map((sub: any) => ({
              id: sub.id,
              title: sub.name,
              level: 'subject',
              children: sub.chapters.map((chap: any) => ({
                id: chap.id,
                title: chap.name,
                level: 'chapter',
                children: [],
              })),
            }));
            setTree(fetchedTree);
          });
        }
      });
    });
  }, []);

  const pathIds = useMemo(() => (params.path ? params.path.split('/').filter(Boolean) : []), [params.path]);

  const { crumbs, currentLayer } = useMemo(() => {
    const out: { id: string; title: string; path: string }[] = [];
    let layer: Node[] = tree;
    let acc = '';
    for (const id of pathIds) {
      const found = layer.find((n) => n.id === id);
      if (!found) break;
      acc = acc ? `${acc}/${id}` : id;
      out.push({ id: found.id, title: found.title, path: acc });
      layer = found.children ?? [];
    }
    return { crumbs: out, currentLayer: layer };
  }, [pathIds, tree]);

  const currentLevel: Level | 'root' =
    crumbs.length === 0 ? 'root' : crumbs.length === 1 ? 'subject' : 'chapter';
  const currentTitle = crumbs.length ? crumbs[crumbs.length - 1].title : 'Subjects';

  const goDeeper = (node: Node) => {
    const nextPath = pathIds.length ? `${pathIds.join('/')}/${node.id}` : node.id;
    router.push({ pathname: '/(teacher)/(tabs)/(home)/course-structure-manager', params: { path: nextPath, ...extraParams } });
  };

  const jumpTo = (path: string) => {
    router.dismissTo({ pathname: '/(teacher)/(tabs)/(home)/course-structure-manager', params: { path, ...extraParams } });
  };

  const goBack = () => {
    router.back();
  };

  // A location is only usable once a specific chapter has been picked — that's
  // the id content/tests actually attach to. Subject/root level has no chapter id yet.
  const canUseLocation = pickerMode && currentLevel === 'chapter';

  const useThisLocation = () => {
    if (!canUseLocation) return;
    const chapterCrumb = crumbs[crumbs.length - 1];
    const label = `${courseName} · ${crumbs.map((c) => c.title).join(' · ')}`;
    router.dismissTo({ pathname: returnTo, params: { locationLabel: label, chapterId: chapterCrumb.id } });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={space.xs} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <View style={[styles.crumbRow, { gap: space['2xs'] }]}>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{courseName}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>›</Text>
              {crumbs.map((c, i) => (
                <View key={c.id} style={[styles.crumbRow, { gap: space['2xs'] }]}>
                  <Pressable onPress={() => jumpTo(c.path)}>
                    <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{c.title}</Text>
                  </Pressable>
                  {i < crumbs.length - 1 ? (
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>›</Text>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: 2 }]}>{currentTitle}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, marginTop: space.md }}
        showsVerticalScrollIndicator={false}
      >
        {currentLayer.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.xs }}>
            <Folder size={28} color={color('text/tertiary')} weight="duotone" />
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              {currentLevel === 'root'
                ? 'No subjects yet — ask an admin to set up the course structure.'
                : `No ${levelNoun(currentLevel)}s yet — ask an admin to add some.`}
            </Text>
          </View>
        ) : (
          <View style={{ gap: space.xs, paddingBottom: space['3xl'] }}>
            {currentLayer.map((node) => {
              const childCount = node.children?.length ?? 0;
              const countLabel = node.level === 'subject' ? pluralize(childCount, levelNoun(node.level)) : undefined;
              return (
                <Pressable
                  key={node.id}
                  onPress={() => goDeeper(node)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                    <Folder size={20} color={color('accent/default')} weight="duotone" />
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>
                      {node.title}
                    </Text>
                    {countLabel ? (
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        {countLabel}
                      </Text>
                    ) : null}
                  </View>
                  <CaretRight size={18} color={color('text/tertiary')} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {pickerMode ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          {canUseLocation ? (
            <PrimaryButton label={`Use ${currentTitle}`} onPress={useThisLocation} />
          ) : (
            <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>
              Pick a chapter to continue
            </Text>
          )}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  crumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretLeft, CaretRight, Folder, Plus } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Level = 'subject' | 'chapter';

type Node = {
  id: string;
  title: string;
  level: Level;
  children?: Node[];
};

const COURSE_NAME = 'NEET UG';

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
  const returnTo: '/(teacher)/(upload)/create-test' | '/(teacher)/(upload)/create-content' =
    params.returnTo === '/(teacher)/(upload)/create-content'
      ? '/(teacher)/(upload)/create-content'
      : '/(teacher)/(upload)/create-test';
  const extraParams = pickerMode ? { pickerMode: '1', returnTo: params.returnTo ?? '' } : {};

  const [tree, setTree] = useState<Node[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);

  useMemo(() => {
    import('@/src/api/courses').then(({ listCourses, getCurriculum }) => {
      listCourses().then((cRes) => {
        const neet = cRes.courses.find((c) => c.name === COURSE_NAME);
        if (neet) {
          setCourseId(neet.id);
          getCurriculum(neet.id).then((res) => {
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

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
  // Teachers can only add chapters under an existing subject — subjects are admin-owned.
  const nextLevel: Level | null = currentLevel === 'subject' ? 'chapter' : null;
  const addLabel = 'Add Chapter';
  const currentTitle = crumbs.length ? crumbs[crumbs.length - 1].title : 'Subjects';
  const canAddDeeper = nextLevel !== null;

  const goDeeper = (node: Node) => {
    const nextPath = pathIds.length ? `${pathIds.join('/')}/${node.id}` : node.id;
    router.push({ pathname: '/(teacher)/(home)/course-structure-manager', params: { path: nextPath, ...extraParams } });
  };

  const jumpTo = (path: string) => {
    router.dismissTo({ pathname: '/(teacher)/(home)/course-structure-manager', params: { path, ...extraParams } });
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
    const label = `${COURSE_NAME} · ${crumbs.map((c) => c.title).join(' · ')}`;
    router.dismissTo({ pathname: returnTo, params: { locationLabel: label, chapterId: chapterCrumb.id } });
  };

  const submitNewNode = async () => {
    if (newName.trim().length === 0 || submitting || nextLevel !== 'chapter' || !courseId) return;
    setSubmitting(true);

    try {
      const { createChapter } = await import('@/src/api/courses');
      const subjectId = pathIds[0];
      const res = await createChapter(subjectId, newName.trim(), 'Chapter for ' + newName.trim());

      const newNode: Node = { id: res.id, title: newName.trim(), level: 'chapter', children: [] };

      setTree((prev) => {
        const insert = (nodes: Node[], depth: number): Node[] => {
          if (depth === pathIds.length) return [...nodes, newNode];
          return nodes.map((n) =>
            n.id === pathIds[depth] ? { ...n, children: insert(n.children ?? [], depth + 1) } : n
          );
        };
        return insert(prev, 0);
      });
      setAddOpen(false);
      setNewName('');
    } catch (e) {
      console.error('Failed to create chapter:', e);
    } finally {
      setSubmitting(false);
    }
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
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{COURSE_NAME}</Text>
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
        {canAddDeeper ? (
          <Pressable
            onPress={() => setAddOpen(true)}
            style={[
              styles.addRow,
              { borderRadius: radius.md, borderColor: color('border/strong'), padding: space.md, marginBottom: space.sm },
            ]}
          >
            <Plus size={18} color={color('accent/default')} />
            <Text style={[type['type/body-m-medium'], { color: color('accent/default'), marginLeft: space.xs }]}>
              {addLabel}
            </Text>
          </Pressable>
        ) : null}

        {currentLayer.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.xs }}>
            <Folder size={28} color={color('text/tertiary')} weight="duotone" />
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              {currentLevel === 'root'
                ? 'No subjects yet — ask an admin to set up the course structure.'
                : `Nothing here yet — add the first ${levelNoun(currentLevel)}.`}
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

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>New chapter</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Thermodynamics"
              placeholderTextColor={color('text/tertiary')}
              autoFocus
              style={[
                type['type/body-l'],
                {
                  color: color('text/primary'),
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: color('border/subtle'),
                  paddingHorizontal: space.sm,
                  paddingVertical: space.sm,
                  marginTop: space.md,
                },
              ]}
            />
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton
                label="Add Chapter"
                onPress={submitNewNode}
                disabled={newName.trim().length === 0}
                loading={submitting}
              />
              <SecondaryButton label="Cancel" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  crumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});

import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlass, Plus, Trash } from 'phosphor-react-native';
import { BottomSheet, ConfirmDialog, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SelectField, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useCourses } from '@/src/queries/curriculum';
import { getCurriculum } from '@/src/api/courses';
import { ROUTES } from '@/src/navigation/routes';
import { useAuth } from '@/src/auth/AuthContext';
import { createManagedTopic, deleteManagedTopic, getSchemaTopic, listManagedTopics, renameManagedTopic, saveTopicYears, type ManagedTopic } from '@/src/api/study';

type Row = { year: string; subtopic: string; questions: string };

/** Teachers and admins: see every Schema topic, add one, rename it, edit its Year | Subtopic | Qs rows, or delete it. */
export function SchemaManage() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const qc = useQueryClient();
  const courses = useCourses();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ManagedTopic | null>(null);
  const [adding, setAdding] = useState(false);

  const list = useQuery({ queryKey: ['managed-topics', courseId], queryFn: () => listManagedTopics(courseId), enabled: !!courseId });
  const topics = (list.data ?? []).filter((t) => !q.trim() || `${t.name} ${t.chapter} ${t.subject}`.toLowerCase().includes(q.trim().toLowerCase()));
  const importRoute = (user?.role === 'admin' ? ROUTES.admin.schemaImport : ROUTES.teacher.schemaImport) as Href;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['managed-topics'] });
    void qc.invalidateQueries({ queryKey: ['schema'] });
    void qc.invalidateQueries({ queryKey: ['schema-topic'] });
  };

  const groups: { key: string; title: string; rows: ManagedTopic[] }[] = [];
  for (const t of topics) {
    const key = `${t.subject_id}|${t.chapter_id}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.rows.push(t);
    else groups.push({ key, title: `${t.subject} › ${t.chapter}`, rows: [t] });
  }

  return (
    <Screen>
      <ScreenHeader title="Schema topics" right={<TextButton label="Import CSV" onPress={() => router.push(importRoute)} />} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <SelectField label="Course" value={courseId} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={setCourseId} />
        {courseId ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color('border/subtle'), backgroundColor: color('bg/surface'), paddingHorizontal: space.sm }}>
                <MagnifyingGlass size={18} color={color('text/tertiary')} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search topics" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { flex: 1, color: color('text/primary'), minHeight: 44 }]} />
              </View>
              <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add a topic" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color('action/primary'), alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={22} color={color('action/on-primary')} weight="bold" />
              </Pressable>
            </View>
            {list.isPending ? (
              <SkeletonBlock height={120} radius={radius.lg} />
            ) : groups.length === 0 ? (
              <EmptyState title="No topics yet" description="Add one with the plus button, or import a CSV." />
            ) : (
              groups.map((g) => (
                <View key={g.key} style={{ gap: 4 }}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.xs }]}>{g.title.toUpperCase()}</Text>
                  {g.rows.map((t) => (
                    <Pressable key={t.id} onPress={() => setEditing(t)} accessibilityRole="button" style={{ minHeight: 52, backgroundColor: color('bg/surface'), borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{t.name}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{t.total} questions in {t.rows} rows</Text>
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </>
        ) : (
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Choose a course to see its topics.</Text>
        )}
      </ScrollView>
      {editing ? <TopicEditor key={editing.id} topic={editing} onClose={() => setEditing(null)} onChanged={refresh} show={show} /> : null}
      {adding && courseId ? <AddTopic courseId={courseId} onClose={() => setAdding(false)} onChanged={refresh} show={show} /> : null}
    </Screen>
  );
}

type Show = (m: string, t?: 'success' | 'error') => void;

function TopicEditor({ topic, onClose, onChanged, show }: { topic: ManagedTopic; onClose: () => void; onChanged: () => void; show: Show }) {
  const { color, type, space, radius } = useTheme();
  const [name, setName] = useState(topic.name);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({ queryKey: ['schema-topic-edit', topic.id], queryFn: () => getSchemaTopic(topic.id) });
  const shown: Row[] = rows ?? (detail.data?.rows ?? []).map((r) => ({ year: r.year, subtopic: r.subtopic, questions: String(r.questions) }));

  const saveName = useMutation({ mutationFn: () => renameManagedTopic(topic.id, name.trim()), onSuccess: () => { onChanged(); show('Name saved', 'success'); }, onError: () => show('Couldn’t save the name.', 'error') });
  const saveRows = useMutation({
    mutationFn: () => saveTopicYears(topic.id, shown.map((r) => ({ year: r.year.trim(), subtopic: r.subtopic.trim(), questions: Number(r.questions) || 0 }))),
    onSuccess: () => { onChanged(); show('Rows saved', 'success'); },
    onError: () => show('Check the years (2022 or 2022 Re) and counts.', 'error'),
  });
  const del = useMutation({ mutationFn: () => deleteManagedTopic(topic.id), onSuccess: () => { onChanged(); onClose(); show('Topic deleted', 'success'); }, onError: () => show('Couldn’t delete it.', 'error') });
  const set = (i: number, patch: Partial<Row>) => setRows(shown.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <BottomSheet visible onClose={onClose} title="Edit topic" maxHeightPct={0.92}>
      <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm, paddingBottom: space.lg }}>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{topic.subject} › {topic.chapter}</Text>
          <InputField label="Topic name" value={name} onChangeText={setName} />
          <SecondaryButton label="Save name" onPress={() => saveName.mutate()} disabled={!name.trim() || name.trim() === topic.name || saveName.isPending} />
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.sm }]}>YEAR | SUBTOPIC | QS</Text>
          {detail.isPending ? <SkeletonBlock height={60} radius={radius.md} /> : null}
          {shown.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TextInput value={r.year} onChangeText={(v) => set(i, { year: v })} placeholder="2022 Re" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { width: 84, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary') }]} />
              <TextInput value={r.subtopic} onChangeText={(v) => set(i, { subtopic: v })} placeholder="Subtopic (blank = topic)" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { flex: 1, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary') }]} />
              <TextInput value={r.questions} onChangeText={(v) => set(i, { questions: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="0" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { width: 52, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary'), textAlign: 'right' }]} />
              <Pressable onPress={() => setRows(shown.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel="Remove row" style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Trash size={18} color={color('semantic/danger')} />
              </Pressable>
            </View>
          ))}
          <TextButton label="+ Add a row" onPress={() => setRows([...shown, { year: '', subtopic: '', questions: '' }])} />
          <PrimaryButton label="Save rows" onPress={() => saveRows.mutate()} loading={saveRows.isPending} disabled={rows === null} />
          <TextButton label="Delete this topic" onPress={() => setConfirm(true)} />
        </View>
      </ScrollView>
      <ConfirmDialog visible={confirm} title="Delete this topic?" message="Its year rows and every student's status on it are removed. This can't be undone." confirmLabel="Delete" tone="danger" loading={del.isPending} onConfirm={() => del.mutate()} onCancel={() => setConfirm(false)} />
    </BottomSheet>
  );
}

function AddTopic({ courseId, onClose, onChanged, show }: { courseId: string; onClose: () => void; onChanged: () => void; show: Show }) {
  const { space } = useTheme();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const tree = useQuery({ queryKey: ['curriculum-tree', courseId], queryFn: () => getCurriculum(courseId), select: (r) => r.course.subjects ?? [] });
  const subjects = tree.data ?? [];
  const chapters = subjects.find((s) => s.id === subjectId)?.chapters ?? [];
  const add = useMutation({
    mutationFn: () => createManagedTopic({ course_id: courseId, subject_id: subjectId!, chapter_id: chapterId!, name: name.trim() }),
    onSuccess: () => { onChanged(); show('Topic added. Open it to add its rows.', 'success'); onClose(); },
    onError: () => show('Couldn’t add the topic.', 'error'),
  });
  return (
    <BottomSheet visible onClose={onClose} title="Add a topic">
      <View style={{ gap: space.sm, paddingBottom: space.lg }}>
        <SelectField label="Subject" value={subjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => { setSubjectId(v); setChapterId(undefined); }} />
        <SelectField label="Chapter" value={chapterId} options={chapters.map((c) => ({ value: c.id, label: c.name }))} onChange={setChapterId} disabled={!subjectId} />
        <InputField label="Topic name" value={name} onChangeText={setName} />
        <PrimaryButton label="Add topic" onPress={() => add.mutate()} loading={add.isPending} disabled={!subjectId || !chapterId || !name.trim()} />
      </View>
    </BottomSheet>
  );
}

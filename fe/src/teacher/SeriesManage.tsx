import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SelectField, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useCourses } from '@/src/queries/curriculum';
import { createSeries, deleteSeries, listSeries, renameSeries, type SeriesRow } from '@/src/api/exams';

/** Test series ("NEET 2027 Mock Series"): create, rename, delete. Deleting keeps the tests; they just leave the series. */
export function SeriesManage() {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();
  const courses = useCourses();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<SeriesRow | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<SeriesRow | null>(null);
  const list = useQuery({ queryKey: ['teacher', 'series', courseId], queryFn: () => listSeries(courseId).then((r) => r.series), enabled: !!courseId });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['teacher', 'series'] });

  const add = useMutation({ mutationFn: () => createSeries({ course_id: courseId!, title: title.trim() }), onSuccess: () => { setTitle(''); refresh(); show('Series created', 'success'); }, onError: () => show('Couldn’t create it. Use 3 to 120 characters.', 'error') });
  const rename = useMutation({ mutationFn: () => renameSeries(editing!.id, name.trim()), onSuccess: () => { setEditing(null); refresh(); show('Renamed', 'success'); }, onError: () => show('Couldn’t rename it.', 'error') });
  const del = useMutation({ mutationFn: (id: string) => deleteSeries(id), onSuccess: () => { setConfirm(null); refresh(); show('Series deleted. Its tests are kept.', 'success'); }, onError: () => show('Couldn’t delete it.', 'error') });

  return (
    <Screen>
      <ScreenHeader title="Test series" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <SelectField label="Course" value={courseId} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={setCourseId} />
        {courseId ? (
          <>
            <View style={{ gap: space.xs }}>
              <InputField label="New series" value={title} onChangeText={setTitle} placeholder="NEET 2027 Mock Series" maxLength={120} />
              <PrimaryButton label="Create series" onPress={() => add.mutate()} loading={add.isPending} disabled={title.trim().length < 3} />
            </View>
            {list.isPending ? <SkeletonBlock height={80} radius={radius.md} /> : (list.data ?? []).length === 0 ? (
              <EmptyState title="No series yet" description="A series groups mock tests so students see their progress through it." />
            ) : (
              (list.data ?? []).map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }}>
                  {editing?.id === s.id ? (
                    <View style={{ flex: 1, gap: space.xs }}>
                      <InputField label="Title" value={name} onChangeText={setName} />
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <TextButton label="Save" onPress={() => rename.mutate()} disabled={name.trim().length < 3 || rename.isPending} />
                        <TextButton label="Cancel" onPress={() => setEditing(null)} />
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{s.title}</Text>
                      <TextButton label="Rename" onPress={() => { setEditing(s); setName(s.title); }} />
                      <TextButton label="Delete" onPress={() => setConfirm(s)} />
                    </>
                  )}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
      <ConfirmDialog visible={!!confirm} title="Delete this series?" message={`“${confirm?.title ?? ''}” is removed. Its tests stay, without a series.`} confirmLabel="Delete" tone="danger" loading={del.isPending} onConfirm={() => confirm && del.mutate(confirm.id)} onCancel={() => setConfirm(null)} />
    </Screen>
  );
}

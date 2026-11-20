import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InputField, PrimaryButton, Screen, ScreenHeader, SelectField, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useCourses } from '@/src/queries/curriculum';
import { getCurriculum } from '@/src/api/courses';
import { createPulse, deletePulse, listTeacherPulse } from '@/src/api/study';

/** Teachers and admins add one-minute Pulse items under a chapter. They show to students straight away. */
export function PulseAuthor() {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();
  const courses = useCourses();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const tree = useQuery({ queryKey: ['curriculum-tree', courseId], queryFn: () => getCurriculum(courseId as string), enabled: !!courseId, select: (r) => r.course.subjects ?? [] });
  const mine = useQuery({ queryKey: ['teacher-pulse', courseId], queryFn: () => listTeacherPulse(courseId), enabled: !!courseId });
  const subjects = tree.data ?? [];
  const chapters = subjects.find((s) => s.id === subjectId)?.chapters ?? [];

  const add = useMutation({
    mutationFn: () => createPulse({ course_id: courseId!, subject_id: subjectId!, chapter_id: chapterId!, title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      void qc.invalidateQueries({ queryKey: ['teacher-pulse'] });
      void qc.invalidateQueries({ queryKey: ['pulse'] });
      show('Pulse item added', 'success');
    },
    onError: () => show('Couldn’t save. Your text is still here.', 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => deletePulse(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-pulse'] });
      void qc.invalidateQueries({ queryKey: ['pulse'] });
    },
    onError: () => show('Couldn’t delete it.', 'error'),
  });
  const ready = !!courseId && !!subjectId && !!chapterId && title.trim().length >= 3 && body.trim().length >= 10;

  return (
    <Screen>
      <ScreenHeader title="Pulse items" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>A Pulse item is a one-minute read for a chapter: one idea, in plain words. Students see it as soon as you add it.</Text>
        <SelectField label="Course" value={courseId} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => { setCourseId(v); setSubjectId(undefined); setChapterId(undefined); }} />
        <SelectField label="Subject" value={subjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => { setSubjectId(v); setChapterId(undefined); }} disabled={subjects.length === 0} />
        <SelectField label="Chapter" value={chapterId} options={chapters.map((c) => ({ value: c.id, label: c.name }))} onChange={setChapterId} disabled={!subjectId} disabledHint={!subjectId ? 'Pick a subject first' : undefined} />
        <InputField label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <InputField label="The one-minute read" value={body} onChangeText={setBody} multiline maxLength={1500} helperText="About 150 words reads in a minute." />
        <PrimaryButton label="Add item" onPress={() => add.mutate()} loading={add.isPending} disabled={!ready} />

        {courseId ? (
          <View style={{ gap: space.xs }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>ALREADY ADDED ({mine.data?.length ?? 0})</Text>
            {(mine.data ?? []).map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{p.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{p.subject_name} › {p.chapter_name}</Text>
                </View>
                <TextButton label="Delete" onPress={() => del.mutate(p.id)} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

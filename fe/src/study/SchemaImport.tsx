import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { InputField, PrimaryButton, Screen, ScreenHeader, SelectField, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useCourses } from '@/src/queries/curriculum';
import { ApiError } from '@/src/api/client';
import { importSchema } from '@/src/api/study';
import { parseSchemaCsv } from '@/src/study/logic';

/** Load the Schema table by pasting CSV: subject, chapter, topic, year, subtopic, questions. Uploading again replaces a topic's year rows. */
export function SchemaImport() {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const courses = useCourses();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseSchemaCsv(text), [text]);
  const [problems, setProblems] = useState<string[]>([]);

  const run = useMutation({
    mutationFn: () => importSchema(courseId!, parsed.rows),
    onSuccess: (r) => {
      setProblems([]);
      show(`Saved ${r.rows} rows for ${r.topics} topics (${r.new_topics} new)`, 'success');
    },
    onError: (e) => {
      const d = e instanceof ApiError ? (e.details as unknown) : null;
      setProblems(Array.isArray(d) ? (d as string[]) : []);
      show(e instanceof ApiError && e.code === 'invalid_rows' ? 'Some rows need fixing.' : 'The import failed. Nothing was saved.', 'error');
    },
  });

  return (
    <Screen>
      <ScreenHeader title="Schema import" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          One line per topic, year and subtopic: subject, chapter, topic, year, subtopic, questions. Leave the subtopic empty for a topic-level count. Write a re-exam year as 2022 Re. Subjects must already exist; missing chapters are created.
        </Text>
        <SelectField label="Course" value={courseId} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={setCourseId} />
        <InputField label="CSV" value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} placeholder={'Biology,Molecular Basis of Inheritance,DNA replication,2022,,3'} />
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{parsed.rows.length} rows read{parsed.errors.length ? `, ${parsed.errors.length} lines to fix` : ''}</Text>
        {[...parsed.errors, ...problems].slice(0, 20).map((p) => (
          <Text key={p} style={[type['type/caption'], { color: color('semantic/danger') }]}>{p}</Text>
        ))}
        <View>
          <PrimaryButton label="Import" onPress={() => run.mutate()} loading={run.isPending} disabled={!courseId || parsed.rows.length === 0 || parsed.errors.length > 0} />
        </View>
      </ScrollView>
    </Screen>
  );
}

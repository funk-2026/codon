import { useState } from 'react';
import { ScrollView, Switch, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretRight, WarningCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { Test } from '@/src/api/tests';
import type { ContentItem } from '@/src/api/content';
import { getTeacherContent, getTeacherTest, updateContent, updateTest } from '@/src/api/teacher';
import { ChapterPickerSheet, type PickedPlace } from '@/src/teacher/ChapterPickerSheet';
import { ApiError } from '@/src/api/client';
import { useSafeBack } from '@/src/navigation/useSafeBack';

const TEXT_LESSON_KEY = 'text:inline';

function Row({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
        {hint ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

/** Edit the details of a test or lesson that is still a draft or needs changes. One screen for both. */
export default function EditDetailsRoute() {
  const { id, type: rawType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const isTest = rawType === 'Test';
  const { color, space, radius } = useTheme();
  const q = useQuery({
    queryKey: ['teacher', 'edit-details', rawType, id],
    queryFn: async () => (isTest ? { test: (await getTeacherTest(String(id))).test } : { content: (await getTeacherContent(String(id))).content }),
    enabled: !!id,
  });
  const test = (q.data && 'test' in q.data ? q.data.test : null) ?? null;
  const lesson = (q.data && 'content' in q.data ? q.data.content : null) ?? null;
  if (test || lesson) return <EditForm id={String(id)} test={test} lesson={lesson} />;
  return (
    <Screen>
      <ScreenHeader title="Edit details" />
      {q.isError ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load this"
          description="Check your connection and try again."
          action={<TextButton label="Retry" onPress={() => void q.refetch()} />}
        />
      ) : (
        <View style={{ padding: space.md, gap: space.sm }}>
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={120} radius={radius.md} />
        </View>
      )}
    </Screen>
  );
}

function EditForm({ id, test, lesson }: { id: string; test: Test | null; lesson: ContentItem | null }) {
  const isTest = !!test;
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack();
  const { show } = useToast();
  const qc = useQueryClient();

  const [title, setTitle] = useState(test?.title ?? lesson?.title ?? '');
  const [description, setDescription] = useState(test?.description ?? '');
  const [instructions, setInstructions] = useState(test?.instructions ?? '');
  const [body, setBody] = useState(lesson?.body_text ?? '');
  const [timed, setTimed] = useState(!!test?.duration_minutes);
  const [duration, setDuration] = useState(String(test?.duration_minutes || 30));
  const [marksCorrect, setMarksCorrect] = useState(String(test?.marks_per_correct ?? 4));
  const [marksWrong, setMarksWrong] = useState(String(test?.marks_per_wrong ?? -1));
  const [paid, setPaid] = useState(test?.requires_subscription ?? lesson?.requires_subscription ?? true);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const editableStatus = ['draft', 'rejected'].includes(test?.status ?? lesson?.status ?? '');
  const textLesson = lesson?.file_key === TEXT_LESSON_KEY;
  const courseId = test?.course_id ?? lesson?.course_id ?? null;
  const durationNum = Number(duration);
  const mc = Number(marksCorrect);
  const mw = Number(marksWrong);
  const problem =
    title.trim().length === 0 ? 'Add a title.'
    : isTest && timed && (!Number.isFinite(durationNum) || durationNum < 1 || durationNum > 600) ? 'Duration must be 1–600 minutes.'
    : isTest && (!Number.isFinite(mc) || !Number.isFinite(mw) || marksCorrect.trim() === '' || marksWrong.trim() === '') ? 'Marks must be numbers.'
    : textLesson && editableStatus && body.trim().length === 0 ? 'The lesson text can’t be empty.'
    : null;

  const save = async () => {
    if (problem) return;
    setSaving(true);
    try {
      if (isTest) {
        await updateTest(id, {
          title: title.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          duration_minutes: timed ? durationNum : 0,
          marks_per_correct: mc,
          marks_per_wrong: mw,
          requires_subscription: paid,
          ...(place ? { subject_id: place.subjectId, chapter_id: place.chapterId } : {}),
        });
      } else {
        await updateContent(id, {
          title: title.trim(),
          requires_subscription: paid,
          ...(place ? { chapter_id: place.chapterId } : {}),
          ...(textLesson && editableStatus ? { body_text: body.trim() } : {}),
        });
      }
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show('Saved', 'success');
      goBack();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Couldn’t save', 'error');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Edit details" />
      {!editableStatus ? (
        <EmptyState
          title="Locked while it is in review or live"
          description="Details can be edited while it is a draft or needs changes. A live question can be changed through a correction from its own screen."
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled">
            <InputField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
            {isTest ? (
              <>
                <InputField label="Description (optional)" value={description} onChangeText={setDescription} multiline />
                <InputField
                  label="Instructions for students (optional)"
                  helperText="Shown before they start: rules, syllabus, how marking works."
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  maxLength={4000}
                />
                <Row label="Timed" value={timed} onChange={setTimed} />
                {timed ? <InputField label="Duration (minutes)" value={duration} onChangeText={setDuration} keyboardType="number-pad" /> : null}
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}><InputField label="Marks per correct" value={marksCorrect} onChangeText={setMarksCorrect} keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><InputField label="Marks per wrong" value={marksWrong} onChangeText={setMarksWrong} keyboardType="numbers-and-punctuation" /></View>
                </View>
              </>
            ) : null}
            {textLesson ? (
              <InputField label="Lesson text" value={body} onChangeText={setBody} multiline maxLength={60000} containerStyle={{ minHeight: 160 }} />
            ) : null}
            <Row label="Paid content" hint={paid ? 'Only subscribers can open it' : 'Free for every student'} value={paid} onChange={setPaid} />
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Location</Text>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                  {place?.label ?? 'Keep where it is (tap to move)'}
                </Text>
              </View>
              <CaretRight size={16} color={color('text/tertiary')} />
            </Pressable>
            {problem ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{problem}</Text> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: space.md, paddingBottom: space.lg }}>
            <PrimaryButton label="Save changes" onPress={save} loading={saving} disabled={!!problem} />
          </View>
          <ChapterPickerSheet
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            courseId={courseId}
            selectedChapterId={place?.chapterId ?? test?.chapter_id ?? lesson?.chapter_id ?? null}
            onPick={(p) => { setPlace(p); setPickerOpen(false); }}
          />
        </>
      )}
    </Screen>
  );
}

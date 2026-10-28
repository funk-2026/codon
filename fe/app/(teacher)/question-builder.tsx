import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, ImageSquare, PencilSimple, Plus, Trash, UploadSimple, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, StatusBadge, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { deleteQuestion, getTeacherTest, submitTestForReview, type TeacherTestDetail } from '@/src/api/teacher';
import type { AuthoredQuestion } from '@/src/api/tests';
import { mediaRefs, plainText } from '@/src/rich';

type Missing = { question_id: string; fields: string[] };

const FIELD_LABEL: Record<string, string> = { chapter: 'chapter', difficulty: 'difficulty', image_not_ready: 'an image that isn’t ready' };

/**
 * The questions of one test (FE-2.1/2.13): review, add, edit, delete, then submit
 * for review. Editing happens in the dedicated question editor; this screen is
 * the overview, so a 50-question test never becomes one giant form.
 */
export default function QuestionBuilderRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { testId, testTitle } = useLocalSearchParams<{ testId?: string; testTitle?: string; prefillText?: string }>();

  const [data, setData] = useState<TeacherTestDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toDelete, setToDelete] = useState<AuthoredQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!testId) return;
    try {
      setData(await getTeacherTest(testId));
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [testId]);

  // refresh whenever we come back from the editor
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const test = data?.test;
  const editable = test ? test.status === 'draft' || test.status === 'rejected' : true;
  const questions = useMemo(() => [...(data?.questions ?? [])].sort((a, b) => (a.position ?? a.order_index) - (b.position ?? b.order_index)), [data]);
  const missingById = useMemo(() => new Map(missing.map((m) => [m.question_id, m.fields])), [missing]);
  const unclassified = questions.filter((q) => !q.chapter_id || !q.difficulty).length;

  const edit = (q?: AuthoredQuestion) =>
    router.push({ pathname: '/(teacher)/question-editor', params: { testId: testId!, ...(q ? { questionId: q.id } : {}) } });

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteQuestion(toDelete.id);
      setData((d) => (d ? { ...d, questions: d.questions.filter((q) => q.id !== toDelete.id) } : d));
      setToDelete(null);
    } catch (e) {
      show(e instanceof ApiError && e.code === 'test_locked' ? 'This test is locked — questions can’t be deleted.' : 'Couldn’t delete. Try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    if (!testId) return;
    setSubmitting(true);
    setSubmitError(null);
    setMissing([]);
    try {
      await submitTestForReview(testId);
      show('Submitted for review', 'success');
      router.replace('/(teacher)/(tabs)/(content)');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'incomplete_questions') {
        const m = ((e.details as any)?.missing ?? []) as Missing[];
        setMissing(m);
        setSubmitError(m.length === 0 ? 'Add at least one question before submitting.' : `${m.length} question${m.length > 1 ? 's need' : ' needs'} more details before this can be submitted.`);
      } else setSubmitError('Couldn’t submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type['type/h2'], { color: color('text/primary') }]} numberOfLines={1}>{test?.title ?? testTitle ?? 'Questions'}</Text>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{questions.length} question{questions.length === 1 ? '' : 's'}</Text>
        </View>
        {test ? <StatusBadge status={(test.status as any) ?? 'draft'} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 160 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {status === 'loading' ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={84} radius={radius.md} />)
        ) : status === 'error' ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the questions"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : (
          <>
            {test?.status === 'rejected' && test.rejection_reason ? (
              <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.md, padding: space.md }}>
                <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>REVIEWER’S NOTE</Text>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{test.rejection_reason}</Text>
              </View>
            ) : null}
            {!editable ? (
              <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md }}>
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>This test is {test?.status?.replace('_', ' ')}. You can send corrections for individual questions; adding or removing questions is locked.</Text>
              </View>
            ) : null}
            {editable && unclassified > 0 && test?.module_type !== 'test_series' ? (
              <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md }}>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
                  {unclassified} question{unclassified > 1 ? 's' : ''} still need a chapter and difficulty — required before submitting.
                </Text>
              </View>
            ) : null}

            {questions.length === 0 ? (
              <EmptyState
                icon={<PencilSimple size={32} color={color('text/tertiary')} />}
                title="No questions yet"
                description="Add questions one by one — with images if you need — or import many at once from a CSV."
              />
            ) : (
              questions.map((q, i) => {
                const need = missingById.get(q.id);
                const imgs = new Set([q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.explanation ?? ''].flatMap((t) => mediaRefs(t, q.content_format))).size;
                const summary = plainText(q.question_text, q.content_format) || (imgs > 0 ? '(image question)' : '(empty)');
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => edit(q)}
                    accessibilityRole="button"
                    accessibilityLabel={`Question ${i + 1}: ${summary}`}
                    style={({ pressed }) => ({
                      backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs, opacity: pressed ? 0.94 : 1,
                      borderWidth: need ? 1.5 : 0, borderColor: need ? color('semantic/danger') : 'transparent',
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>Q{i + 1}</Text>
                      {imgs > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <ImageSquare size={14} color={color('text/tertiary')} />
                          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{imgs}</Text>
                        </View>
                      ) : null}
                      {q.difficulty ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{q.difficulty}</Text> : null}
                      <View style={{ flex: 1 }} />
                      <Text style={[type['type/caption'], { color: color('semantic/success') }]}>Answer {q.correct_option}</Text>
                    </View>
                    <Text style={[type['type/body-m'], { color: color('text/primary') }]} numberOfLines={3}>{summary}</Text>
                    {need ? (
                      <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Needs: {need.map((f) => FIELD_LABEL[f] ?? f).join(', ')}</Text>
                    ) : !q.chapter_id || !q.difficulty ? (
                      <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Add {[!q.chapter_id && 'chapter', !q.difficulty && 'difficulty'].filter(Boolean).join(' & ')}</Text>
                    ) : null}
                    {editable ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Pressable onPress={() => setToDelete(q)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete question ${i + 1}`} style={{ minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                          <Trash size={18} color={color('text/tertiary')} />
                        </Pressable>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {status === 'ready' && editable ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm }}>
          {submitError ? <ErrorBanner message={submitError} /> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><SecondaryButton label="Add question" onPress={() => edit()} /></View>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Import CSV" onPress={() => router.push({ pathname: '/(teacher)/csv-upload', params: { testId: testId!, testTitle: test?.title ?? '' } })} />
            </View>
          </View>
          <PrimaryButton label="Submit for review" onPress={submit} loading={submitting} disabled={questions.length === 0} />
        </View>
      ) : null}

      <BottomSheet visible={!!toDelete} onClose={() => setToDelete(null)} title="Delete this question?" dismissable={!deleting}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>This removes it from the test. This can’t be undone.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton label="Cancel" onPress={() => setToDelete(null)} />
          <PrimaryButton label="Delete" onPress={doDelete} loading={deleting} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

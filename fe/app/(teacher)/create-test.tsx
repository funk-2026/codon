import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretRight, Stack, Exam, Lightning, WarningCircle, Minus, Plus } from 'phosphor-react-native';
import { Switch } from 'react-native';
import { teacherModules } from '@/src/modules/registry';
import { ErrorBanner, InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { createTest } from '@/src/api/teacher';
import { listCourses } from '@/src/api/courses';

type ModuleKey = 'qbank' | 'test_series' | 'practice';

const MODULE_ICON: Record<string, (ink: string) => React.ReactNode> = {
  qbank: (c) => <Stack size={18} color={c} weight="duotone" />,
  test_series: (c) => <Exam size={18} color={c} weight="duotone" />,
  practice: (c) => <Lightning size={18} color={c} weight="duotone" />,
};

export default function CreateTestRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { locationLabel, chapterId: pickedChapterId, courseId: pickedCourseId, subjectId: pickedSubjectId } = useLocalSearchParams<{
    locationLabel?: string;
    chapterId?: string;
    courseId?: string;
    subjectId?: string;
  }>();

  const [title, setTitle] = useState('');
  const [moduleType, setModuleType] = useState<ModuleKey | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [requiresSub, setRequiresSub] = useState(true);
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(30);
  const [marksCorrect, setMarksCorrect] = useState('4');
  const [marksWrong, setMarksWrong] = useState('-1');
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const questionCount = 0; // a brand-new test has no questions until they are added

  const loadCourseInfo = useCallback(() => {
    listCourses().then(res => {
      if (res.courses.length > 0) setCourseId((cur) => cur ?? res.courses[0].id);
      setLoadError(false);
    }).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    loadCourseInfo();
  }, [loadCourseInfo]);

  useEffect(() => {
    if (locationLabel) setLocation(locationLabel);
    if (pickedChapterId) setChapterId(pickedChapterId);
    if (pickedCourseId) setCourseId(pickedCourseId);
    if (pickedSubjectId) setSubjectId(pickedSubjectId);
  }, [locationLabel, pickedChapterId, pickedCourseId, pickedSubjectId]);

  const locationSet = !!location;
  const canProceed = locationSet;

  const ensureTestSaved = useCallback(async (): Promise<string | null> => {
    if (testId) return testId;
    if (!title.trim() || !moduleType || !courseId) return null;
    const correct = Number(marksCorrect.replace(',', '.'));
    const wrong = Number(marksWrong.replace(',', '.'));
    if (!Number.isFinite(correct) || correct <= 0 || !Number.isFinite(wrong)) throw new Error('marks');
    const res = await createTest({
      title: title.trim(),
      course_id: courseId,
      module_type: moduleType,
      ...(chapterId ? { chapter_id: chapterId } : {}),
      ...(subjectId ? { subject_id: subjectId } : {}),
      // previously these were collected on this screen but never sent, so every test was created untimed with default marks
      ...(timed ? { duration_minutes: duration } : {}),
      marks_per_correct: correct,
      // a penalty is stored as a negative number; accept "1" or "-1" from the teacher
      marks_per_wrong: wrong > 0 ? -wrong : wrong,
      requires_subscription: requiresSub,
    });
    setTestId(res.id);
    return res.id;
  }, [testId, title, moduleType, courseId, chapterId, subjectId, timed, duration, marksCorrect, marksWrong, requiresSub]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const id = await ensureTestSaved();
      if (!id) return;
      show('Draft saved', 'success');
      // For MVP, proceed to question builder
      router.push({ pathname: '/(teacher)/question-builder', params: { testId: id } });
    } catch (err) {
      show(err instanceof Error && err.message === 'marks' ? 'Enter valid marks: a positive number for correct answers.' : 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    setSaving(true);
    try {
      const id = await ensureTestSaved();
      if (!id) {
        show('Fill in the title and module type first', 'error');
        return;
      }
      router.push({ pathname: '/(teacher)/csv-upload', params: { testId: id } });
    } catch (err) {
      show(err instanceof Error && err.message === 'marks' ? 'Enter valid marks: a positive number for correct answers.' : 'Failed to save test', 'error');
    } finally {
      setSaving(false);
    }
  };

  const goToLocationPicker = () => {
    router.push({
      pathname: '/(teacher)/(tabs)/(home)/course-structure-manager',
      params: { pickerMode: '1', returnTo: '/(teacher)/create-test' },
    });
  };

  const MODULE_TYPES = teacherModules().map((m) => ({
    key: m.key as ModuleKey,
    label: m.label,
    icon: (MODULE_ICON[m.key] ?? MODULE_ICON.practice)(moduleType === m.key ? color('accent/default') : color('text/secondary')),
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          New Test
        </Text>
        <TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving} />
      </View>

      {loadError ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
          <ErrorBanner message="Couldn't load your course info." onRetry={loadCourseInfo} />
        </View>
      ) : null}


      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <InputField label="Test Title" value={title} onChangeText={setTitle} />

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Module Type
            </Text>
            <View style={[styles.chipRow, { gap: space.xs }]}>
              {MODULE_TYPES.map((m) => {
                const active = moduleType === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setModuleType(m.key)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.pill,
                        paddingHorizontal: space.sm,
                        backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                        borderWidth: 1,
                        borderColor: active ? color('accent/default') : color('border/subtle'),
                      },
                    ]}
                  >
                    {m.icon}
                    <Text
                      style={[
                        type['type/body-m-medium'],
                        { color: active ? color('accent/default') : color('text/primary'), marginLeft: 6 },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={goToLocationPicker}
            style={[
              styles.readOnlyRow,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Location in Course</Text>
              <Text style={[type['type/body-l'], { color: location ? color('text/primary') : color('text/tertiary'), marginTop: 2 }]}>
                {location ?? 'Not set'}
              </Text>
            </View>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
          {!canProceed ? (
            <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: -space.sm }]}>
              Choose where this test lives in the course structure first.
            </Text>
          ) : null}

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Duration
            </Text>
            <View style={[styles.chipRow, { gap: space.xs }]}>
              {(['Timed', 'Untimed'] as const).map((opt) => {
                const active = (opt === 'Timed') === timed;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setTimed(opt === 'Timed')}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.pill,
                        paddingHorizontal: space.md,
                        backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                        borderWidth: 1,
                        borderColor: active ? color('accent/default') : color('border/subtle'),
                      },
                    ]}
                  >
                    <Text style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {timed ? (
              <View style={[styles.stepperRow, { marginTop: space.sm }]}>
                <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]}>
                  Duration (minutes)
                </Text>
                <Pressable
                  onPress={() => setDuration((d) => Math.max(5, d - 5))}
                  style={[styles.stepperBtn, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm }]}
                >
                  <Minus size={16} color={color('text/primary')} />
                </Pressable>
                <Text style={[type['type/h3'], { color: color('text/primary'), marginHorizontal: space.sm, minWidth: 32, textAlign: 'center' }]}>
                  {duration}
                </Text>
                <Pressable
                  onPress={() => setDuration((d) => d + 5)}
                  style={[styles.stepperBtn, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm }]}
                >
                  <Plus size={16} color={color('text/primary')} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <InputField
              label="Marks per Correct"
              value={marksCorrect}
              onChangeText={setMarksCorrect}
              keyboardType="numbers-and-punctuation"
              containerStyle={{ flex: 1 }}
            />
            <InputField
              label="Marks per Wrong"
              value={marksWrong}
              onChangeText={setMarksWrong}
              keyboardType="numbers-and-punctuation"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Requires a subscription</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Turn off to make this test a free preview for everyone.</Text>
            </View>
            <Switch value={requiresSub} onValueChange={setRequiresSub} accessibilityLabel="Requires a subscription" />
          </View>

        </View>

        {questionCount > 0 ? (
          <Pressable
            onPress={() => router.push('/(teacher)/question-builder')}
            style={[
              styles.questionSummary,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.xl },
            ]}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
              {questionCount} questions added
            </Text>
            <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Add Questions</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: space.xl, gap: space.sm }}>
          {questionCount === 0 ? (
            <PrimaryButton
              label="Add Questions"
              onPress={handleSaveDraft}
              disabled={!canProceed || !title || !moduleType || !courseId || saving}
              loading={saving}
            />
          ) : (
            <>
              <SecondaryButton label="Add More Questions" onPress={() => router.push('/(teacher)/question-builder')} />
              <PrimaryButton
                label="Preview & Submit"
                onPress={() =>
                  router.push({
                    pathname: '/(teacher)/content-preview',
                    params: {
                      type: 'Test',
                      draftTitle: title,
                      draftModuleType: moduleType ?? '',
                      draftDuration: timed ? String(duration) : '',
                      draftMarksCorrect: marksCorrect,
                      draftMarksWrong: marksWrong,
                      draftQuestionCount: String(questionCount),
                    },
                  })
                }
                disabled={!canProceed}
              />
            </>
          )}
          <View style={{ alignItems: 'center', marginTop: space.xs }}>
            <TextButton label="Bulk Upload via CSV" onPress={handleBulkUpload} disabled={saving || !canProceed} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  banner: { overflow: 'hidden' },
  bannerContent: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepperBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  questionSummary: { flexDirection: 'row', alignItems: 'center' },
});

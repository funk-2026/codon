import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretRight, Stack, Exam, Lightning, WarningCircle, Minus, Plus } from 'phosphor-react-native';
import { ErrorBanner, InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { createTest } from '@/src/api/teacher';
import { listCourses } from '@/src/api/courses';

type ModuleType = 'Q Bank' | 'Test Series' | 'Practice';

const REJECTED_REASON = "Question 7's marked answer doesn't match the explanation given — please double-check before resubmitting.";

export default function CreateTestRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { locationLabel, chapterId: pickedChapterId, rejected } = useLocalSearchParams<{
    locationLabel?: string;
    chapterId?: string;
    rejected?: string;
  }>();
  const isRejectedEdit = rejected === '1';

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [title, setTitle] = useState('');
  const [moduleType, setModuleType] = useState<ModuleType | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(30);
  const [marksCorrect, setMarksCorrect] = useState('4');
  const [marksWrong, setMarksWrong] = useState('-1');
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const questionCount = isRejectedEdit ? 20 : 0;

  const loadCourseInfo = useCallback(() => {
    listCourses().then(res => {
      if (res.courses.length > 0) setCourseId(res.courses[0].id);
      setLoadError(false);
    }).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    loadCourseInfo();
  }, [loadCourseInfo]);

  useEffect(() => {
    if (locationLabel) setLocation(locationLabel);
    if (pickedChapterId) setChapterId(pickedChapterId);
  }, [locationLabel, pickedChapterId]);

  useEffect(() => {
    if (isRejectedEdit) {
      setTitle('Thermodynamics Full Test');
      setModuleType('Test Series');
      setLocation('NEET UG · Physics · Thermodynamics');
    }
  }, [isRejectedEdit]);

  const locationSet = !!location;
  const canProceed = locationSet;

  const handleSaveDraft = async () => {
    if (!title || !moduleType || !courseId) return;
    setSaving(true);
    try {
      const res = await createTest({
        title,
        course_id: courseId,
        module_type: moduleType === 'Q Bank' ? 'qbank' : moduleType === 'Test Series' ? 'test_series' : 'practice',
        ...(chapterId ? { chapter_id: chapterId } : {}),
      });
      show('Draft saved', 'success');
      // For MVP, proceed to question builder
      router.push({ pathname: '/(teacher)/(upload)/question-builder', params: { testId: res.id } });
    } catch (err) {
      show('Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const goToLocationPicker = () => {
    router.push({
      pathname: '/(teacher)/(home)/course-structure-manager',
      params: { pickerMode: '1', returnTo: '/(teacher)/(upload)/create-test' },
    });
  };

  const MODULE_TYPES: { key: ModuleType; icon: React.ReactNode }[] = [
    { key: 'Q Bank', icon: <Stack size={18} color={moduleType === 'Q Bank' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
    { key: 'Test Series', icon: <Exam size={18} color={moduleType === 'Test Series' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
    { key: 'Practice', icon: <Lightning size={18} color={moduleType === 'Practice' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
  ];

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
          {isRejectedEdit ? 'Edit Test' : 'New Test'}
        </Text>
        <TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving} />
      </View>

      {loadError ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
          <ErrorBanner message="Couldn't load your course info." onRetry={loadCourseInfo} />
        </View>
      ) : null}

      {isRejectedEdit && !bannerDismissed ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.sm }}>
          <View style={[styles.banner, { borderRadius: radius.md }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={[styles.bannerContent, { padding: space.sm }]}>
              <WarningCircle size={18} color={color('semantic/danger')} />
              <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1, marginLeft: space.xs }]}>
                {REJECTED_REASON}
              </Text>
              <Pressable onPress={() => setBannerDismissed(true)} hitSlop={space.xs}>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
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
                      {m.key}
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

          <InputField label="Topic" value={topic} onChangeText={setTopic} placeholder="Optional" />

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
        </View>

        {questionCount > 0 ? (
          <Pressable
            onPress={() => router.push('/(teacher)/(upload)/question-builder')}
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
              <SecondaryButton label="Add More Questions" onPress={() => router.push('/(teacher)/(upload)/question-builder')} />
              <PrimaryButton
                label="Preview & Submit"
                onPress={() =>
                  router.push({
                    pathname: '/(teacher)/(content)/content-preview',
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
            <TextButton label="Bulk Upload via CSV" onPress={() => router.push('/(teacher)/(upload)/csv-upload')} />
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

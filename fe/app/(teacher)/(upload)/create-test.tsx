import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, Stack, Exam, Lightning, WarningCircle, Minus, Plus } from 'phosphor-react-native';
import { InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { createTest } from '@/src/api/teacher';
import { listCourses, getCurriculum, Course, Subject, Chapter } from '@/src/api/courses';

type ModuleType = 'Q Bank' | 'Test Series' | 'Practice';

const REJECTED_REASON = "Question 7's marked answer doesn't match the explanation given — please double-check before resubmitting.";

function SelectDropdown({
  label,
  placeholder,
  value,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  placeholder: string;
  value?: string | null;
  options: { label: string; value: string | null }[];
  onSelect: (val: string | null) => void;
  disabled?: boolean;
}) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => !disabled && setOpen((v) => !v)}
        style={[
          styles.dropdownBtn,
          {
            backgroundColor: color('bg/surface'),
            borderColor: open ? color('accent/default') : color('border/subtle'),
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 2,
          },
        ]}
      >
        <Text style={[type['type/body-m'], { color: selectedOption ? color('text/primary') : color('text/tertiary'), flex: 1 }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <CaretDown size={18} color={color('text/tertiary')} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.modalBox, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }]}>
            <Text style={[type['type/h3'], { color: color('text/primary'), marginBottom: space.sm }]}>{label}</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.label + (opt.value || 'null')}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: active ? color('accent/tint') : 'transparent',
                        borderRadius: radius.sm,
                        paddingVertical: space.sm,
                        paddingHorizontal: space.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type['type/body-m'],
                        { color: active ? color('accent/default') : color('text/primary'), fontWeight: active ? '600' : '400', flex: 1 },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {active ? <Text style={{ color: color('accent/default'), fontWeight: '700' }}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function CreateTestRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { rejected } = useLocalSearchParams<{ rejected?: string }>();
  const isRejectedEdit = rejected === '1';

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleType, setModuleType] = useState<ModuleType | null>('Test Series');
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(30);
  const [marksCorrect, setMarksCorrect] = useState('4');
  const [marksWrong, setMarksWrong] = useState('-1');
  const [saving, setSaving] = useState(false);

  // Cascading Location Dropdowns State
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);

  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const [testId, setTestId] = useState<string | null>(null);
  const questionCount = isRejectedEdit ? 20 : 0;

  // Load available courses
  useEffect(() => {
    listCourses()
      .then((res) => {
        setCoursesList(res.courses || []);
        if (res.courses && res.courses.length > 0) {
          handleCourseSelect(res.courses[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleCourseSelect = (selectedId: string | null) => {
    setCourseId(selectedId);
    setSubjectId(null);
    setChapterId(null);
    setSubjectsList([]);
    setChaptersList([]);

    if (selectedId) {
      getCurriculum(selectedId)
        .then((res) => {
          setSubjectsList(res.course?.subjects || []);
        })
        .catch(() => {});
    }
  };

  const handleSubjectSelect = (selectedSubId: string | null) => {
    setSubjectId(selectedSubId);
    setChapterId(null);
    setChaptersList([]);

    if (selectedSubId) {
      const sub = subjectsList.find((s) => s.id === selectedSubId);
      if (sub) {
        setChaptersList(sub.chapters || []);
      }
    }
  };

  const handleChapterSelect = (selectedChapId: string | null) => {
    setChapterId(selectedChapId);
  };

  useEffect(() => {
    if (isRejectedEdit) {
      setTitle('Thermodynamics Full Test');
      setDescription('Grand mock test covering heat transfer, laws of thermodynamics, and kinetic theory.');
      setModuleType('Test Series');
    }
  }, [isRejectedEdit]);

  const isFormValid = !!courseId && title.trim().length > 0 && !!moduleType;

  const ensureTestSaved = async (): Promise<string | null> => {
    if (testId) return testId;
    if (!isFormValid) {
      show('Please enter a Title and select a Course', 'error');
      return null;
    }
    setSaving(true);
    try {
      const res = await createTest({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        course_id: courseId!,
        module_type: moduleType === 'Q Bank' ? 'qbank' : moduleType === 'Test Series' ? 'test_series' : 'practice',
        ...(subjectId ? { subject_id: subjectId } : {}),
        ...(chapterId ? { chapter_id: chapterId } : {}),
        ...(timed ? { duration_minutes: duration } : {}),
        ...(marksCorrect ? { marks_per_correct: parseFloat(marksCorrect) || 4 } : {}),
        ...(marksWrong ? { marks_per_wrong: parseFloat(marksWrong) || -1 } : {}),
      });
      setTestId(res.id);
      show('Test saved as draft', 'success');
      return res.id;
    } catch (err: any) {
      show(err?.message || 'Failed to save test draft', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    await ensureTestSaved();
  };

  const handleGoToQuestionBuilder = async () => {
    const id = await ensureTestSaved();
    if (id) {
      router.push({ pathname: '/(teacher)/(upload)/question-builder', params: { testId: id } });
    }
  };

  const handleGoToCsvUpload = async () => {
    const id = await ensureTestSaved();
    if (id) {
      router.push({ pathname: '/(teacher)/(upload)/csv-upload', params: { testId: id } });
    }
  };

  const MODULE_TYPES: { key: ModuleType; icon: React.ReactNode }[] = [
    { key: 'Q Bank', icon: <Stack size={18} color={moduleType === 'Q Bank' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
    { key: 'Test Series', icon: <Exam size={18} color={moduleType === 'Test Series' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
    { key: 'Practice', icon: <Lightning size={18} color={moduleType === 'Practice' ? color('accent/default') : color('text/secondary')} weight="duotone" /> },
  ];

  const courseOptions = coursesList.map((c) => ({ label: c.name, value: c.id }));

  const subjectOptions = [
    { label: 'All Subjects (Course-Level Test)', value: null },
    ...subjectsList.map((s) => ({ label: s.name, value: s.id })),
  ];

  const chapterOptions = [
    { label: 'All Chapters (Subject-Level Test)', value: null },
    ...chaptersList.map((ch) => ({ label: ch.name, value: ch.id })),
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
        <TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving || !isFormValid} />
      </View>

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
          <InputField label="Test Title *" value={title} onChangeText={setTitle} placeholder="e.g. Thermodynamics Chapter Test" />
          <InputField label="Description (Optional)" value={description} onChangeText={setDescription} multiline placeholder="e.g. Test covering Newton's Laws and Friction." />

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Module Type *
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

          {/* Cascading Dropdowns */}
          <SelectDropdown
            label="Course *"
            placeholder="Select Course"
            value={courseId}
            options={courseOptions}
            onSelect={handleCourseSelect}
          />

          {courseId ? (
            <SelectDropdown
              label="Subject (Optional)"
              placeholder="All Subjects (Course-Level Test)"
              value={subjectId}
              options={subjectOptions}
              onSelect={handleSubjectSelect}
            />
          ) : null}

          {subjectId && chaptersList.length > 0 ? (
            <SelectDropdown
              label="Chapter (Optional)"
              placeholder="All Chapters (Subject-Level Test)"
              value={chapterId}
              options={chapterOptions}
              onSelect={handleChapterSelect}
            />
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
        </View>

        {questionCount > 0 ? (
          <Pressable
            onPress={handleGoToQuestionBuilder}
            style={[
              styles.questionSummary,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.xl },
            ]}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
              {questionCount} questions added
            </Text>
            <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Manage Questions</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <PrimaryButton
            label={saving ? 'Saving Test…' : 'Bulk Upload via CSV'}
            onPress={handleGoToCsvUpload}
            disabled={!isFormValid || saving}
            loading={saving}
          />
          <SecondaryButton
            label="Single Question Builder"
            onPress={handleGoToQuestionBuilder}
            disabled={!isFormValid || saving}
          />
          {testId ? (
            <Pressable
              onPress={() => router.push({ pathname: '/(teacher)/(content)/content-preview', params: { type: 'Test', id: testId } })}
              style={{ alignItems: 'center', marginTop: space.xs }}
            >
              <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
                Preview & Submit Test
              </Text>
            </Pressable>
          ) : null}
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
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepperBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  questionSummary: { flexDirection: 'row', alignItems: 'center' },
});

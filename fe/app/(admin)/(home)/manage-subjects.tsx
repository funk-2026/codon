import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight, Folder, Plus, Books, WarningCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listCourses, getCurriculum, type Course, type Subject } from '@/src/api/courses';
import { createSubject, createChapter } from '@/src/api/admin';

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function ManageSubjectsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [chapterSubmitting, setChapterSubmitting] = useState(false);

  const loadCourses = useCallback(() => {
    setLoading(true);
    listCourses()
      .then((res) => {
        setCourses(res.courses);
        setLoadError(false);
      })
      .catch(() => {
        show('Failed to load courses', 'error');
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [show]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const loadSubjects = (course: Course) => {
    setSelectedCourse(course);
    setSubjectsLoading(true);
    getCurriculum(course.id)
      .then((res) => setSubjects(res.course.subjects))
      .catch(() => show('Failed to load subjects', 'error'))
      .finally(() => setSubjectsLoading(false));
  };

  const goBack = () => {
    if (selectedSubject) {
      setSelectedSubject(null);
    } else if (selectedCourse) {
      setSelectedCourse(null);
      setSubjects([]);
    } else {
      router.back();
    }
  };

  const submitNewSubject = async () => {
    if (newName.trim().length === 0 || submitting || !selectedCourse) return;
    setSubmitting(true);
    try {
      const subject = await createSubject(selectedCourse.id, newName.trim(), newDescription.trim());
      setSubjects((prev) => [...prev, { ...subject, chapters: subject.chapters ?? [] }]);
      setAddOpen(false);
      setNewName('');
      setNewDescription('');
      show('Subject added', 'success');
    } catch (e) {
      show('Failed to add subject', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewChapter = async () => {
    if (newChapterName.trim().length === 0 || chapterSubmitting || !selectedSubject) return;
    setChapterSubmitting(true);
    try {
      const chapter = await createChapter(selectedSubject.id, newChapterName.trim(), '');
      const updatedSubject = { ...selectedSubject, chapters: [...(selectedSubject.chapters ?? []), chapter] };
      setSelectedSubject(updatedSubject);
      setSubjects((prev) => prev.map((s) => (s.id === updatedSubject.id ? updatedSubject : s)));
      setAddChapterOpen(false);
      setNewChapterName('');
      show('Chapter added', 'success');
    } catch (e) {
      show('Failed to add chapter', 'error');
    } finally {
      setChapterSubmitting(false);
    }
  };

  const title = selectedSubject ? selectedSubject.name : selectedCourse ? selectedCourse.name : 'Manage Subjects';
  const subtitle = selectedSubject ? 'Chapters' : selectedCourse ? 'Subjects' : 'Select a course';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.headerRow, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable onPress={goBack} hitSlop={space.xs} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <View style={{ marginLeft: space.sm }}>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{subtitle}</Text>
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>{title}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {!selectedCourse ? (
          loading ? (
            <View style={{ gap: space.sm }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} height={72} radius={radius.md} />
              ))}
            </View>
          ) : loadError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load courses"
              description="Something went wrong fetching your courses."
              action={<TextButton label="Retry" onPress={loadCourses} />}
            />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={<Books size={32} color={color('text/tertiary')} weight="duotone" />}
              title="No courses"
              description="Courses are set up server-side."
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {courses.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => loadSubjects(c)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                    <Books size={20} color={color('accent/default')} weight="duotone" />
                  </View>
                  <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
                    {c.name}
                  </Text>
                  <CaretRight size={18} color={color('text/tertiary')} />
                </Pressable>
              ))}
            </View>
          )
        ) : !selectedSubject ? (
          <>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={[
                styles.addRow,
                { borderRadius: radius.md, borderColor: color('border/strong'), padding: space.md, marginBottom: space.sm },
              ]}
            >
              <Plus size={18} color={color('accent/default')} />
              <Text style={[type['type/body-m-medium'], { color: color('accent/default'), marginLeft: space.xs }]}>
                Add Subject
              </Text>
            </Pressable>

            {subjectsLoading ? (
              <View style={{ gap: space.sm }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} height={72} radius={radius.md} />
                ))}
              </View>
            ) : subjects.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.xs }}>
                <Folder size={28} color={color('text/tertiary')} weight="duotone" />
                <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
                  Nothing here yet — add the first subject.
                </Text>
              </View>
            ) : (
              <View style={{ gap: space.xs }}>
                {subjects.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSubject(s)}
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
                        {s.name}
                      </Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        {s.chapters?.length ?? 0} chapter{(s.chapters?.length ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <CaretRight size={18} color={color('text/tertiary')} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setAddChapterOpen(true)}
              style={[
                styles.addRow,
                { borderRadius: radius.md, borderColor: color('border/strong'), padding: space.md, marginBottom: space.sm },
              ]}
            >
              <Plus size={18} color={color('accent/default')} />
              <Text style={[type['type/body-m-medium'], { color: color('accent/default'), marginLeft: space.xs }]}>
                Add Chapter
              </Text>
            </Pressable>

            {(selectedSubject.chapters?.length ?? 0) === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.xs }}>
                <Folder size={28} color={color('text/tertiary')} weight="duotone" />
                <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
                  Nothing here yet — add the first chapter.
                </Text>
              </View>
            ) : (
              <View style={{ gap: space.xs }}>
                {(selectedSubject.chapters ?? []).map((ch) => (
                  <View
                    key={ch.id}
                    style={[
                      styles.row,
                      { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm },
                      shadow(),
                    ]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                      <Folder size={20} color={color('accent/default')} weight="duotone" />
                    </View>
                    <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]} numberOfLines={1}>
                      {ch.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>New Subject</Text>
            <InputField
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Physics"
              autoFocus
              containerStyle={{ marginTop: space.md }}
            />
            <InputField
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Description (optional)"
              multiline
              containerStyle={{ marginTop: space.sm }}
            />
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton
                label="Add Subject"
                onPress={submitNewSubject}
                disabled={newName.trim().length === 0}
                loading={submitting}
              />
              <SecondaryButton label="Cancel" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addChapterOpen} transparent animationType="fade" onRequestClose={() => setAddChapterOpen(false)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>New Chapter</Text>
            <InputField
              value={newChapterName}
              onChangeText={setNewChapterName}
              placeholder="e.g. Thermodynamics"
              autoFocus
              containerStyle={{ marginTop: space.md }}
            />
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton
                label="Add Chapter"
                onPress={submitNewChapter}
                disabled={newChapterName.trim().length === 0}
                loading={chapterSubmitting}
              />
              <SecondaryButton label="Cancel" onPress={() => setAddChapterOpen(false)} />
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
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretRight, Folder, Books, PlayCircle, FileText, ClipboardText, WarningCircle, type IconProps } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, StatusBadge, TextButton, type BadgeStatus, Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listCourses, getCurriculum, type Course, type Subject, type Chapter } from '@/src/api/courses';
import { adminListContent, adminListTests } from '@/src/api/admin';
import { useSafeBack } from '@/src/navigation/useSafeBack';
import { shadow } from '@/src/theme/elevation';
import { useQuery } from '@tanstack/react-query';

type StructureItemType = 'video' | 'document' | 'test';

type StructureItem = {
  id: string;
  title: string;
  type: StructureItemType;
  status: string;
};

const TYPE_ICON: Record<StructureItemType, React.ComponentType<IconProps>> = {
  video: PlayCircle,
  document: FileText,
  test: ClipboardText,
};

const TYPE_LABEL: Record<StructureItemType, string> = {
  video: 'Video',
  document: 'Document',
  test: 'Test',
};

const BADGE_STATUS: Record<string, BadgeStatus> = {
  draft: 'draft',
  pending: 'pending',
  pending_review: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  published: 'published',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'In Review',
  pending_review: 'In Review',
  approved: 'Approved',
  rejected: 'Changes Needed',
  published: 'Live',
};

function badgeFor(status: string): BadgeStatus {
  return BADGE_STATUS[status] ?? 'neutral';
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function chapterCountLabel(ch: Chapter): string {
  const parts: string[] = [];
  if (typeof ch.content_count === 'number') parts.push(`${ch.content_count} content`);
  if (typeof ch.test_count === 'number') parts.push(`${ch.test_count} test${ch.test_count === 1 ? '' : 's'}`);
  return parts.join(' · ');
}


export default function CourseStructureRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const insets = useSafeAreaInsets();


  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [contentItems, setContentItems] = useState<StructureItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);

  const loadQuery = useQuery({ queryKey: ['app-admin-course-structure-tsx'], queryFn: () =>
      listCourses().then((res) => {
        return res.courses;
      }) });
  const courses = loadQuery.data ?? [];
  const loading = loadQuery.isPending;
  const loadError = loadQuery.isError;
  const loadCourses = () => void loadQuery.refetch();

  const loadSubjects = useCallback((course: Course) => {
    setSelectedCourse(course);
    setSubjectsLoading(true);
    setSubjectsError(false);
    getCurriculum(course.id)
      .then((res) => {
        setSubjects(res.course.subjects ?? []);
        setSubjectsError(false);
      })
      .catch(() => setSubjectsError(true))
      .finally(() => setSubjectsLoading(false));
  }, []);

  const loadContent = useCallback((chapter: Chapter) => {
    setSelectedChapter(chapter);
    setContentLoading(true);
    setContentError(false);
    Promise.all([adminListContent(), adminListTests()])
      .then(([contentRes, testsRes]) => {
        const items: StructureItem[] = [
          ...contentRes.content
            .filter((c) => c.chapter_id === chapter.id)
            .map((c) => ({ id: c.id, title: c.title, type: c.content_type, status: c.status })),
          ...testsRes.tests
            .filter((t) => t.chapter_id === chapter.id)
            .map((t) => ({ id: t.id, title: t.title, type: 'test' as const, status: t.status })),
        ];
        setContentItems(items);
        setContentError(false);
      })
      .catch(() => setContentError(true))
      .finally(() => setContentLoading(false));
  }, []);

  const retryContent = () => {
    if (selectedChapter) loadContent(selectedChapter);
  };

  const goBack = () => {
    if (selectedChapter) {
      setSelectedChapter(null);
      setContentItems([]);
      return;
    }
    if (selectedSubject) {
      setSelectedSubject(null);
      return;
    }
    if (selectedCourse) {
      setSelectedCourse(null);
      setSubjects([]);
      return;
    }
    safeBack();
  };

  const title = selectedChapter
    ? selectedChapter.name
    : selectedSubject
    ? selectedSubject.name
    : selectedCourse
    ? selectedCourse.name
    : 'Course Structure';

  const subtitle = selectedChapter
    ? 'Content'
    : selectedSubject
    ? 'Chapters'
    : selectedCourse
    ? 'Subjects'
    : 'Select a course';

  return (
    <Screen>
      <ScreenHeader eyebrow={subtitle} title={title} onBack={goBack} />

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
          subjectsLoading ? (
            <View style={{ gap: space.sm }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} height={72} radius={radius.md} />
              ))}
            </View>
          ) : subjectsError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load subjects"
              description="Something went wrong fetching this course's subjects."
              action={<TextButton label="Retry" onPress={() => loadSubjects(selectedCourse)} />}
            />
          ) : subjects.length === 0 ? (
            <EmptyState
              icon={<Folder size={32} color={color('text/tertiary')} weight="duotone" />}
              title="No subjects"
              description="This course has no subjects yet."
            />
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
          )
        ) : !selectedChapter ? (
          (selectedSubject.chapters?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Folder size={32} color={color('text/tertiary')} weight="duotone" />}
              title="No chapters"
              description="This subject has no chapters yet."
            />
          ) : (
            <View style={{ gap: space.xs }}>
              {selectedSubject.chapters.map((ch) => {
                const countLabel = chapterCountLabel(ch);
                return (
                  <Pressable
                    key={ch.id}
                    onPress={() => loadContent(ch)}
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
                        {ch.name}
                      </Text>
                      {countLabel ? (
                        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                          {countLabel}
                        </Text>
                      ) : null}
                    </View>
                    <CaretRight size={18} color={color('text/tertiary')} />
                  </Pressable>
                );
              })}
            </View>
          )
        ) : contentLoading ? (
          <View style={{ gap: space.sm }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} height={72} radius={radius.md} />
            ))}
          </View>
        ) : contentError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load content"
            description="Something went wrong fetching this chapter's content."
            action={<TextButton label="Retry" onPress={retryContent} />}
          />
        ) : contentItems.length === 0 ? (
          <EmptyState
            icon={<Folder size={32} color={color('text/tertiary')} weight="duotone" />}
            title="No content"
            description="Nothing has been uploaded to this chapter yet."
          />
        ) : (
          <View style={{ gap: space.xs }}>
            {contentItems.map((item) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <View
                  key={`${item.type}-${item.id}`}
                  style={[
                    styles.row,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm },
                    shadow(),
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.sm }]}>
                    <Icon size={20} color={color('accent/default')} weight="duotone" />
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                      {TYPE_LABEL[item.type]}
                    </Text>
                  </View>
                  <StatusBadge status={badgeFor(item.status)} label={statusLabel(item.status)} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

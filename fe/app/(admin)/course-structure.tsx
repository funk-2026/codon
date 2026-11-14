import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretDown, CaretRight, ClipboardText, FileText, Plus, PlayCircle, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, CourseSelector, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, StatusBadge, TextButton, useToast, type BadgeStatus,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { listCourses, getCurriculum } from '@/src/api/courses';
import { defaultCourse } from '@/src/api/courseSelection';
import { adminListContent, adminListTests, createChapter, createSubject } from '@/src/api/admin';

type ItemType = 'video' | 'document' | 'test';
const ICON: Record<ItemType, React.ComponentType<{ size: number; color: string }>> = { video: PlayCircle, document: FileText, test: ClipboardText };
const BADGE: Record<string, { status: BadgeStatus; label: string }> = {
  draft: { status: 'draft', label: 'Draft' },
  pending: { status: 'pending', label: 'In review' },
  pending_review: { status: 'pending', label: 'In review' },
  approved: { status: 'approved', label: 'Approved' },
  rejected: { status: 'rejected', label: 'Changes needed' },
  published: { status: 'published', label: 'Live' },
};

/**
 * The course in one place: subjects and their chapters, what each chapter holds, and the two
 * things an admin changes here, adding a subject and adding a chapter.
 */
export default function CourseStructureRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const queryClient = useQueryClient();

  const courses = useQuery({ queryKey: ['courses'], queryFn: listCourses, select: (r) => r.courses, staleTime: 10 * 60_000 });
  const [courseId, setCourseId] = useState<string | null>(null);
  useEffect(() => {
    if (!courseId && courses.data) setCourseId(defaultCourse(courses.data)?.id ?? null);
  }, [courses.data, courseId]);

  const curriculumKey = ['admin', 'curriculum', courseId];
  const curriculum = useQuery({ queryKey: curriculumKey, queryFn: () => getCurriculum(courseId as string), enabled: !!courseId });
  const subjects = curriculum.data?.course.subjects ?? [];

  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});
  const anyChapterOpen = Object.values(openChapters).some(Boolean);
  // What each chapter holds comes from two lists fetched once, the first time a chapter is opened.
  const content = useQuery({ queryKey: ['admin', 'all-content'], queryFn: () => adminListContent(), enabled: anyChapterOpen });
  const tests = useQuery({ queryKey: ['admin', 'all-tests'], queryFn: () => adminListTests(), enabled: anyChapterOpen });

  const [subjectSheet, setSubjectSheet] = useState(false);
  const [chapterFor, setChapterFor] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setSubjectSheet(false); setChapterFor(null); setName(''); setDescription(''); };

  const addSubject = async () => {
    if (!courseId || !name.trim() || busy) return;
    setBusy(true);
    try {
      await createSubject(courseId, name.trim(), description.trim());
      await queryClient.invalidateQueries({ queryKey: curriculumKey });
      show('Subject added', 'success');
      close();
    } catch {
      show('Failed to add subject', 'error');
    } finally {
      setBusy(false);
    }
  };
  const addChapter = async () => {
    if (!chapterFor || !name.trim() || busy) return;
    setBusy(true);
    try {
      await createChapter(chapterFor.id, name.trim(), '');
      await queryClient.invalidateQueries({ queryKey: curriculumKey });
      show('Chapter added', 'success');
      close();
    } catch {
      show('Failed to add chapter', 'error');
    } finally {
      setBusy(false);
    }
  };

  const itemsFor = (chapterId: string) => [
    ...(content.data?.content ?? []).filter((c) => c.chapter_id === chapterId).map((c) => ({ id: c.id, title: c.title, type: (c.content_type === 'video' ? 'video' : 'document') as ItemType, status: c.status })),
    ...(tests.data?.tests ?? []).filter((t) => t.chapter_id === chapterId).map((t) => ({ id: t.id, title: t.title, type: 'test' as ItemType, status: t.status })),
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Course structure"
        right={
          <Pressable onPress={() => setSubjectSheet(true)} disabled={!courseId} accessibilityRole="button" accessibilityLabel="Add a subject" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={26} weight="bold" color={color('accent/default')} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space['3xl'] + insets.bottom, gap: space.xs }} showsVerticalScrollIndicator={false}>
        {courses.data && courses.data.length > 1 ? (
          <CourseSelector courses={courses.data} value={courseId} onChange={(id) => { setCourseId(id); setOpenSubject(null); setOpenChapters({}); }} />
        ) : null}

        {courses.isPending || curriculum.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={64} radius={radius.md} />)
        ) : courses.isError || curriculum.isError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the course"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={() => { void courses.refetch(); void curriculum.refetch(); }} />}
          />
        ) : subjects.length === 0 ? (
          <EmptyState title="No subjects yet" description="Add the first subject with the + button." />
        ) : (
          subjects.map((s) => {
            const expanded = openSubject === s.id;
            return (
              <View key={s.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, overflow: 'hidden' }, shadow()]}>
                <Pressable onPress={() => setOpenSubject(expanded ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ padding: space.sm, minHeight: 56, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{s.name}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{(s.chapters ?? []).length} chapters</Text>
                  </View>
                  {expanded ? <CaretDown size={20} color={color('text/tertiary')} /> : <CaretRight size={20} color={color('text/tertiary')} />}
                </Pressable>
                {expanded ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
                    {(s.chapters ?? []).map((c) => {
                      const open = !!openChapters[c.id];
                      const items = open ? itemsFor(c.id) : [];
                      return (
                        <View key={c.id} style={{ borderBottomWidth: 1, borderBottomColor: color('border/subtle') }}>
                          <Pressable onPress={() => setOpenChapters((m) => ({ ...m, [c.id]: !m[c.id] }))} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={2}>{c.name}</Text>
                            {typeof c.content_count === 'number' || typeof c.test_count === 'number' ? (
                              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginRight: space.xs }]}>
                                {[typeof c.content_count === 'number' ? `${c.content_count} content` : null, typeof c.test_count === 'number' ? `${c.test_count} test${c.test_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
                              </Text>
                            ) : null}
                            {open ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
                          </Pressable>
                          {open ? (
                            <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: space['2xs'] }}>
                              {content.isPending || tests.isPending ? (
                                <SkeletonBlock height={44} radius={radius.sm} />
                              ) : items.length === 0 ? (
                                <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingVertical: space.xs }]}>Nothing here yet.</Text>
                              ) : (
                                items.map((i) => {
                                  const Icon = ICON[i.type];
                                  const b = BADGE[i.status] ?? { status: 'neutral' as BadgeStatus, label: i.status };
                                  return (
                                    <View key={i.id} style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                                      <Icon size={20} color={color('accent/default')} />
                                      <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={2}>{i.title}</Text>
                                      <StatusBadge status={b.status} label={b.label} />
                                    </View>
                                  );
                                })
                              )}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <Pressable onPress={() => { setName(''); setChapterFor({ id: s.id, name: s.name }); }} accessibilityRole="button" style={{ padding: space.sm, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                      <Plus size={18} color={color('accent/default')} weight="bold" />
                      <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Add a chapter</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <BottomSheet visible={subjectSheet} onClose={close} title="Add a subject" dismissable={!busy}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <InputField label="Subject name" value={name} onChangeText={setName} maxLength={80} />
          <InputField label="Description (optional)" value={description} onChangeText={setDescription} multiline maxLength={300} />
          <PrimaryButton label="Add subject" onPress={addSubject} loading={busy} disabled={!name.trim()} />
        </View>
      </BottomSheet>
      <BottomSheet visible={!!chapterFor} onClose={close} title={`Add a chapter to ${chapterFor?.name ?? ''}`} dismissable={!busy}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <InputField label="Chapter name" value={name} onChangeText={setName} maxLength={120} />
          <PrimaryButton label="Add chapter" onPress={addChapter} loading={busy} disabled={!name.trim()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

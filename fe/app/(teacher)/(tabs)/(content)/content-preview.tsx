import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, CaretUp, Play, Pause, CheckCircle, Clock, Exam, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SkeletonBlock, StatusBadge, TextButton, type BadgeStatus, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitTestForReview, submitContentForReview, publishContent, getTeacherContent, getTeacherTest } from '@/src/api/teacher';
import { Test, Question } from '@/src/api/tests';
import { ContentItem } from '@/src/api/content';

type ContentType = 'Test' | 'Video' | 'Document' | 'Brain Hack';
type Status = 'draft' | 'pending' | 'approved' | 'published';

const QUESTION_OPTIONS: { letter: string; key: 'option_a' | 'option_b' | 'option_c' | 'option_d' }[] = [
  { letter: 'A', key: 'option_a' },
  { letter: 'B', key: 'option_b' },
  { letter: 'C', key: 'option_c' },
  { letter: 'D', key: 'option_d' },
];

function taxonomyBadge(status: Status): { badgeStatus: BadgeStatus; label: string } {
  const map: Record<Status, { badgeStatus: BadgeStatus; label: string }> = {
    draft: { badgeStatus: 'draft', label: 'Draft' },
    pending: { badgeStatus: 'pending', label: 'In Review' },
    approved: { badgeStatus: 'approved', label: 'Approved' },
    published: { badgeStatus: 'published', label: 'Live' },
  };
  return map[status];
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function breadcrumbFrom(parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(' · ');
}

export default function ContentPreviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const {
    type: rawType,
    status: rawStatus,
    id,
    draftTitle,
    draftModuleType,
    draftDuration,
    draftMarksCorrect,
    draftMarksWrong,
    draftQuestionCount,
    draftCategory,
    draftContent,
  } = useLocalSearchParams<{
    type?: string;
    status?: string;
    id?: string;
    draftTitle?: string;
    draftModuleType?: string;
    draftDuration?: string;
    draftMarksCorrect?: string;
    draftMarksWrong?: string;
    draftQuestionCount?: string;
    draftCategory?: string;
    draftContent?: string;
  }>();
  const paramType = rawType as ContentType | undefined;

  const [status, setStatus] = useState<Status>((rawStatus as Status) ?? 'draft');
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState(false);
  const [resolvedType, setResolvedType] = useState<ContentType | null>(null);
  const [testData, setTestData] = useState<Test | null>(null);
  const [contentData, setContentData] = useState<ContentItem | null>(null);

  const [questions, setQuestions] = useState<Question[] | null>(null);

  const contentType: ContentType = paramType ?? resolvedType ?? 'Test';

  const loadItem = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);

    const loadTest = () =>
      getTeacherTest(id).then((res) => {
        setTestData(res.test);
        setQuestions(res.questions);
        setResolvedType('Test');
      });
    const loadContent = () =>
      getTeacherContent(id).then((res) => {
        setContentData(res);
        const rawContentType = String(res.content_type);
        setResolvedType(
          rawContentType === 'video' ? 'Video' : rawContentType === 'brain_hack' ? 'Brain Hack' : 'Document'
        );
      });

    const run =
      paramType === 'Test'
        ? loadTest()
        : paramType === 'Video' || paramType === 'Document' || paramType === 'Brain Hack'
          ? loadContent()
          : loadTest().catch(loadContent);

    run.catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [id, paramType]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const badge = taxonomyBadge(status);

  const handleSubmitForReview = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      if (contentType === 'Test') {
        await submitTestForReview(id);
      } else {
        await submitContentForReview(id);
      }
      setStatus('pending');
      show('Sent for review', 'success');
    } catch (err) {
      show('Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      if (contentType === 'Test') {
        show('Test published (mock)', 'success');
        setStatus('published');
      } else {
        await publishContent(id);
        setStatus('published');
        show('Now live for students', 'success');
      }
    } catch (err) {
      show('Failed to publish', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const questionCountNum = id ? testData?.total_questions ?? 0 : Number(draftQuestionCount || 0);
  const durationLabel = id
    ? testData?.duration_minutes
      ? `${testData.duration_minutes} min`
      : 'Untimed'
    : draftDuration
      ? `${draftDuration} min`
      : 'Untimed';
  const markingLabel = id
    ? testData
      ? `+${testData.marks_per_correct} / ${testData.marks_per_wrong}`
      : '—'
    : draftMarksCorrect && draftMarksWrong
      ? `+${draftMarksCorrect} / ${draftMarksWrong}`
      : '—';
  const testTitle = id ? testData?.title ?? 'Untitled Test' : draftTitle?.trim() || 'Untitled Test';
  const sortedQuestions = questions ? [...questions].sort((a, b) => a.order_index - b.order_index) : null;
  const contentBreadcrumb = breadcrumbFrom([contentData?.course?.name, contentData?.chapter?.name]);

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
          Preview
        </Text>
        <StatusBadge status={badge.badgeStatus} label={badge.label} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.frame,
            { borderColor: color('border/subtle'), borderRadius: radius.lg, padding: space.sm, marginTop: space.lg },
          ]}
        >
          {loading ? (
            <View style={{ padding: space.sm, gap: space.sm }}>
              <SkeletonBlock height={28} width="70%" />
              <SkeletonBlock height={16} width="40%" />
              <SkeletonBlock height={140} radius={radius.md} />
            </View>
          ) : loadError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load preview"
              description="Something went wrong fetching this item."
              action={<TextButton label="Retry" onPress={loadItem} />}
            />
          ) : contentType === 'Test' ? (
            <View>
              <Text style={[type['type/h2'], { color: color('text/primary'), padding: space.sm }]}>
                {testTitle}
              </Text>
              <View style={[styles.statGrid, { gap: space.xs, paddingHorizontal: space.sm }]}>
                <StatChip
                  icon={<Exam size={16} color={color('accent/default')} />}
                  label={`${questionCountNum} question${questionCountNum === 1 ? '' : 's'}`}
                />
                <StatChip icon={<Clock size={16} color={color('accent/default')} />} label={durationLabel} />
                <StatChip icon={<CheckCircle size={16} color={color('accent/default')} />} label={markingLabel} />
              </View>

              <Pressable
                onPress={() => setQuestionsExpanded((v) => !v)}
                style={[styles.questionsToggle, { margin: space.sm, borderRadius: radius.md, backgroundColor: color('bg/sunken'), padding: space.sm }]}
              >
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
                  Questions ({questionCountNum})
                </Text>
                {questionsExpanded ? (
                  <CaretUp size={18} color={color('text/tertiary')} />
                ) : (
                  <CaretDown size={18} color={color('text/tertiary')} />
                )}
              </Pressable>

              {questionsExpanded ? (
                <View style={{ gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm }}>
                  {!id ? (
                    <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                      {questionCountNum > 0
                        ? "Question text isn't available in this preview yet — add or review them via the question builder."
                        : 'No questions added yet.'}
                    </Text>
                  ) : sortedQuestions && sortedQuestions.length > 0 ? (
                    sortedQuestions.map((q, qi) => (
                      <View
                        key={q.id}
                        style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}
                      >
                        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                          {qi + 1}. {q.question_text}
                        </Text>
                        <View style={{ marginTop: space.xs, gap: 4 }}>
                          {QUESTION_OPTIONS.map(({ letter, key }) => (
                            <Text
                              key={letter}
                              style={[
                                type['type/body-m'],
                                { color: q.correct_option?.toUpperCase() === letter ? color('semantic/success') : color('text/secondary') },
                              ]}
                            >
                              {letter}. {q[key]}
                              {q.correct_option?.toUpperCase() === letter ? '  ✓' : ''}
                            </Text>
                          ))}
                        </View>
                        {q.explanation ? (
                          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                            {q.explanation}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                      No questions added yet.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : contentType === 'Video' ? (
            <View>
              {contentData?.hls_playlist_url ? (
                <View style={[styles.videoFrame, { backgroundColor: '#000', borderRadius: radius.md }]}>
                  <Pressable onPress={() => setPlaying((v) => !v)} style={styles.videoCenter}>
                    {playing ? (
                      <Pause size={48} color="#fff" weight="fill" />
                    ) : (
                      <Play size={48} color="#fff" weight="fill" />
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.videoFrame, { backgroundColor: color('bg/sunken'), borderRadius: radius.md }]}>
                  <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Video not available</Text>
                </View>
              )}
              <Text style={[type['type/h3'], { color: color('text/primary'), padding: space.sm }]}>
                {contentData?.title ?? 'Untitled Video'}
              </Text>
              {contentBreadcrumb ? (
                <Text style={[type['type/caption'], { color: color('text/tertiary'), paddingHorizontal: space.sm, paddingBottom: space.sm }]}>
                  {contentBreadcrumb}
                </Text>
              ) : null}
            </View>
          ) : contentType === 'Document' ? (
            <View style={{ padding: space.sm }}>
              {contentBreadcrumb ? (
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{contentBreadcrumb}</Text>
              ) : null}
              <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: 4 }]}>
                {contentData?.title ?? 'Untitled Document'}
              </Text>
              <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.md }]}>
                Document text preview isn&apos;t available yet.
              </Text>
            </View>
          ) : id ? (
            <View style={{ padding: space.sm }}>
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>
                {contentData?.title ?? 'Untitled Brain Hack'}
              </Text>
              <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.md }]}>
                Brain hack content preview isn&apos;t available yet.
              </Text>
            </View>
          ) : (
            <View style={{ padding: space.sm }}>
              {draftCategory ? (
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm },
                  ]}
                >
                  <Text style={[type['type/caption'], { color: color('accent/default') }]}>{draftCategory}</Text>
                </View>
              ) : null}
              <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.xs }]}>
                {draftTitle?.trim() || 'Untitled Brain Hack'}
              </Text>
              <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.md }]}>
                {draftContent?.trim() || 'No content added yet.'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: space.xl, alignItems: 'center' }}>
          {status === 'pending' ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              Waiting on admin review. We&apos;ll notify you here once it&apos;s reviewed.
            </Text>
          ) : status === 'published' ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              Live for students since 18 Jul 2026.
            </Text>
          ) : null}
        </View>

        {status === 'approved' ? (
          <View style={[styles.approvedCallout, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/success'), opacity: 0.12, borderRadius: radius.md }]} />
            <Text style={[type['type/body-m-medium'], { color: color('semantic/success'), padding: space.sm }]}>
              Approved — publish when you&apos;re ready.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {status === 'draft' ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Submit for Review" onPress={handleSubmitForReview} loading={submitting} />
        </View>
      ) : status === 'approved' ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Publish" onPress={handlePublish} loading={submitting} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.sm },
      ]}
    >
      {icon}
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginLeft: 4 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  frame: { borderWidth: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 6 },
  questionsToggle: { flexDirection: 'row', alignItems: 'center' },
  videoFrame: { height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  videoCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  pill: { alignSelf: 'flex-start', paddingVertical: 4 },
  approvedCallout: { overflow: 'hidden' },
});

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, CaretUp, CheckCircle, Clock, Exam, WarningCircle } from 'phosphor-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { EmptyState, PrimaryButton, SkeletonBlock, StatusBadge, TextButton, type BadgeStatus, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitTestForReview, submitContentForReview, publishContent, publishTest, getTeacherContent, getTeacherTest, deleteTest } from '@/src/api/teacher';
import { Test, Question } from '@/src/api/tests';
import { ContentItem } from '@/src/api/content';
import { ApiError } from '@/src/api/client';

type ContentType = 'Test' | 'Video' | 'Document' | 'Brain Hack';
type Status = 'draft' | 'pending' | 'approved' | 'published' | 'rejected';

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
    rejected: { badgeStatus: 'rejected', label: 'Changes Needed' },
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

// The backend isn't consistent about status strings across endpoints
// (e.g. 'pending' vs 'pending_review' for the same in-review state) —
// normalize known variants and fall back safely for anything else.
function normalizeStatus(raw: string): Status {
  if (raw === 'pending_review') return 'pending';
  const known: Status[] = ['draft', 'pending', 'approved', 'published', 'rejected'];
  return (known as string[]).includes(raw) ? (raw as Status) : 'draft';
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

  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState(false);
  const [resolvedType, setResolvedType] = useState<ContentType | null>(null);
  const [testData, setTestData] = useState<Test | null>(null);
  const [contentData, setContentData] = useState<ContentItem | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    p.loop = false;
  });

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
        setStatus(normalizeStatus(res.test.status));
      });
    const loadContent = () =>
      getTeacherContent(id).then((res) => {
        setContentData(res.content);
        setVideoUrl(res.url);
        const rawContentType = String(res.content.content_type);
        setResolvedType(
          rawContentType === 'video' ? 'Video' : rawContentType === 'brain_hack' ? 'Brain Hack' : 'Document'
        );
        setStatus(normalizeStatus(res.content.status));
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
        await publishTest(id);
      } else {
        await publishContent(id);
      }
      setStatus('published');
      show('Now live for students', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to publish', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteTest(id);
      show('Test deleted', 'success');
      router.back();
    } catch (err) {
      show('Failed to delete', 'error');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const canDelete = contentType === 'Test' && !!id && (status === 'draft' || status === 'pending' || status === 'rejected');
  const rejectionReason = contentType === 'Test' ? testData?.rejection_reason : contentData?.rejection_reason;

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
              {videoUrl ? (
                <VideoView
                  player={player}
                  style={[styles.videoFrame, { backgroundColor: '#000', borderRadius: radius.md }]}
                  contentFit="contain"
                  nativeControls
                />
              ) : (
                <View style={[styles.videoFrame, { backgroundColor: color('bg/sunken'), borderRadius: radius.md }]}>
                  <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>
                    {contentData?.video_status === 'failed'
                      ? "Video processing failed — try re-uploading."
                      : contentData?.video_status === 'queued' || contentData?.video_status === 'transcoding'
                        ? 'Video is still processing…'
                        : 'Video not available'}
                  </Text>
                </View>
              )}
              {__DEV__ ? (
                <Text
                  selectable
                  style={[type['type/caption'], { color: color('text/tertiary'), paddingHorizontal: space.sm, paddingTop: space.xs }]}
                >
                  DEBUG video_status={contentData?.video_status ?? 'null'} url={videoUrl || '(none)'}
                </Text>
              ) : null}
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

        {status === 'rejected' ? (
          <View style={[styles.rejectedCallout, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={{ padding: space.sm }}>
              <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>REVIEWER FEEDBACK</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>
                {rejectionReason || 'No reason was provided.'}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {canDelete ? (
        deleteConfirmOpen ? (
          <View
            style={[
              styles.deleteConfirmRow,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm, marginHorizontal: space.md, marginBottom: space.sm },
            ]}
          >
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
              Delete this test permanently?
            </Text>
            <TextButton label={deleting ? 'Deleting…' : 'Yes, delete'} onPress={handleDelete} disabled={deleting} style={{ marginRight: space.sm }} />
            <TextButton label="Cancel" onPress={() => setDeleteConfirmOpen(false)} disabled={deleting} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: space.sm }}>
            <TextButton label="Delete draft" onPress={() => setDeleteConfirmOpen(true)} />
          </View>
        )
      ) : null}

      {status === 'draft' || status === 'rejected' ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label={status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'} onPress={handleSubmitForReview} loading={submitting} />
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
  pill: { alignSelf: 'flex-start', paddingVertical: 4 },
  approvedCallout: { overflow: 'hidden' },
  rejectedCallout: { overflow: 'hidden' },
  deleteConfirmRow: { flexDirection: 'row', alignItems: 'center' },
});

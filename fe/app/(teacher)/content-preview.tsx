import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CaretDown, CaretUp, CheckCircle, Clock, DotsThree, Exam, WarningCircle } from 'phosphor-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, StatusBadge, TextButton, type BadgeStatus, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitTestForReview, submitContentForReview, publishContent, publishTest, getTeacherContent, getTeacherTest, deleteTest, deleteContent, updateContent, cloneTest, transferItem, scheduleItem, getReviewStats } from '@/src/api/teacher';
import { LecturePdfEditor, type PdfKind, type PdfSlot } from '@/src/content/LecturePdfEditor';
import { Test, AuthoredQuestion } from '@/src/api/tests';
import { QuestionPreviewCard, type MediaMap } from '@/src/rich';
import { ContentItem } from '@/src/api/content';
import { ApiError } from '@/src/api/client';
import { ROUTES } from '@/src/navigation/routes';
import { useSafeBack } from '@/src/navigation/useSafeBack';
import { BrainHackDetail } from '@/src/teacher/BrainHackDetail';
import { PublishSheet, SubmitForReviewSheet, TransferSheet } from '@/src/teacher/AuthorSheets';
import { ItemStatsCard } from '@/src/teacher/ItemStatsCard';
import { describeWait, formatScheduled } from '@/src/teacher/schedule';

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

/** The one detail screen for everything a teacher makes. Brain Hacks have their own body; the rest share this one. */
export default function ContentPreviewRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return type === 'Brain Hack' ? <BrainHackDetail /> : <ContentPreview />;
}

function ContentPreview() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
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
  const [pdfSlots, setPdfSlots] = useState<Record<PdfKind, PdfSlot>>({ notes: { present: false }, annotated: { present: false } });
  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    p.loop = false;
  });

  const [questions, setQuestions] = useState<AuthoredQuestion[] | null>(null);
  const [questionMedia, setQuestionMedia] = useState<MediaMap>({});
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const reviewStats = useQuery({ queryKey: ['teacher', 'review-stats'], queryFn: getReviewStats, staleTime: 5 * 60_000 });
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const contentType: ContentType = paramType ?? resolvedType ?? 'Test';
  // Saved tests only (a local draft preview has no id yet). Pending/approved tests are
  // locked server-side; live (published) questions go through the correction flow,
  // which the editor handles — so editing is offered for draft, rejected and published.
  const testId = contentType === 'Test' && id ? String(id) : null;
  const canEditTest = !!testId && (status === 'draft' || status === 'rejected');
  const canEditQuestions = !!testId && (status === 'draft' || status === 'rejected' || status === 'published');

  const loadItem = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);

    const loadTest = () =>
      getTeacherTest(id).then((res) => {
        setTestData(res.test);
        setQuestions(res.questions);
        setQuestionMedia(res.media ?? {});
        setResolvedType('Test');
        setStatus(normalizeStatus(res.test.status));
      });
    const loadContent = () =>
      getTeacherContent(id).then((res) => {
        setContentData(res.content);
        setVideoUrl(res.url);
        setPdfSlots({ notes: { present: res.has_notes_pdf }, annotated: { present: res.has_annotated_pdf } });
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

  // Reload on focus so edits made in the question builder/editor show on return.
  useFocusEffect(
    useCallback(() => {
      loadItem();
    }, [loadItem]),
  );

  const badge = taxonomyBadge(status);

  const handleSubmitForReview = async (note: string) => {
    if (!id) return;
    setSubmitting(true);
    try {
      if (contentType === 'Test') {
        await submitTestForReview(id, note);
      } else {
        await submitContentForReview(id, note);
      }
      setStatus('pending');
      setSubmitOpen(false);
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      loadItem();
      show('Sent for review', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async (iso: string | null) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await scheduleItem(contentType === 'Test' ? 'tests' : 'content', id, iso);
      setPublishOpen(false);
      loadItem();
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show(iso ? 'Scheduled' : 'Schedule cancelled', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Couldn’t schedule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    setMenuOpen(false);
    try {
      const copy = await cloneTest(id);
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show('Duplicated as a new draft', 'success');
      router.replace({ pathname: ROUTES.teacher.contentPreview, params: { type: 'Test', id: copy.id, status: 'draft' } });
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Couldn’t duplicate', 'error');
    }
  };

  const handleTransfer = async (phone: string) => {
    if (!id) return;
    setTransferError(null);
    setSubmitting(true);
    try {
      await transferItem(contentType === 'Test' ? 'tests' : 'content', id, phone);
      setTransferOpen(false);
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show('Handed over', 'success');
      goBack();
    } catch (err) {
      setTransferError(err instanceof ApiError ? err.message : 'Couldn’t hand it over');
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
      setPublishOpen(false);
      void qc.invalidateQueries({ queryKey: ['teacher'] });
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
      if (contentType === 'Test') await deleteTest(id);
      else await deleteContent(id);
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show(contentType === 'Test' ? 'Test deleted' : 'Lesson deleted', 'success');
      goBack();
    } catch (err) {
      show('Failed to delete', 'error');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const isLesson = contentType === 'Video' || contentType === 'Document';
  const canDelete = !!id && ((contentType === 'Test' && (status === 'draft' || status === 'pending' || status === 'rejected')) || (isLesson && (status === 'draft' || status === 'rejected')));
  const canEditDetails = !!id && (contentType === 'Test' || isLesson) && (status === 'draft' || status === 'rejected');
  const scheduledAt = (contentType === 'Test' ? testData?.publish_at : contentData?.publish_at) ?? null;
  const submitNote = (contentType === 'Test' ? testData?.submit_note : contentData?.submit_note) ?? null;
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
    <Screen>
      <ScreenHeader title="Preview" right={<>
<StatusBadge status={badge.badgeStatus} label={badge.label} />
{id && (contentType === 'Test' || isLesson) ? (
  <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityLabel="More actions" style={{ marginLeft: space.xs }}>
    <DotsThree size={26} weight="bold" color={color('text/primary')} />
  </Pressable>
) : null}
</>} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {status === 'rejected' ? (
          <View style={[styles.rejectedCallout, { borderRadius: radius.md, marginTop: space.md }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={{ padding: space.sm }}>
              <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>REVIEWER FEEDBACK</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>
                {rejectionReason || 'No reason was provided.'}
              </Text>
            </View>
          </View>
        ) : null}
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
                      <View key={q.id}>
                        <QuestionPreviewCard q={q} index={qi} media={questionMedia} />
                        {canEditQuestions ? (
                          <TextButton
                            label={status === 'published' ? 'Edit question (goes to review if the answer changes)' : 'Edit question'}
                            onPress={() => router.push({ pathname: ROUTES.teacher.questionEditor, params: { testId: testId!, questionId: q.id } })}
                            style={{ alignSelf: 'flex-end' }}
                          />
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
                  fullscreenOptions={{ enable: true, orientation: 'landscape' }}
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
              {id ? (
                <View style={{ paddingHorizontal: space.sm, gap: space.xs }}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>LECTURE PDFS</Text>
                  <LecturePdfEditor
                    slots={pdfSlots}
                    onChange={async (kind, key, name) => {
                      await updateContent(String(id), kind === 'notes' ? { notes_pdf_key: key ?? '' } : { annotated_pdf_key: key ?? '' });
                      setPdfSlots((s) => ({ ...s, [kind]: { present: !!key, name } }));
                      show(key ? 'PDF attached — students see it right away' : 'PDF removed', 'success');
                    }}
                  />
                </View>
              ) : null}
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
              {contentData?.body_text ? (
                <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: space.md }]}>{contentData.body_text}</Text>
              ) : (
                <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.md }]}>
                  This lesson is an uploaded file; students open it in the reader.
                </Text>
              )}
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
              Waiting on admin review{describeWait(reviewStats.data?.median_hours) ? ` — usually ${describeWait(reviewStats.data?.median_hours)}` : ''}. You&apos;ll get a notification when it&apos;s decided.
              {submitNote ? `\n\nYour note: ${submitNote}` : ''}
            </Text>
          ) : status === 'published' ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              Live for students.
            </Text>
          ) : null}
        </View>
        {status === 'published' && id && (contentType === 'Test' || isLesson) ? <ItemStatsCard kind={contentType === 'Test' ? 'test' : 'lesson'} id={String(id)} /> : null}
        <View>
        </View>

        {status === 'approved' ? (
          <View style={[styles.approvedCallout, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/success'), opacity: 0.12, borderRadius: radius.md }]} />
            <Text style={[type['type/body-m-medium'], { color: color('semantic/success'), padding: space.sm }]}>
              {scheduledAt ? `Approved — goes live ${formatScheduled(scheduledAt)}.` : 'Approved — publish now or pick a time.'}
            </Text>
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
              Delete this permanently?
            </Text>
            <TextButton label={deleting ? 'Deleting…' : 'Yes, delete'} onPress={handleDelete} disabled={deleting} style={{ marginRight: space.sm }} />
            <TextButton label="Cancel" onPress={() => setDeleteConfirmOpen(false)} disabled={deleting} />
          </View>
        ) : null
      ) : null}

      {testId && (sortedQuestions?.length ?? 0) > 0 ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.sm }}>
          <SecondaryButton label="Try it as a student" onPress={() => router.push({ pathname: ROUTES.teacher.previewRun, params: { testId } })} />
        </View>
      ) : null}

      {canEditTest ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.sm }}>
          <SecondaryButton label="Edit test & questions" onPress={() => router.push({ pathname: ROUTES.teacher.questionBuilder, params: { testId: testId! } })} />
        </View>
      ) : null}

      {status === 'draft' || status === 'rejected' ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label={status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'} onPress={() => setSubmitOpen(true)} loading={submitting} />
        </View>
      ) : status === 'approved' ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label={scheduledAt ? 'Change or cancel the schedule' : 'Publish'} onPress={() => setPublishOpen(true)} loading={submitting} />
        </View>
      ) : null}
      <SubmitForReviewSheet visible={submitOpen} onClose={() => setSubmitOpen(false)} onSubmit={handleSubmitForReview} resubmit={status === 'rejected'} loading={submitting} />
      <PublishSheet visible={publishOpen} onClose={() => setPublishOpen(false)} onPublishNow={handlePublish} onSchedule={handleSchedule} scheduledAt={scheduledAt} loading={submitting} />
      <TransferSheet visible={transferOpen} onClose={() => setTransferOpen(false)} onTransfer={handleTransfer} loading={submitting} error={transferError} />
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="More">
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs }}>
          {canEditDetails ? (
            <TextButton label="Edit details" onPress={() => { setMenuOpen(false); router.push({ pathname: ROUTES.teacher.editDetails, params: { id: String(id), type: contentType } }); }} style={{ alignSelf: 'flex-start' }} />
          ) : null}
          {contentType === 'Test' ? <TextButton label="Duplicate as a new draft" onPress={handleDuplicate} style={{ alignSelf: 'flex-start' }} /> : null}
          <TextButton label="Hand over to another teacher" onPress={() => { setMenuOpen(false); setTransferError(null); setTransferOpen(true); }} style={{ alignSelf: 'flex-start' }} />
          {canDelete ? <TextButton label="Delete" onPress={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      </BottomSheet>
    </Screen>
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

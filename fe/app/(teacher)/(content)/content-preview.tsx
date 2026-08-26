import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, CaretUp, Play, Pause, CheckCircle, Clock, Exam, Info } from 'phosphor-react-native';
import { PrimaryButton, StatusBadge, type BadgeStatus, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitTestForReview, submitContentForReview, publishContent } from '@/src/api/teacher';
import { getTest, getTestQuestions, Test, Question } from '@/src/api/tests';
import { getContentItem, ContentItem } from '@/src/api/content';

type ContentType = 'Test' | 'Video' | 'Document' | 'Brain Hack';
type Status = 'draft' | 'pending' | 'approved' | 'published';

function taxonomyBadge(status: Status): { badgeStatus: BadgeStatus; label: string } {
  const map: Record<Status, { badgeStatus: BadgeStatus; label: string }> = {
    draft: { badgeStatus: 'draft', label: 'Draft' },
    pending: { badgeStatus: 'pending', label: 'In Review' },
    approved: { badgeStatus: 'approved', label: 'Approved' },
    published: { badgeStatus: 'published', label: 'Live' },
  };
  return map[status] || map.draft;
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

export default function ContentPreviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { type: rawType, status: rawStatus, id } = useLocalSearchParams<{ type?: string; status?: string; id?: string }>();
  const contentType = (rawType as ContentType) ?? 'Test';
  const [status, setStatus] = useState<Status>((rawStatus as Status) ?? 'draft');

  // Real Backend Data States
  const [loading, setLoading] = useState(false);
  const [testDetails, setTestDetails] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [contentDetails, setContentDetails] = useState<ContentItem | null>(null);

  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Load Real Data from Backend API
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    if (contentType === 'Test') {
      Promise.all([getTest(id), getTestQuestions(id)])
        .then(([testRes, questRes]) => {
          setTestDetails(testRes.test);
          setQuestions(questRes.questions || []);
          if (testRes.test?.status) {
            setStatus(testRes.test.status as Status);
          }
        })
        .catch((err) => {
          show('Failed to fetch test details', 'error');
        })
        .finally(() => setLoading(false));
    } else {
      getContentItem(id)
        .then((res) => {
          setContentDetails(res.content);
          if (res.content?.status) {
            setStatus(res.content.status as Status);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [id, contentType]);

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
    } catch (err: any) {
      show(err?.message || 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      if (contentType === 'Test') {
        show('Test published', 'success');
        setStatus('published');
      } else {
        await publishContent(id);
        setStatus('published');
        show('Now live for students', 'success');
      }
    } catch (err: any) {
      show(err?.message || 'Failed to publish', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getCorrectIndex = (opt?: string) => {
    if (!opt) return -1;
    const clean = opt.trim().toUpperCase();
    if (clean === 'A' || clean === '1') return 0;
    if (clean === 'B' || clean === '2') return 1;
    if (clean === 'C' || clean === '3') return 2;
    if (clean === 'D' || clean === '4') return 3;
    return -1;
  };

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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={color('accent/default')} />
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.sm }]}>
            Loading test details…
          </Text>
        </View>
      ) : (
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
            {contentType === 'Test' ? (
              <View>
                <Text style={[type['type/h2'], { color: color('text/primary'), paddingHorizontal: space.sm, paddingTop: space.sm }]}>
                  {testDetails?.title || 'Untitled Test'}
                </Text>

                {testDetails?.description ? (
                  <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingHorizontal: space.sm, marginTop: 4 }]}>
                    {testDetails.description}
                  </Text>
                ) : null}

                <View style={[styles.statGrid, { gap: space.xs, paddingHorizontal: space.sm, marginTop: space.md }]}>
                  <StatChip
                    icon={<Exam size={16} color={color('accent/default')} />}
                    label={`${questions.length} question${questions.length === 1 ? '' : 's'}`}
                  />
                  <StatChip
                    icon={<Clock size={16} color={color('accent/default')} />}
                    label={testDetails?.duration_minutes ? `${testDetails.duration_minutes} min` : 'Untimed'}
                  />
                  <StatChip
                    icon={<CheckCircle size={16} color={color('accent/default')} />}
                    label={`+${testDetails?.marks_per_correct ?? 4} / ${testDetails?.marks_per_wrong ?? -1}`}
                  />
                </View>

                <Pressable
                  onPress={() => setQuestionsExpanded((v) => !v)}
                  style={[styles.questionsToggle, { margin: space.sm, borderRadius: radius.md, backgroundColor: color('bg/sunken'), padding: space.sm }]}
                >
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
                    Questions ({questions.length})
                  </Text>
                  {questionsExpanded ? (
                    <CaretUp size={18} color={color('text/tertiary')} />
                  ) : (
                    <CaretDown size={18} color={color('text/tertiary')} />
                  )}
                </Pressable>

                {questionsExpanded ? (
                  questions.length > 0 ? (
                    <View style={{ gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm }}>
                      {questions.map((q, qi) => {
                        const optionsList = [q.option_a, q.option_b, q.option_c, q.option_d];
                        const correctIdx = getCorrectIndex(q.correct_option);

                        return (
                          <View
                            key={q.id || qi}
                            style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}
                          >
                            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                              {qi + 1}. {q.question_text}
                            </Text>
                            <View style={{ marginTop: space.xs, gap: 4 }}>
                              {optionsList.map((opt, oi) => {
                                const isCorrect = oi === correctIdx;
                                return (
                                  <Text
                                    key={oi}
                                    style={[
                                      type['type/body-m'],
                                      {
                                        color: isCorrect ? color('semantic/success') : color('text/secondary'),
                                        fontWeight: isCorrect ? '600' : '400',
                                      },
                                    ]}
                                  >
                                    {String.fromCharCode(65 + oi)}. {opt}
                                    {isCorrect ? '  ✓' : ''}
                                  </Text>
                                );
                              })}
                            </View>
                            {q.explanation ? (
                              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                                Explanation: {q.explanation}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={[styles.emptyQuestions, { backgroundColor: color('bg/sunken'), borderRadius: radius.md, margin: space.sm, padding: space.md }]}>
                      <Info size={20} color={color('text/secondary')} />
                      <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xs }]}>
                        No questions added to this test draft yet.
                      </Text>
                      <Pressable
                        onPress={() => router.push({ pathname: '/(teacher)/(upload)/csv-upload', params: { testId: id } })}
                        style={{ marginTop: space.sm }}
                      >
                        <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
                          + Add Questions via Bulk CSV
                        </Text>
                      </Pressable>
                    </View>
                  )
                ) : null}
              </View>
            ) : contentType === 'Video' ? (
              <View>
                <View style={[styles.videoFrame, { backgroundColor: '#000', borderRadius: radius.md }]}>
                  <Pressable onPress={() => setPlaying((v) => !v)} style={styles.videoCenter}>
                    {playing ? (
                      <Pause size={48} color="#fff" weight="fill" />
                    ) : (
                      <Play size={48} color="#fff" weight="fill" />
                    )}
                  </Pressable>
                </View>
                <Text style={[type['type/h3'], { color: color('text/primary'), padding: space.sm }]}>
                  {contentDetails?.title || 'Video Content'}
                </Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), paddingHorizontal: space.sm, paddingBottom: space.sm }]}>
                  Status: {contentDetails?.status || 'Draft'}
                </Text>
              </View>
            ) : contentType === 'Document' ? (
              <View style={{ padding: space.sm }}>
                <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: 4 }]}>
                  {contentDetails?.title || 'Document Content'}
                </Text>
                <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.md }]}>
                  File Key: {contentDetails?.file_key || 'Uploaded Document'}
                </Text>
              </View>
            ) : (
              <View style={{ padding: space.sm }}>
                <Text style={[type['type/h2'], { color: color('text/primary') }]}>
                  {contentDetails?.title || 'Content Item'}
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
                Live for students.
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
      )}

      {status === 'draft' && !loading ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Submit for Review" onPress={handleSubmitForReview} loading={submitting} />
        </View>
      ) : status === 'approved' && !loading ? (
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { borderWidth: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 6 },
  questionsToggle: { flexDirection: 'row', alignItems: 'center' },
  emptyQuestions: { alignItems: 'center', justifyContent: 'center' },
  videoFrame: { height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  videoCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  approvedCallout: { overflow: 'hidden' },
});

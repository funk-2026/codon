import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, CaretUp, Play, Pause, CheckCircle, Clock, Exam } from 'phosphor-react-native';
import { PrimaryButton, StatusBadge, type BadgeStatus, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitTestForReview, submitContentForReview, publishContent } from '@/src/api/teacher';

type ContentType = 'Test' | 'Video' | 'Document' | 'Brain Hack';
type Status = 'draft' | 'pending' | 'approved' | 'published';

const SAMPLE_QUESTIONS = [
  { question: 'What is the SI unit of thermodynamic temperature?', options: ['Celsius', 'Fahrenheit', 'Kelvin', 'Rankine'], correct: 2, explanation: 'Kelvin is the SI base unit of temperature.' },
  { question: 'Which law states entropy of an isolated system never decreases?', options: ['Zeroth', 'First', 'Second', 'Third'], correct: 2, explanation: 'The Second Law establishes the direction of spontaneous processes.' },
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

export default function ContentPreviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { type: rawType, status: rawStatus, id } = useLocalSearchParams<{ type?: string; status?: string; id?: string }>();
  const contentType = (rawType as ContentType) ?? 'Test';
  const [status, setStatus] = useState<Status>((rawStatus as Status) ?? 'draft');
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);

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
          {contentType === 'Test' ? (
            <View>
              <Text style={[type['type/h2'], { color: color('text/primary'), padding: space.sm }]}>
                Thermodynamics — Practice Set 4
              </Text>
              <View style={[styles.statGrid, { gap: space.xs, paddingHorizontal: space.sm }]}>
                <StatChip icon={<Exam size={16} color={color('accent/default')} />} label="20 questions" />
                <StatChip icon={<Clock size={16} color={color('accent/default')} />} label="30 min" />
                <StatChip icon={<CheckCircle size={16} color={color('accent/default')} />} label="+4 / −1" />
              </View>

              <Pressable
                onPress={() => setQuestionsExpanded((v) => !v)}
                style={[styles.questionsToggle, { margin: space.sm, borderRadius: radius.md, backgroundColor: color('bg/sunken'), padding: space.sm }]}
              >
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
                  Questions (20)
                </Text>
                {questionsExpanded ? (
                  <CaretUp size={18} color={color('text/tertiary')} />
                ) : (
                  <CaretDown size={18} color={color('text/tertiary')} />
                )}
              </Pressable>

              {questionsExpanded ? (
                <View style={{ gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm }}>
                  {SAMPLE_QUESTIONS.map((q, qi) => (
                    <View
                      key={qi}
                      style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}
                    >
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                        {qi + 1}. {q.question}
                      </Text>
                      <View style={{ marginTop: space.xs, gap: 4 }}>
                        {q.options.map((opt, oi) => (
                          <Text
                            key={oi}
                            style={[type['type/body-m'], { color: oi === q.correct ? color('semantic/success') : color('text/secondary') }]}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                            {oi === q.correct ? '  ✓' : ''}
                          </Text>
                        ))}
                      </View>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                        {q.explanation}
                      </Text>
                    </View>
                  ))}
                </View>
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
                Laws of Thermodynamics — Explained
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), paddingHorizontal: space.sm, paddingBottom: space.sm }]}>
                12:40 · NEET UG · Physics · Thermodynamics
              </Text>
            </View>
          ) : contentType === 'Document' ? (
            <View style={{ padding: space.sm }}>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                NEET UG · Physics · Thermodynamics
              </Text>
              <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: 4 }]}>
                Entropy — Chapter Notes
              </Text>
              <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.md }]}>
                Entropy quantifies the number of ways a system&apos;s energy can be distributed. For NEET,
                focus on the Second Law&apos;s statement, the direction of spontaneous processes, and how
                entropy relates to disorder at a molecular level.
              </Text>
            </View>
          ) : (
            <View style={{ padding: space.sm }}>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm },
                ]}
              >
                <Text style={[type['type/caption'], { color: color('accent/default') }]}>Focus</Text>
              </View>
              <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.xs }]}>
                The 2-minute recall trick
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>2 min read</Text>
              <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.md }]}>
                Right after finishing a topic, close your notes and try to recall three things about it out
                loud, in your own words, before checking anything.
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

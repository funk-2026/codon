import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretDown, CaretUp, Play, PlayCircle } from 'phosphor-react-native';
import { InputField, PrimaryButton, SecondaryButton, StatusBadge, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminApproveContent, adminRejectContent, adminApproveTest, adminRejectTest } from '@/src/api/admin';

type ItemType = 'test' | 'Videos' | 'Documents' | 'Brain Hacks' | 'Subject' | 'Chapter' | 'Sub-chapter';

const QUEUES: Record<'test' | 'content' | 'structure', string[]> = {
  test: ['t1', 't2', 't3'],
  content: ['c1', 'c2', 'c3'],
  structure: ['s1', 's2', 's3'],
};

function queueKindFor(type: ItemType): 'test' | 'content' | 'structure' {
  if (type === 'test') return 'test';
  if (type === 'Subject' || type === 'Chapter' || type === 'Sub-chapter') return 'structure';
  return 'content';
}

function originRoute(kind: 'test' | 'content' | 'structure') {
  if (kind === 'test') return '/(admin)/(review)/moderation-tests' as const;
  if (kind === 'content') return '/(admin)/(review)/moderation-videos-docs' as const;
  return '/(admin)/(review)/course-structure-approval' as const;
}

const SAMPLE_QUESTIONS = [
  {
    question: 'What is the SI unit of thermodynamic temperature?',
    options: ['Celsius', 'Fahrenheit', 'Kelvin', 'Rankine'],
    correct: 2,
    explanation: 'Kelvin is the SI base unit of temperature, with 0 K defined as absolute zero.',
  },
  {
    question: 'Which law of thermodynamics states that entropy of an isolated system never decreases?',
    options: ['Zeroth Law', 'First Law', 'Second Law', 'Third Law'],
    correct: 2,
    explanation: 'The Second Law of Thermodynamics establishes the direction of spontaneous processes via entropy.',
  },
  {
    question: 'In an isothermal process, which quantity remains constant?',
    options: ['Pressure', 'Volume', 'Temperature', 'Entropy'],
    correct: 2,
    explanation: 'Isothermal means "constant temperature" — by definition, T does not change through the process.',
  },
];

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function ContentPreviewDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id, type: rawType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const itemType = (rawType as ItemType) ?? 'test';
  const kind = queueKindFor(itemType);
  const queueIds = QUEUES[kind];
  const index = Math.max(0, queueIds.indexOf(id ?? queueIds[0]));

  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);

  const advance = () => {
    const nextId = queueIds[index + 1];
    if (nextId) {
      router.replace({ pathname: '/(admin)/(review)/content-preview-detail', params: { id: nextId, type: itemType } });
    } else {
      router.replace(originRoute(kind));
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      if (itemType === 'test') {
        await adminApproveTest(id);
      } else if (itemType === 'Videos' || itemType === 'Documents') {
        await adminApproveContent(id);
      }
      show('Approved', 'success');
      advance();
    } catch (err) {
      show('Failed to approve', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (reason.trim().length === 0 || !id) return;
    setSubmitting(true);
    try {
      if (itemType === 'test') {
        await adminRejectTest(id, reason);
      } else if (itemType === 'Videos' || itemType === 'Documents') {
        await adminRejectContent(id, reason);
      }
      setRejectOpen(false);
      setReason('');
      show('Rejected — teacher has been notified.', 'success');
      advance();
    } catch (err) {
      show('Failed to reject', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    itemType === 'test'
      ? 'Thermodynamics — Practice Set 4'
      : itemType === 'Videos'
        ? 'Laws of Thermodynamics — Explained'
        : itemType === 'Documents'
          ? 'Entropy — Chapter Notes'
          : itemType === 'Brain Hacks'
            ? 'The 2-minute recall trick'
            : itemType === 'Subject'
              ? '[new] Zoology'
              : itemType === 'Chapter'
                ? '[new] Thermodynamics'
                : '[new] First Law of Thermodynamics';

  const breadcrumb =
    itemType === 'Brain Hacks'
      ? 'Untethered — Brain Hack'
      : itemType === 'Subject'
        ? 'NEET UG'
        : itemType === 'Chapter'
          ? 'NEET UG · Physics'
          : itemType === 'Sub-chapter'
            ? 'NEET UG · Physics · Thermodynamics'
            : 'NEET UG · Physics · Thermodynamics';

  const isStructure = kind === 'structure';

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
          Review
        </Text>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
          {index + 1} of {queueIds.length} pending
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.lg },
            shadow(),
          ]}
        >
          <StatusBadge status="pending" label={itemType === 'test' ? 'Test' : itemType} />
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]}>{title}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{breadcrumb}</Text>

          <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.md }} />

          <DetailRow label="Teacher" value="Kavya Iyer" />
          <DetailRow label="Submitted" value="18 Jul 2026" />
          {itemType === 'test' ? (
            <>
              <DetailRow label="Module Type" value="Practice" />
              <DetailRow label="Questions" value="20" />
              <DetailRow label="Duration" value="30 min" />
              <DetailRow label="Marking" value="+4 / −1" />
            </>
          ) : null}
          {itemType === 'Videos' ? <DetailRow label="Duration" value="12:40" /> : null}
          {itemType === 'Documents' ? <DetailRow label="Length" value="~6 min read" /> : null}
          {itemType === 'Brain Hacks' ? <DetailRow label="Length" value="~2 min read" /> : null}
          {isStructure ? <DetailRow label="Proposed Level" value={itemType} /> : null}
        </View>

        {itemType === 'test' ? (
          <View style={{ marginTop: space.lg }}>
            <Pressable
              onPress={() => setQuestionsExpanded((v) => !v)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                shadow(),
              ]}
            >
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
                20 questions — tap to review
              </Text>
              {questionsExpanded ? (
                <CaretUp size={18} color={color('text/tertiary')} />
              ) : (
                <CaretDown size={18} color={color('text/tertiary')} />
              )}
            </Pressable>
            {questionsExpanded ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
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
                          style={[
                            type['type/body-m'],
                            { color: oi === q.correct ? color('semantic/success') : color('text/secondary') },
                          ]}
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
        ) : null}

        {itemType === 'Videos' ? (
          <View
            style={[
              styles.videoFrame,
              { backgroundColor: '#000', borderRadius: radius.lg, marginTop: space.lg },
            ]}
          >
            <Pressable onPress={() => setPlaying((v) => !v)} style={styles.videoCenter}>
              {playing ? (
                <PlayCircle size={56} color="#fff" weight="fill" />
              ) : (
                <Play size={56} color="#fff" weight="fill" />
              )}
            </Pressable>
          </View>
        ) : null}

        {itemType === 'Documents' ? (
          <View
            style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.lg }, shadow()]}
          >
            <Text style={[type['type/body-l'], { color: color('text/primary') }]}>
              Entropy quantifies the number of ways a system&apos;s energy can be distributed. For NEET,
              focus on the Second Law&apos;s statement, the direction of spontaneous processes, and how
              entropy relates to disorder at a molecular level — worked numericals rarely go beyond
              ΔS = Q/T for reversible processes at constant temperature.
            </Text>
          </View>
        ) : null}

        {itemType === 'Brain Hacks' ? (
          <View
            style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.lg }, shadow()]}
          >
            <Text style={[type['type/body-l'], { color: color('text/primary') }]}>
              Right after finishing a topic, close your notes and try to recall three things about it out
              loud, in your own words, before checking anything. Two minutes, no notes — it&apos;s the
              single fastest way to find out what you actually remember versus what just felt familiar
              while reading.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg, gap: space.sm }}>
        <PrimaryButton label="Approve" onPress={handleApprove} loading={submitting} />
        <SecondaryButton label="Reject" variant="danger" onPress={() => setRejectOpen(true)} disabled={submitting} />
      </View>

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.sheetScrim}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: color('bg/surface'), borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.lg + insets.bottom },
            ]}
          >
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Why is this being rejected?</Text>
            <InputField
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Question 4's answer key is wrong, or the video's audio cuts out."
              containerStyle={{ marginTop: space.md }}
            />
            <PrimaryButton
              label="Confirm Rejection"
              onPress={confirmReject}
              disabled={reason.trim().length === 0}
              loading={submitting}
              style={{ marginTop: space.lg }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { color, type, space } = useTheme();
  return (
    <View style={[styles.row, { marginTop: space.xs }]}>
      <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]}>{label}</Text>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  videoFrame: { height: 200, overflow: 'hidden' },
  videoCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

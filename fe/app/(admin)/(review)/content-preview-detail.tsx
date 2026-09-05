import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, Info, WarningCircle } from 'phosphor-react-native';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  EmptyState,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SkeletonBlock,
  StatusBadge,
  TextButton,
  useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import {
  adminApproveContent,
  adminRejectContent,
  adminApproveTest,
  adminRejectTest,
  adminGetContent,
  adminGetTest,
} from '@/src/api/admin';
import type { Question } from '@/src/api/tests';

type ItemType = 'test' | 'Videos' | 'Documents' | 'Brain Hacks';

const QUESTION_OPTIONS: { letter: string; key: 'option_a' | 'option_b' | 'option_c' | 'option_d' }[] = [
  { letter: 'A', key: 'option_a' },
  { letter: 'B', key: 'option_b' },
  { letter: 'C', key: 'option_c' },
  { letter: 'D', key: 'option_d' },
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
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    title?: string;
    breadcrumb?: string;
    teacher?: string;
    submitted?: string;
    moduleType?: string;
    questionCount?: string;
    durationMinutes?: string;
    marksCorrect?: string;
    marksWrong?: string;
  }>();
  const { id } = params;
  const itemType = (params.type as ItemType) ?? 'test';

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  const loadPreview = useCallback(() => {
    if (!id) {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(false);
    const run =
      itemType === 'test'
        ? adminGetTest(id).then((res) => setQuestions(res.questions))
        : itemType === 'Videos' || itemType === 'Documents'
          ? adminGetContent(id).then((res) => setPreviewUrl(res.url))
          : Promise.resolve();
    run.catch(() => setPreviewError(true)).finally(() => setPreviewLoading(false));
  }, [id, itemType]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const videoPlayer = useVideoPlayer(itemType === 'Videos' && previewUrl ? previewUrl : null);

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
      router.back();
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
      router.back();
    } catch (err) {
      show('Failed to reject', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const title = params.title || 'Untitled';
  const breadcrumb = params.breadcrumb || '';
  const teacher = params.teacher || 'Unknown';
  const submitted = params.submitted || 'Unknown';

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
          {breadcrumb ? (
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{breadcrumb}</Text>
          ) : null}

          <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.md }} />

          <DetailRow label="Teacher" value={teacher} />
          <DetailRow label="Submitted" value={submitted} />
          {itemType === 'test' ? (
            <>
              {params.moduleType ? <DetailRow label="Module Type" value={params.moduleType} /> : null}
              <DetailRow label="Questions" value={params.questionCount ?? '0'} />
              {params.durationMinutes ? <DetailRow label="Duration" value={`${params.durationMinutes} min`} /> : null}
              {params.marksCorrect && params.marksWrong ? (
                <DetailRow label="Marking" value={`+${params.marksCorrect} / ${params.marksWrong}`} />
              ) : null}
            </>
          ) : null}
        </View>

        {itemType === 'Brain Hacks' ? (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <Info size={18} color={color('text/tertiary')} />
            <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1, marginLeft: space.sm }]}>
              Brain hack content preview isn’t available in this view yet.
            </Text>
          </View>
        ) : previewLoading ? (
          <SkeletonBlock height={itemType === 'Videos' ? 200 : 120} radius={radius.md} style={{ marginTop: space.lg }} />
        ) : previewError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load the preview"
            description="Something went wrong fetching this item's content."
            action={<TextButton label="Retry" onPress={loadPreview} />}
            style={{ marginTop: space.lg }}
          />
        ) : itemType === 'test' ? (
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              QUESTIONS ({questions.length})
            </Text>
            {questions.length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No questions added yet.</Text>
            ) : (
              [...questions]
                .sort((a, b) => a.order_index - b.order_index)
                .map((q, qi) => (
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
                  </View>
                ))
            )}
          </View>
        ) : itemType === 'Videos' ? (
          previewUrl ? (
            <VideoView
              player={videoPlayer}
              style={[styles.videoPreview, { borderRadius: radius.md, marginTop: space.lg }]}
              contentFit="contain"
              nativeControls
            />
          ) : (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
              ]}
            >
              <Info size={18} color={color('text/tertiary')} />
              <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1, marginLeft: space.sm }]}>
                Video isn’t ready to preview yet — it may still be processing.
              </Text>
            </View>
          )
        ) : previewUrl ? (
          <WebView
            source={{ uri: previewUrl }}
            style={[styles.docPreview, { borderRadius: radius.md, marginTop: space.lg }]}
          />
        ) : (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <Info size={18} color={color('text/tertiary')} />
            <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1, marginLeft: space.sm }]}>
              No document file available to preview.
            </Text>
          </View>
        )}

        {__DEV__ && (itemType === 'Videos' || itemType === 'Documents') ? (
          <Text
            selectable
            style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}
          >
            DEBUG url={previewUrl || '(none)'}
          </Text>
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
  noticeBox: { flexDirection: 'row', alignItems: 'flex-start' },
  videoPreview: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  docPreview: { width: '100%', height: 400 },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

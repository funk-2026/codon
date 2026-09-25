import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, PencilSimpleLine, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { approveCorrection, listAdminCorrections, rejectCorrection, type CorrectionQueueRow } from '@/src/api/moderation';
import { QuestionPreviewCard, RichContent, type MediaMap } from '@/src/rich';

const FIELDS: { key: string; label: string; rich?: boolean }[] = [
  { key: 'question_text', label: 'Question', rich: true },
  { key: 'option_a', label: 'Option A', rich: true }, { key: 'option_b', label: 'Option B', rich: true },
  { key: 'option_c', label: 'Option C', rich: true }, { key: 'option_d', label: 'Option D', rich: true },
  { key: 'correct_option', label: 'Correct answer' }, { key: 'explanation', label: 'Explanation', rich: true },
  { key: 'difficulty', label: 'Difficulty' },
];

export default function CorrectionsQueueRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<CorrectionQueueRow[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rejecting, setRejecting] = useState<CorrectionQueueRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const r = await listAdminCorrections({ status, limit: 20 });
      if (my !== seq.current) return;
      setRows(r.items);
      setMedia(r.media ?? {});
      setCursor(r.next_cursor);
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const approve = async (r: CorrectionQueueRow) => {
    setBusy(r.id);
    try {
      await approveCorrection(r.id);
      setRows((p) => p.filter((x) => x.id !== r.id));
      show('Approved and applied. Open reports on this question were resolved.', 'success');
    } catch (e) {
      show(e instanceof ApiError && e.status === 409 ? 'This was already reviewed or the question changed. Refreshing…' : 'Couldn’t approve. Try again.', 'error');
      if (e instanceof ApiError && e.status === 409) void load();
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try {
      await rejectCorrection(rejecting.id, reason.trim());
      setRows((p) => p.filter((x) => x.id !== rejecting.id));
      setRejecting(null);
      setReason('');
    } catch {
      show('Couldn’t reject. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const chip = (on: boolean) => ({
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Corrections</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.sm }}>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} accessibilityRole="button" accessibilityState={{ selected: status === s }} style={chip(status === s)}>
            <Text style={[type['type/caption'], { color: status === s ? color('accent/default') : color('text/secondary'), textTransform: 'capitalize' }]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1].map((i) => <SkeletonBlock key={i} height={260} radius={radius.lg} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load corrections" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<PencilSimpleLine size={32} color={color('text/tertiary')} />} title={status === 'pending' ? 'Nothing waiting for review' : 'Nothing here'} description={status === 'pending' ? 'Corrections that teachers propose for live questions appear here.' : 'No corrections with this status.'} />
        ) : (
          rows.map((r) => {
            const cur = (r.question ?? {}) as Record<string, any>;
            const prop = r.proposed as Record<string, any>;
            const changed = FIELDS.filter((f) => prop[f.key] !== undefined && String(prop[f.key] ?? '') !== String(cur[f.key] ?? ''));
            return (
              <View key={r.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>REASON</Text>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{r.reason}</Text>
                {r.rescore ? <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Re-scores past attempts if the answer changed.</Text> : null}
                {changed.length === 0 ? (
                  <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Only metadata changes (no wording or answer changes).</Text>
                ) : (
                  changed.map((f) => (
                    <View key={f.key} style={{ gap: 4 }}>
                      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{f.label.toUpperCase()}</Text>
                      <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.sm, padding: space.sm }}>
                        <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Now</Text>
                        {f.rich ? <RichContent value={String(cur[f.key] ?? '')} format={cur.content_format} media={media} variant="option" /> : <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{String(cur[f.key] ?? '—')}</Text>}
                      </View>
                      <View style={{ backgroundColor: color('semantic/success-tint'), borderRadius: radius.sm, padding: space.sm }}>
                        <Text style={[type['type/caption'], { color: color('semantic/success') }]}>Proposed</Text>
                        {f.rich ? <RichContent value={String(prop[f.key] ?? '')} format="rich_v1" media={media} variant="option" /> : <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{String(prop[f.key] ?? '—')}</Text>}
                      </View>
                    </View>
                  ))
                )}
                {status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                    <View style={{ flex: 1 }}><SecondaryButton label="Reject" onPress={() => { setRejecting(r); setReason(''); }} disabled={busy === r.id} /></View>
                    <View style={{ flex: 1 }}><PrimaryButton label="Approve" onPress={() => approve(r)} loading={busy === r.id} /></View>
                  </View>
                ) : r.review_note ? (
                  <Text style={[type["type/caption"], { color: color("text/tertiary") }]}>{r.review_note}</Text>
                ) : null}
              </View>
            );
          })
        )}
        {cursor ? <SecondaryButton label="Load more" onPress={async () => { const r = await listAdminCorrections({ status, limit: 20, cursor }).catch(() => null); if (r) { setRows((p) => [...p, ...r.items]); setMedia((m) => ({ ...m, ...(r.media ?? {}) })); setCursor(r.next_cursor); } }} /> : null}
      </ScrollView>

      <BottomSheet visible={!!rejecting} onClose={() => setRejecting(null)} title="Reject this correction" dismissable={!busy}>
        <View style={{ gap: space.md }}>
          <InputField label="Reason (sent to the teacher)" value={reason} onChangeText={setReason} multiline />
          <PrimaryButton label="Reject" onPress={reject} loading={!!busy} disabled={reason.trim().length < 3} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, FlagBanner, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useReportReasons } from '@/src/config/AppConfigContext';
import { ApiError } from '@/src/api/client';
import { dismissReport, listAdminReports, listTeacherReports, resolveReport, type ReportInboxRow } from '@/src/api/moderation';
import type { ReportStatus } from '@/src/api/reports';
import { QuestionPreviewCard, type MediaMap } from '@/src/rich';

const STATUSES: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'fixed', label: 'Fixed' }, { key: 'no_change', label: 'No change' }, { key: 'dismissed', label: 'Dismissed' }, { key: 'all', label: 'All' },
];

/**
 * One inbox for question reports. Teachers see reports on their own content;
 * admins see everything and can dismiss (FE-3.4/3.5). Resolving tells the
 * reporter what happened.
 */
export function ReportsInbox({ role }: { role: 'teacher' | 'admin' }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const reasons = useReportReasons();

  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const [reason, setReason] = useState<string | undefined>();
  const [rows, setRows] = useState<ReportInboxRow[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState<{ row: ReportInboxRow; outcome: 'fixed' | 'no_change' | 'dismissed' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const fetcher = role === 'admin' ? listAdminReports : listTeacherReports;

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const r = await fetcher({ status, reason, limit: 20 });
      if (my !== seq.current) return;
      setRows(r.items);
      setMedia(r.media ?? {});
      setCursor(r.next_cursor);
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [status, reason, fetcher]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const r = await fetcher({ status, reason, limit: 20, cursor });
      setRows((p) => [...p, ...r.items]);
      setMedia((m) => ({ ...m, ...(r.media ?? {}) }));
      setCursor(r.next_cursor);
    } catch {
      show('Couldn’t load more.', 'error');
    } finally {
      setMore(false);
    }
  };

  const submit = async () => {
    if (!acting) return;
    setBusy(true);
    try {
      if (role === 'admin' && acting.outcome === 'dismissed') await dismissReport(acting.row.id, note.trim());
      else await resolveReport(acting.row.id, acting.outcome, note.trim());
      setRows((p) => (status === 'open' ? p.filter((r) => r.id !== acting.row.id) : p.map((r) => (r.id === acting.row.id ? { ...r, status: acting.outcome } : r))));
      setActing(null);
      setNote('');
      show('Report resolved — the student will be notified.', 'success');
    } catch (e) {
      show(e instanceof ApiError && e.code === 'already_resolved' ? 'Someone already resolved this report.' : 'Couldn’t update the report. Try again.', 'error');
      if (e instanceof ApiError && e.code === 'already_resolved') void load();
    } finally {
      setBusy(false);
    }
  };

  const label = (k: string) => reasons.find((r) => r.key === k)?.label ?? k.replace(/_/g, ' ');
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
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Question reports</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        {STATUSES.map((s) => (
          <Pressable key={s.key} onPress={() => setStatus(s.key)} accessibilityRole="button" accessibilityState={{ selected: status === s.key }} style={chip(status === s.key)}>
            <Text style={[type['type/caption'], { color: status === s.key ? color('accent/default') : color('text/secondary') }]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {reasons.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.xs }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
          {reasons.map((r) => (
            <Pressable key={r.key} onPress={() => setReason((cur) => (cur === r.key ? undefined : r.key))} accessibilityRole="button" accessibilityState={{ selected: reason === r.key }} style={chip(reason === r.key)}>
              <Text style={[type['type/caption'], { color: reason === r.key ? color('accent/default') : color('text/secondary') }]}>{r.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={200} radius={radius.lg} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load reports" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<FlagBanner size={32} color={color('text/tertiary')} />} title={status === 'open' ? 'No open reports' : 'Nothing here'} description={status === 'open' ? 'When students flag a problem with one of your questions, it shows up here.' : 'No reports match this filter.'} />
        ) : (
          <>
            {rows.map((r) => (
              <View key={r.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Text style={[type['type/body-m-medium'], { color: color('semantic/danger'), flex: 1 }]}>{label(String(r.reason))}</Text>
                  {r.open_reports_for_item > 1 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{r.open_reports_for_item} reports on this question</Text> : null}
                </View>
                {r.note ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>“{r.note}”</Text> : null}
                {r.question ? <QuestionPreviewCard q={r.question} index={0} media={media} /> : null}
                {r.status === 'open' ? (
                  <View style={{ gap: space.xs }}>
                    {r.test_id || r.question?.test_id ? (
                      <SecondaryButton label="Open question" onPress={() => router.push({ pathname: '/(teacher)/question-editor', params: { testId: (r.test_id ?? r.question?.test_id)!, questionId: r.item_id } })} />
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
                      <TextButton label="Mark fixed" onPress={() => { setActing({ row: r, outcome: 'fixed' }); setNote(''); }} />
                      <TextButton label="No change needed" onPress={() => { setActing({ row: r, outcome: 'no_change' }); setNote(''); }} />
                      <TextButton label="Dismiss" onPress={() => { setActing({ row: r, outcome: 'dismissed' }); setNote(''); }} />
                    </View>
                  </View>
                ) : (
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{r.status.replace('_', ' ')}{r.resolution_note ? ` — ${r.resolution_note}` : ''}</Text>
                )}
              </View>
            ))}
            {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!acting} onClose={() => setActing(null)} title={acting?.outcome === 'fixed' ? 'Mark as fixed' : acting?.outcome === 'no_change' ? 'No change needed' : 'Dismiss report'} dismissable={!busy}>
        <View style={{ gap: space.md }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>The student who reported this is notified. Add a short note to tell them what happened (optional).</Text>
          <InputField label="Note to the student" value={note} onChangeText={setNote} multiline placeholder={acting?.outcome === 'fixed' ? 'e.g. Corrected the answer key — thanks!' : 'e.g. The answer is correct because…'} />
          <PrimaryButton label="Confirm" onPress={submit} loading={busy} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

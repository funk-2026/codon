import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlagBanner, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, Chip, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useReportReasons } from '@/src/config/AppConfigContext';
import { ApiError } from '@/src/api/client';
import { dismissReport, listAdminReports, listTeacherReports, resolveReport, type ReportInboxRow } from '@/src/api/moderation';
import type { ReportStatus } from '@/src/api/reports';
import { QuestionPreviewCard } from '@/src/rich';
import { ROUTES } from '@/src/navigation/routes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsersPage } from '@/src/api/admin';
import { reassignReport } from '@/src/api/adminOps';
import { useCursorList } from '@/src/queries/useCursorList';
import { EmbedRoot } from '@/src/teacher/EmbedRoot';

const STATUSES: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'fixed', label: 'Fixed' }, { key: 'no_change', label: 'No change' }, { key: 'dismissed', label: 'Dismissed' }, { key: 'all', label: 'All' },
];

/**
 * One inbox for question reports. Teachers see reports on their own content;
 * admins see everything and can dismiss (FE-3.4/3.5). Resolving tells the
 * reporter what happened.
 */
export function ReportsInbox({ role, embedded }: { role: 'teacher' | 'admin'; embedded?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const reasons = useReportReasons();
  const queryClient = useQueryClient();
  const [reassigning, setReassigning] = useState<ReportInboxRow | null>(null);
  const teachers = useQuery({ queryKey: ['admin', 'teachers-pick'], queryFn: () => listUsersPage({ role: 'teacher', limit: 100 }).then((r) => r.users), enabled: role === 'admin' && !!reassigning });

  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const [reason, setReason] = useState<string | undefined>();
  const [acting, setActing] = useState<{ row: ReportInboxRow; outcome: 'fixed' | 'no_change' | 'dismissed' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fetcher = role === 'admin' ? listAdminReports : listTeacherReports;
  const list = useCursorList<ReportInboxRow, Awaited<ReturnType<typeof listAdminReports>>>(
    ['reports-inbox', role, status, reason],
    (cursor) => fetcher({ status, reason, limit: 20, cursor }),
    (r) => r.items,
  );
  const { rows, media, loading, error, setRows, load, more } = list;
  const cursor = list.hasMore ? 'more' : null;
  const loadMore = () => void list.loadMore().then((r) => { if (r.isError) show('Couldn’t load more.', 'error'); });



  const submit = async () => {
    if (!acting) return;
    setBusy(true);
    try {
      if (role === 'admin' && acting.outcome === 'dismissed') await dismissReport(acting.row.id, note.trim());
      else await resolveReport(acting.row.id, acting.outcome, note.trim());
      setRows((p) => (status === 'open' ? p.filter((r) => r.id !== acting.row.id) : p.map((r) => (r.id === acting.row.id ? { ...r, status: acting.outcome } : r))));
      // The red count on the Reports segment and on Home comes from this query; it must drop now, not on the next focus.
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inbox'] });
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
  return (
    <EmbedRoot embedded={embedded}>
      {embedded ? null : <ScreenHeader title="Question reports" />}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        {STATUSES.map((s) => (
          <Chip key={s.key} size="sm" label={s.label} selected={status === s.key} onPress={() => setStatus(s.key)} />
        ))}
      </ScrollView>
      {reasons.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: space.xs }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
          {reasons.map((r) => (
            <Chip key={r.key} size="sm" label={r.label} selected={reason === r.key} onPress={() => setReason((cur) => (cur === r.key ? undefined : r.key))} />
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
                      <SecondaryButton label="Open question" onPress={() => router.push({ pathname: ROUTES.teacher.questionEditor, params: { testId: (r.test_id ?? r.question?.test_id)!, questionId: r.item_id } })} />
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
                      <TextButton label="Mark fixed" onPress={() => { setActing({ row: r, outcome: 'fixed' }); setNote(''); }} />
                      <TextButton label="No change needed" onPress={() => { setActing({ row: r, outcome: 'no_change' }); setNote(''); }} />
                      <TextButton label="Dismiss" onPress={() => { setActing({ row: r, outcome: 'dismissed' }); setNote(''); }} />
                      {role === 'admin' ? <TextButton label="Reassign" onPress={() => setReassigning(r)} /> : null}
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

      <BottomSheet visible={!!reassigning} onClose={() => setReassigning(null)} title="Reassign to a teacher" dismissable={!busy}>
        <View style={{ gap: space.xs, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          {teachers.isPending ? (
            <SkeletonBlock height={48} radius={radius.md} />
          ) : (teachers.data ?? []).length === 0 ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>There are no teachers to assign this to.</Text>
          ) : (
            (teachers.data ?? []).map((t) => (
              <TextButton
                key={t.id}
                label={t.name || t.phone_number}
                disabled={busy}
                onPress={async () => {
                  if (!reassigning) return;
                  setBusy(true);
                  try {
                    await reassignReport(reassigning.id, t.id);
                    show(`Assigned to ${t.name || t.phone_number}`, 'success');
                    setReassigning(null);
                  } catch {
                    show('Couldn’t reassign. Try again.', 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={!!acting} onClose={() => setActing(null)} title={acting?.outcome === 'fixed' ? 'Mark as fixed' : acting?.outcome === 'no_change' ? 'No change needed' : 'Dismiss report'} dismissable={!busy}>
        <View style={{ gap: space.md }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>The student who reported this is notified. Add a short note to tell them what happened (optional).</Text>
          <InputField label="Note to the student" value={note} onChangeText={setNote} multiline placeholder={acting?.outcome === 'fixed' ? 'e.g. Corrected the answer key — thanks!' : 'e.g. The answer is correct because…'} />
          <PrimaryButton label="Confirm" onPress={submit} loading={busy} />
        </View>
      </BottomSheet>
    </EmbedRoot>
  );
}

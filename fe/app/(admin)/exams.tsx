import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Timer, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { adminExtendExam, adminListExams, adminRescoreExam, adminSetResultsAt, type AdminExam, type RescoreResult } from '@/src/api/exams';
import { parseSchedule, scheduleError, toScheduleInputs } from '@/src/teacher/schedule';
import { KIND_LABEL } from '@/src/exam/logic';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { shadow } from '@/src/theme/elevation';

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

/** Exam day control room: what is live, who is in, extend after an outage, move results, recompute after a key fix. */
export default function AdminExamsRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'exams'], queryFn: adminListExams, refetchInterval: 15_000 });
  useRefetchOnFocus(() => void q.refetch());

  const [extend, setExtend] = useState<AdminExam | null>(null);
  const [minutes, setMinutes] = useState('10');
  const [results, setResults] = useState<AdminExam | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [rescore, setRescore] = useState<{ exam: AdminExam; preview?: RescoreResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

  const doExtend = useMutation({
    mutationFn: () => adminExtendExam(extend!.id, Number(minutes)),
    onSuccess: () => { show(`Extended by ${minutes} minutes. Students were told.`, 'success'); setExtend(null); refresh(); },
    onError: fail,
  });
  const doResults = useMutation({
    mutationFn: () => adminSetResultsAt(results!.id, parseSchedule(date, time)!.toISOString()),
    onSuccess: () => { show('Results time saved', 'success'); setResults(null); refresh(); },
    onError: fail,
  });
  const preview = useMutation({
    mutationFn: (e: AdminExam) => adminRescoreExam(e.id, true),
    onSuccess: (r, e) => setRescore({ exam: e, preview: r }),
    onError: fail,
  });
  const apply = useMutation({
    mutationFn: () => adminRescoreExam(rescore!.exam.id, false),
    onSuccess: (r) => { show(`Recomputed. ${r.changed} score${r.changed === 1 ? '' : 's'} changed.`, 'success'); setRescore(null); refresh(); },
    onError: fail,
  });

  const schedErr = results && date ? scheduleError(date, time) : null;
  const tone = (p: string) => (p === 'live' ? 'semantic/success' : p === 'upcoming' ? 'accent/default' : 'text/tertiary');

  return (
    <Screen>
      <ScreenHeader title="Exams" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {q.isPending ? (
          [0, 1].map((i) => <SkeletonBlock key={i} height={170} radius={radius.lg} />)
        ) : q.isError ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load exams" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
        ) : q.data.exams.length === 0 ? (
          <EmptyState icon={<Timer size={32} color={color('text/tertiary')} />} title="No live exams" description="Live tests teachers set up (once approved) appear here." />
        ) : (
          q.data.exams.map((e) => (
            <View key={e.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs }, shadow()]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type['type/overline'], { color: color(tone(e.phase)), flex: 1 }]}>{e.phase.toUpperCase()}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{KIND_LABEL[e.kind]}</Text>
              </View>
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>{e.title}</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                {when(e.opens_at)} to {when(e.ends_at)}{e.extra_minutes ? ` (+${e.extra_minutes} min)` : ''}
              </Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                Results {e.results_released ? 'are out' : `open ${when(e.results_at)}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.md, marginVertical: space.xs }}>
                {([['registered', e.registered], ['started', e.started], ['in progress', e.in_progress], ['submitted', e.submitted]] as const).map(([l, n]) => (
                  <View key={l} style={{ flex: 1 }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>{n}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {e.phase !== 'ended' ? <SecondaryButton label="Extend" onPress={() => { setError(null); setMinutes('10'); setExtend(e); }} /> : null}
                <SecondaryButton label="Results time" onPress={() => { setError(null); const i = toScheduleInputs(e.results_at); setDate(i.date); setTime(i.time); setResults(e); }} />
                {e.submitted > 0 ? <SecondaryButton label="Recompute scores" onPress={() => { setError(null); preview.mutate(e); }} loading={preview.isPending && preview.variables?.id === e.id} /> : null}
              </View>
            </View>
          ))
        )}
        {error && !extend && !results && !rescore ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
      </ScrollView>

      <BottomSheet visible={!!extend} onClose={() => setExtend(null)} title="Extend the exam" dismissable={!doExtend.isPending}>
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Adds time for everyone: late entry and the end both move, attempts in progress get the minutes, and registered students are notified.</Text>
          <InputField label="Minutes (1 to 120)" value={minutes} onChangeText={(t: string) => setMinutes(t.replace(/\D/g, ''))} keyboardType="number-pad" />
          {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
          <PrimaryButton label="Extend" onPress={() => doExtend.mutate()} loading={doExtend.isPending} disabled={!(Number(minutes) >= 1 && Number(minutes) <= 120)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!results} onClose={() => setResults(null)} title="When results open" dismissable={!doResults.isPending}>
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>It cannot be earlier than 15 minutes after the exam ends. Students are told when results open.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1.4 }}><InputField label="Date" value={date} onChangeText={setDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 1 }}><InputField label="Time (24h)" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
          </View>
          {schedErr ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{schedErr}</Text> : null}
          {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
          <PrimaryButton label="Save" onPress={() => doResults.mutate()} loading={doResults.isPending} disabled={!parseSchedule(date, time)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!rescore} onClose={() => setRescore(null)} title="Recompute scores" dismissable={!apply.isPending}>
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{rescore?.exam.title}</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            {rescore?.preview
              ? rescore.preview.changed === 0
                ? `Checked ${rescore.preview.attempts} attempts against the current answer key. No score changes.`
                : `Against the current answer key, ${rescore.preview.changed} of ${rescore.preview.attempts} scores change (up to +${rescore.preview.max_rise}, down to −${rescore.preview.max_drop}). Those students are told.`
              : ''}
          </Text>
          {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
          {rescore?.preview && rescore.preview.changed > 0 ? <PrimaryButton label={`Apply to ${rescore.preview.changed} scores`} onPress={() => apply.mutate()} loading={apply.isPending} /> : null}
          <TextButton label="Close" onPress={() => setRescore(null)} disabled={apply.isPending} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'phosphor-react-native';
import { ConfirmDialog, EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { deleteCustomTest, getCustomTest } from '@/src/api/customTests';
import { ROUTES } from '@/src/navigation/routes';
import { CodeCard } from '@/src/custom/CodeCard';
import { shadow } from '@/src/theme/elevation';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The Start screen of a made module: what was selected, SOLVE or Resume, its code to copy and share, and Discard. */
export default function CustomStartRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['custom-module', id], queryFn: () => getCustomTest(String(id)), enabled: !!id });
  const [confirm, setConfirm] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteCustomTest(String(id)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['custom-challenges'] }); setConfirm(false); router.replace({ pathname: ROUTES.student.practice, params: { kind: 'custom' } }); },
    onError: () => show('Couldn’t discard it. Try again.', 'error'),
  });

  const d = q.data;
  const code = (d?.test as { share_code?: string } | undefined)?.share_code ?? '';
  const mine = d?.attempts ?? [];
  const inProgress = mine.some((a) => a.status === 'in_progress');
  const solved = mine.some((a) => a.status === 'submitted');
  const bp = d?.blueprint;
  const created = d?.test.created_at ? new Date(d.test.created_at) : null;
  const ticks: string[] = bp ? [
    `${d?.test.total_questions} MCQs served`,
    bp.filters.subject_ids?.length ? `Subjects: ${bp.filters.subject_ids.length} chosen` : 'Subjects: All subjects used',
    bp.filters.tag_ids?.length ? `Tags: ${bp.filters.tag_ids.length} used` : 'Tags: All',
    `Difficulty: ${bp.difficulty_mix ? 'Custom' : bp.filters.difficulty?.length ? bp.filters.difficulty[0][0].toUpperCase() + bp.filters.difficulty[0].slice(1) : 'All'}`,
    `${bp.mode === 'tutor' ? 'Regular' : 'Exam'} mode`,
    bp.timing.timed ? `Timing: ${bp.timing.duration_minutes} minutes` : 'Timing: Untimed',
    `Marking: ${bp.marking.preset === 'no_negative' ? 'No negative' : bp.marking.preset === 'custom' ? `+${bp.marking.correct} / ${bp.marking.wrong}` : 'NEET +4 / −1'}`,
  ] : [];

  return (
    <Screen>
      <ScreenHeader title="Start" onBack={() => router.replace({ pathname: ROUTES.student.practice, params: { kind: 'custom' } })} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }}>
        {q.isPending ? <SkeletonBlock height={220} radius={radius.lg} /> : !d ? (
          <EmptyState title="This module isn’t available" description="It may have been discarded." action={<TextButton label="Back" onPress={() => router.back()} />} />
        ) : (
          <>
            <View>
              <Text style={[type['type/h1'], { color: color('text/primary') }]}>{d.test.title}</Text>
              {created ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Created {created.getDate()} {MON[created.getMonth()]} {created.getFullYear()}</Text> : null}
            </View>
            <View style={{ gap: space.xs }}>
              {ticks.map((t) => (
                <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <CheckCircle size={20} color={color('semantic/success')} weight="fill" />
                  <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{t}</Text>
                </View>
              ))}
            </View>
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }, shadow()]}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h2'], { color: color('text/primary') }]}>{d.test.total_questions} MCQs</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{solved ? 'You have solved it. Review it from the result.' : inProgress ? 'Pick up where you left off' : 'Solve now'}</Text>
              </View>
              <View style={{ width: 130 }}>
                {solved && !inProgress ? (
                  <PrimaryButton label="REVIEW" onPress={() => { const a = mine.find((x) => x.status === 'submitted'); if (a) router.push({ pathname: ROUTES.student.testResult, params: { id: a.id, fromHistory: '1' } }); }} />
                ) : (
                  <PrimaryButton label={inProgress ? 'RESUME' : 'SOLVE'} onPress={() => router.push({ pathname: ROUTES.student.testPreStart, params: { id: d.test.id } })} />
                )}
              </View>
            </View>
            <TextButton label="Discard and create a new Custom Module" onPress={() => setConfirm(true)} />
            {code ? <CodeCard code={code} /> : null}
          </>
        )}
      </ScrollView>
      <ConfirmDialog visible={confirm} title="Discard this module?" message="If you discard this custom module, you will not be able to attempt it again in the future." confirmLabel="Discard" cancelLabel="Keep it" tone="danger" loading={del.isPending} onConfirm={() => del.mutate()} onCancel={() => setConfirm(false)} />
    </Screen>
  );
}

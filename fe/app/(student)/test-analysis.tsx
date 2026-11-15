import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChartBar, Lock, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { getAnalysis, type SectionStat } from '@/src/api/exams';
import { formatClock } from '@/src/attempt/logic';
import { shadow } from '@/src/theme/elevation';
import { ROUTES } from '@/src/navigation/routes';

const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** Where the marks came from and went: per section, time, negative marking, and how you compare with the cohort. */
export default function TestAnalysisRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['analysis', id], queryFn: () => getAnalysis(id as string), enabled: !!id, retry: false });
  const pending = q.error instanceof ApiError && q.error.code === 'results_pending';

  const totalNeg = (q.data?.sections ?? []).reduce((a, s) => a + s.negative, 0);
  const totalSecs = (q.data?.sections ?? []).reduce((a, s) => a + s.seconds, 0);

  return (
    <Screen>
      <ScreenHeader title="Analysis" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={120} radius={radius.lg} />)
        ) : pending ? (
          <EmptyState icon={<Lock size={32} color={color('text/tertiary')} />} title="Not out yet" description="The analysis opens when results are released." />
        ) : q.isError || !q.data ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load the analysis" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
        ) : q.data.sections.length === 0 ? (
          <EmptyState icon={<ChartBar size={32} color={color('text/tertiary')} />} title="Nothing to analyse" description="This attempt has no answers recorded." />
        ) : (
          <>
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs }, shadow()]}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>THE SHORT VERSION</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
                {totalNeg > 0 ? `Wrong answers cost you ${n(totalNeg)} marks. ` : 'No marks lost to negative marking. '}
                {totalSecs > 0 ? `You spent ${formatClock(totalSecs)} on answered questions. ` : ''}
                {q.data.hurried.length > 0 ? `${q.data.hurried.length} wrong answer${q.data.hurried.length === 1 ? ' was' : 's were'} given in under 20 seconds, slow down on those. ` : ''}
                {q.data.leave_count > 0 ? `You left the app ${q.data.leave_count} time${q.data.leave_count === 1 ? '' : 's'}.` : ''}
              </Text>
              {q.data.cohort ? (
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                  {q.data.cohort.total} students: average {n(q.data.cohort.avg_score)}, best {n(q.data.cohort.top_score)}.
                </Text>
              ) : null}
            </View>

            {q.data.sections.map((s) => <SectionCard key={s.name} s={s} />)}

            {q.data.hurried.length > 0 ? (
              <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs }, shadow()]}>
                <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HURRIED, AND WRONG</Text>
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                  Questions {q.data.hurried.map((h) => h.position).join(', ')} were answered in under 20 seconds and were wrong.
                </Text>
              </View>
            ) : null}

            <PrimaryButton label="Review the answers" onPress={() => router.push({ pathname: ROUTES.student.testReview, params: { id } })} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionCard({ s }: { s: SectionStat }) {
  const { color, type, space, radius } = useTheme();
  const bar = (v: number, max: number, tone: string) => (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
      <View style={{ width: `${Math.max(0, Math.min(100, max > 0 ? (v / max) * 100 : 0))}%`, height: 6, borderRadius: 3, backgroundColor: tone }} />
    </View>
  );
  const attempted = s.correct + s.wrong;
  return (
    <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs }, shadow()]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>{n(s.marks)}</Text>
      </View>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
        {s.correct} correct · {s.wrong} wrong · {s.skipped} skipped{attempted > 0 ? ` · ${Math.round((s.correct / attempted) * 100)}% accuracy` : ''}
      </Text>
      {bar(s.correct, s.total, color('semantic/success'))}
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
        {s.negative > 0 ? `${n(s.negative)} marks lost to wrong answers · ` : ''}{formatClock(s.seconds)} spent
        {s.cohort_avg != null ? ` · class average ${n(s.cohort_avg)}${s.cohort_top != null ? `, best ${n(s.cohort_top)}` : ''}` : ''}
      </Text>
    </View>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CaretUp, ChartLineUp, Trophy } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, PrimaryButton, Screen, ScreenHeader, SegmentedControl, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { DailyLineChart } from '@/src/home/DailyLineChart';
import { getGrandAnalysis } from '@/src/api/exams';
import { analysisUnlocked, chapterStats, subjectStats, windowed, type TrendWindow } from '@/src/exam/testsTabs';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** My Grand Test performance analysis. Opens at two Grand Tests: a trend, then each subject and its chapters. */
export default function GrandAnalysisRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ['grand-analysis'], queryFn: getGrandAnalysis });
  const [win, setWin] = useState<TrendWindow>('all');
  const [sel, setSel] = useState<number | null>(null);
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  const all = useMemo(() => q.data?.attempts ?? [], [q.data]);
  const rows = useMemo(() => windowed(all, win), [all, win]);
  const points = rows.map((a) => ({ label: shortDate(a.at), value: Math.max(0, Math.round(a.percent)) }));
  const subjects = useMemo(() => subjectStats(rows), [rows]);
  const picked = sel != null ? rows[sel] : null;
  const unlocked = analysisUnlocked(all.length, q.data?.min_attempts);

  return (
    <Screen>
      <ScreenHeader title="My Grand Test performance" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          <SkeletonBlock height={220} radius={radius.lg} />
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : !unlocked ? (
          <EmptyState
            icon={<Trophy size={32} color={color('text/tertiary')} />}
            title="Attempt 2 Grand Tests to unlock"
            description={`You have attempted ${all.length}. The analysis compares your Grand Tests, so it needs at least two with results out.`}
            action={<PrimaryButton label="Go to Grand Tests" onPress={() => router.back()} />}
          />
        ) : (
          <>
            <SegmentedControl options={[{ key: 'all' as const, label: 'All GTs' }, { key: 'last20' as const, label: 'Last 20' }]} value={win} onChange={(w) => { setWin(w); setSel(null); }} />
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm }, shadow()]}>
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>Score in each Grand Test (%)</Text>
              <DailyLineChart points={points} selected={sel} onSelect={setSel} unit="percent" />
              {picked ? (
                <View style={{ gap: 2 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{picked.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                    {picked.score} / {picked.total_marks} · {Math.round(picked.percent)}%
                    {picked.rank ? ` · Rank ${picked.rank} of ${picked.cohort}` : ''}
                    {picked.percentile != null ? ` · ${Math.round(picked.percentile)} percentile` : ''}
                  </Text>
                  <Pressable onPress={() => router.push({ pathname: ROUTES.student.testResult, params: { id: picked.attempt_id, fromHistory: '1' } })} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Open result →</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Tap a point to see that test.</Text>
              )}
            </View>

            {subjects.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {[{ label: 'Strongest', s: subjects[0], tone: 'semantic/success' as const }, { label: 'Weakest', s: subjects[subjects.length - 1], tone: 'semantic/danger' as const }].map(({ label, s, tone }) => (
                    <View key={label} style={[{ flex: 1, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: 2 }, shadow()]}>
                      <Text style={[type['type/overline'], { color: color(tone) }]}>{label.toUpperCase()}</Text>
                      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{s.name}</Text>
                      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{s.percent}%{s.percentile != null ? ` · ${s.percentile} percentile` : ''}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>SUBJECTS. TAP FOR CHAPTERS</Text>
                {subjects.map((s) => {
                  const open = openSubject === s.name;
                  const chapters = open ? chapterStats(rows, s.name) : [];
                  return (
                    <View key={s.name} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}>
                      <Pressable onPress={() => setOpenSubject(open ? null : s.name)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ padding: space.md, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
                          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{s.percent}%</Text>
                          {open ? <CaretUp size={16} color={color('text/tertiary')} style={{ marginLeft: 8 }} /> : <CaretDown size={16} color={color('text/tertiary')} style={{ marginLeft: 8 }} />}
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
                          <View style={{ width: `${s.percent}%`, height: 6, borderRadius: 3, backgroundColor: color('accent/default') }} />
                        </View>
                        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{s.correct} of {s.total} correct{s.percentile != null ? ` · ${s.percentile} percentile` : ''}</Text>
                      </Pressable>
                      {open ? (
                        <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.xs }}>
                          {chapters.length === 0 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>No chapter data for this subject.</Text> : null}
                          {chapters.map((c) => (
                            <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                              <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]} numberOfLines={2}>{c.name}</Text>
                              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{c.correct}/{c.total}</Text>
                              <Text style={[type['type/body-m-medium'], { color: c.percent < 50 ? color('semantic/danger') : color('semantic/success'), width: 44, textAlign: 'right' }]}>{c.percent}%</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : (
              <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="No subject data" description="These tests have no subject tags on their questions." />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

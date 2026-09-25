import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, ChartLineUp, Flame, Lightbulb, WarningCircle } from 'phosphor-react-native';
import RNSvg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { EmptyState, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useFlag } from '@/src/config/AppConfigContext';
import { getProgress, getProgressBreakdown, type ProgressBreakdownResponse, type ProgressResponse } from '@/src/api/profile';
import {
  getCoverage, getMastery, getRecommendations, getTrend, getWeakAreas,
  type Coverage, type MasteryRow, type Patch, type Recommendation, type TrendPoint, type WeakArea,
} from '@/src/api/analytics';

type Section<T> = { status: 'loading' | 'ready' | 'error'; data?: T };
const loading = <T,>(): Section<T> => ({ status: 'loading' });

function shadow(): {} {
  return { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
}

const BUCKET: Record<MasteryRow['bucket'], { label: string; tone: 'semantic/danger' | 'semantic/warning' | 'semantic/success' | 'text/tertiary' }> = {
  weak: { label: 'Needs work', tone: 'semantic/danger' },
  improving: { label: 'Improving', tone: 'semantic/warning' },
  strong: { label: 'Strong', tone: 'semantic/success' },
  not_enough_data: { label: 'Not enough data', tone: 'text/tertiary' },
};

export default function ProgressDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const customOn = useFlag('custom_test.enabled');

  const [stats, setStats] = useState<Section<ProgressResponse>>(loading());
  const [breakdown, setBreakdown] = useState<Section<ProgressBreakdownResponse>>(loading());
  const [trend, setTrend] = useState<Section<TrendPoint[]>>(loading());
  const [mastery, setMastery] = useState<Section<MasteryRow[]>>(loading());
  const [coverage, setCoverage] = useState<Section<Coverage>>(loading());
  const [weak, setWeak] = useState<Section<WeakArea[]>>(loading());
  const [recs, setRecs] = useState<Section<Recommendation[]>>(loading());

  // Every section loads (and can fail) independently — one slow/broken endpoint never blanks the screen.
  const run = useCallback(<T,>(p: Promise<T>, set: (s: Section<T>) => void) => {
    set(loading());
    p.then((data) => set({ status: 'ready', data })).catch(() => set({ status: 'error' }));
  }, []);

  const load = useCallback(() => {
    run(getProgress(), setStats);
    run(getProgressBreakdown(), setBreakdown);
    run(getTrend({ limit: 20 }).then((r) => r.points), setTrend);
    run(getMastery().then((r) => r.chapters), setMastery);
    if (user?.selected_course_id) run(getCoverage(user.selected_course_id), setCoverage);
    else setCoverage({ status: 'ready' });
    run(getWeakAreas().then((r) => r.weak_areas), setWeak);
    run(getRecommendations().then((r) => r.recommendations), setRecs);
  }, [run, user?.selected_course_id]);

  useEffect(() => {
    load();
  }, [load]);

  const practise = (patch: Patch) => router.push({ pathname: '/(student)/(practice)/custom-builder', params: { patch: JSON.stringify(patch) } });

  const chartW = Math.min(width - 2 * space.md - 2 * space.md, 400);
  const points = trend.data ?? [];

  const allFailed = [stats, breakdown, trend, mastery].every((s) => s.status === 'error');

  const subjects = groupBySubject(mastery.data ?? []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>Your Progress</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {allFailed ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load your progress"
            description="Something went wrong fetching your progress data."
            action={<TextButton label="Retry" onPress={load} />}
            style={{ marginTop: space.xl }}
          />
        ) : (
          <>
            {/* Headline numbers */}
            <View style={[styles.row, { gap: space.xs, marginTop: space.xl }]}>
              {stats.status === 'loading' || breakdown.status === 'loading' ? (
                [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} style={{ flex: 1 }} />)
              ) : (
                <>
                  <StatTile label="Tests Taken" value={stats.data ? String(stats.data.attempted_count ?? 0) : '—'} />
                  <StatTile label="Avg. Score" value={stats.data && (stats.data.attempted_count ?? 0) > 0 ? `${Math.round(stats.data.avg_score ?? 0)}%` : '—'} />
                  <StatTile label="Day Streak" value={breakdown.data ? String(breakdown.data.day_streak ?? 0) : '—'} />
                </>
              )}
            </View>

            {/* Recommendations */}
            {customOn && recs.status === 'ready' && (recs.data?.length ?? 0) > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>RECOMMENDED FOR YOU</Text>
                <View style={{ gap: space.sm }}>
                  {recs.data!.map((r) => (
                    <View key={r.code} style={[{ backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md, gap: space.xs }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                        <Lightbulb size={20} weight="fill" color={color('accent/default')} />
                        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{r.title}</Text>
                      </View>
                      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{r.reason}</Text>
                      <SecondaryButton label="Practise this" onPress={() => practise(r.patch)} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Trend */}
            <View style={{ marginTop: space.xl }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>SCORE TREND</Text>
              {trend.status === 'loading' ? (
                <SkeletonBlock height={140} radius={radius.lg} />
              ) : trend.status === 'error' ? (
                <ErrorBanner message="Couldn’t load your trend." onRetry={() => run(getTrend({ limit: 20 }).then((r) => r.points), setTrend)} />
              ) : points.length < 2 ? (
                <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, alignItems: 'center', gap: space.xs }, shadow()]}>
                  <ChartLineUp size={28} color={color('text/tertiary')} weight="duotone" />
                  <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
                    {points.length === 0 ? 'Finish a test to start your trend.' : 'Finish one more test to see your trend.'}
                  </Text>
                </View>
              ) : (
                <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
                  <TrendChart values={points.map((p) => p.pct)} width={chartW} height={110} line={color('accent/default')} fill={color('accent/tint')} grid={color('border/subtle')} />
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                    Last {points.length} tests · latest {Math.round(points[points.length - 1].pct)}%
                  </Text>
                </View>
              )}
            </View>

            {/* Coverage */}
            {coverage.status === 'ready' && coverage.data && coverage.data.available > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>SYLLABUS COVERAGE</Text>
                <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.md }, shadow()]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Ring pct={coverage.data.pct} ink={color('accent/default')} track={color('bg/sunken')} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                        {coverage.data.seen.toLocaleString()} of {coverage.data.available.toLocaleString()} questions seen
                      </Text>
                      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Distinct questions you’ve answered</Text>
                    </View>
                  </View>
                  {coverage.data.subjects.map((s) => (
                    <Bar key={s.subject_id} label={s.subject} pct={Math.round(s.pct * 100)} caption={`${s.seen}/${s.available}`} />
                  ))}
                </View>
              </View>
            ) : coverage.status === 'error' ? (
              <View style={{ marginTop: space.xl }}>
                <ErrorBanner message="Couldn’t load coverage." onRetry={load} />
              </View>
            ) : null}

            {/* Weak areas */}
            {weak.status === 'ready' && (weak.data?.length ?? 0) > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>WEAK AREAS</Text>
                <View style={{ gap: space.xs }}>
                  {weak.data!.slice(0, 5).map((w) => (
                    <View key={w.chapter_id ?? w.chapter} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }, shadow()]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{w.chapter}</Text>
                        <Text style={[type['type/body-m-medium'], { color: color('semantic/danger') }]}>{Math.round(w.accuracy * 100)}%</Text>
                      </View>
                      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{w.subject} · {w.correct}/{w.answers} correct</Text>
                      {customOn ? <TextButton label={w.suggestion.label} onPress={() => practise(w.suggestion.patch)} /> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Mastery by subject / chapter */}
            <View style={{ marginTop: space.xl }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>BY SUBJECT</Text>
              {mastery.status === 'loading' ? (
                <SkeletonBlock height={120} radius={radius.lg} />
              ) : mastery.status === 'error' ? (
                <ErrorBanner message="Couldn’t load your mastery." onRetry={() => run(getMastery().then((r) => r.chapters), setMastery)} />
              ) : subjects.length === 0 ? (
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Answer some questions and your strengths will show up here.</Text>
              ) : (
                <View style={{ gap: space.sm }}>
                  {subjects.map((s) => (
                    <View key={s.name} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.sm }, shadow()]}>
                      <Bar label={s.name} pct={Math.round(s.accuracy * 100)} caption={`${s.correct}/${s.answers}`} strong />
                      {s.chapters.map((c) => {
                        const b = BUCKET[c.bucket];
                        return (
                          <View key={c.chapter_id ?? c.chapter} accessible accessibilityLabel={`${c.chapter}: ${Math.round(c.accuracy * 100)} percent, ${b.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{c.chapter}</Text>
                            <Text style={[type['type/caption'], { color: color(b.tone) }]}>{c.bucket === 'not_enough_data' ? b.label : `${Math.round(c.accuracy * 100)}% · ${b.label}`}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Streak */}
            {breakdown.status === 'ready' && breakdown.data ? (
              <View style={{ marginTop: space.xl }}>
                <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }, shadow()]}>
                  <View style={styles.row}>
                    <Flame size={28} color={color('semantic/warning')} weight="fill" />
                    <Text style={[type['type/numeral-display'], { color: color('text/primary'), marginLeft: space.sm }]}>{breakdown.data.day_streak ?? 0}</Text>
                    <Text style={[type['type/body-m'], { color: color('text/secondary'), marginLeft: space.xs }]}>day streak</Text>
                  </View>
                  <View style={[styles.row, { gap: space.xs, marginTop: space.md }]} accessible accessibilityLabel={`Active on ${(breakdown.data.last_7_days ?? []).filter(Boolean).length} of the last 7 days`}>
                    {(breakdown.data.last_7_days ?? []).map((active, i) => (
                      <View key={i} style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: active ? color('accent/default') : 'transparent', borderWidth: active ? 0 : 1, borderColor: color('border/strong') }} />
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {customOn ? (
              <PrimaryButton label="Build a custom test" onPress={() => router.push('/(student)/(practice)/custom-builder')} style={{ marginTop: space.xl }} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function groupBySubject(rows: MasteryRow[]) {
  const map = new Map<string, { name: string; answers: number; correct: number; chapters: MasteryRow[]; accuracy: number }>();
  for (const r of rows) {
    const g = map.get(r.subject) ?? { name: r.subject, answers: 0, correct: 0, chapters: [], accuracy: 0 };
    g.answers += r.answers;
    g.correct += r.correct;
    g.chapters.push(r);
    map.set(r.subject, g);
  }
  return [...map.values()].map((g) => ({ ...g, accuracy: g.answers > 0 ? g.correct / g.answers : 0 }));
}

function TrendChart({ values, width, height, line, fill, grid }: { values: number[]; width: number; height: number; line: string; fill: string; grid: string }) {
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (Math.max(0, Math.min(100, v)) / 100) * height}`).join(' ');
  return (
    <RNSvg width={width} height={height} accessibilityLabel={`Score trend over ${values.length} tests`}>
      {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1={0} y1={height * f} x2={width} y2={height * f} stroke={grid} strokeWidth={1} />)}
      <Polygon points={`0,${height} ${pts} ${width},${height}`} fill={fill} stroke="none" />
      <Polyline points={pts} fill="none" stroke={line} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </RNSvg>
  );
}

function Ring({ pct, ink, track }: { pct: number; ink: string; track: string }) {
  const { color, type } = useTheme();
  const R = 26, C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${Math.round(p * 100)} percent covered`}>
      <RNSvg width={64} height={64} style={{ position: 'absolute' }}>
        <Circle cx={32} cy={32} r={R} stroke={track} strokeWidth={6} fill="none" />
        <Circle cx={32} cy={32} r={R} stroke={ink} strokeWidth={6} fill="none" strokeDasharray={C} strokeDashoffset={C * (1 - p)} strokeLinecap="round" rotation={-90} origin="32,32" />
      </RNSvg>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{Math.round(p * 100)}%</Text>
    </View>
  );
}

function Bar({ label, pct, caption, strong }: { label: string; pct: number; caption?: string; strong?: boolean }) {
  const { color, type, space } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${pct} percent${caption ? `, ${caption}` : ''}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[strong ? type['type/h3'] : type['type/body-m'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{label}</Text>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{pct}%{caption ? ` · ${caption}` : ''}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: color('bg/sunken'), borderRadius: 3, marginTop: space.xs }}>
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, backgroundColor: color('accent/default'), borderRadius: 3 }} />
      </View>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }}>
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 26 }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

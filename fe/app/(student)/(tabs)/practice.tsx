import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Stack,
  CaretRight,
  PlayCircle,
} from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CollapsingHeader, ErrorBanner, SegmentedControl, SkeletonBlock, useCollapsingHeader } from '@/src/components';
import { CurriculumTree, TreeToolbar } from '@/src/screens/CurriculumTree';
import { CUSTOM_STATE_CHIPS, CustomTestsPanel, type CustomStateFilter } from '@/src/screens/CustomTestsPanel';
import { useAttempts } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import type { StudentAttempt } from '@/src/api/attempts';
import { useFlag } from '@/src/config/AppConfigContext';
import { visibleModules } from '@/src/modules/registry';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type PracticeSegment = 'qbank' | 'test_series' | 'custom';
const TREE_SEGMENTS = ['qbank', 'test_series'] as const;
const SORT_CHIPS = [
  { key: 'newest', label: 'Newest' },
  { key: 'top', label: 'Top rated' },
];
const initialSegment = (k?: string): PracticeSegment =>
  k === 'test_series' || k === 'custom' ? k : 'qbank';



function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function PracticeHubRoute() {
  const { color, type, space, radius } = useTheme();
  const header = useCollapsingHeader(64);
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const customOn = useFlag('custom_test.enabled');

  const attemptsQuery = useAttempts();
  useRefetchOnFocus(attemptsQuery.refetch);
  const attempts: StudentAttempt[] = attemptsQuery.data?.attempts ?? [];
  const loading = attemptsQuery.isPending;
  const loadError = attemptsQuery.isError;
  const load = () => void attemptsQuery.refetch();

  const isNewUser = !loading && attempts.length === 0;

  const completed = attempts.filter((a) => a.status === 'submitted');
  // accuracy = correct ÷ attempted across submitted tests (skipped questions don't count against you)
  const correctSum = completed.reduce((n, a) => n + (a.correct_count ?? 0), 0);
  const attemptedSum = completed.reduce((n, a) => n + (a.correct_count ?? 0) + (a.wrong_count ?? 0), 0);
  const accuracy = attemptedSum > 0 ? Math.round((correctSum / attemptedSum) * 100) : null;
  const scored = completed.filter((a) => (a.total_marks ?? 0) > 0);
  const avgScore = scored.length > 0 ? scored.reduce((acc, a) => acc + Math.max(0, ((a.score ?? 0) / (a.total_marks as number)) * 100), 0) / scored.length : null;

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCount = attempts.filter((a) => new Date(a.started_at).getTime() > oneWeekAgo).length;

  const recentAttempts = attempts.slice(0, 4);
  const inProgress = attempts.find((a) => a.status === 'in_progress');

  const segments = visibleModules((f) => (f === 'custom_test.enabled' ? customOn : false)).map((m) => ({
    key: m.key as PracticeSegment,
    label: m.shortLabel,
  }));
  const [segment, setSegmentState] = useState<PracticeSegment>(initialSegment(params.kind));
  const [visited, setVisited] = useState<Set<PracticeSegment>>(() => new Set([initialSegment(params.kind)]));
  const setSegment = (k: PracticeSegment) => {
    setSegmentState(k);
    setQuery('');
    setVisited((v) => (v.has(k) ? v : new Set(v).add(k)));
  };
  const [query, setQuery] = useState('');
  const [topRated, setTopRated] = useState(false);
  const [customState, setCustomState] = useState<CustomStateFilter>('all');
  const isTree = segment !== 'custom';

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
          <View>
            <Text style={[type['type/h1'], { color: color('header/text') }]}>Practice</Text>
            <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>
              Q Bank, test series and custom tests
            </Text>
          </View>
        }
        compact={<Text style={[type['type/h3'], { color: color('header/text') }]}>Practice</Text>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={load} />
          </View>
        ) : null}

        {inProgress ? (
          <Pressable
            onPress={() => router.push({ pathname: ROUTES.student.testPreStart, params: { id: inProgress.test_id } })}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${inProgress.test?.title ?? 'your test'}`}
            style={({ pressed }) => [
              { backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md, marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 },
            ]}
          >
            <PlayCircle size={32} weight="fill" color={color('accent/default')} />
            <View style={{ flex: 1 }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>CONTINUE</Text>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{inProgress.test?.title ?? 'Your test'}</Text>
            </View>
            <CaretRight size={20} color={color('text/tertiary')} />
          </Pressable>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          <SegmentedControl options={segments} value={segment} onChange={setSegment} />
          {/* One toolbar for every segment, so the container looks the same when switching */}
          <View style={{ marginTop: space.md }}>
            {isTree ? (
              <TreeToolbar
                query={query}
                onQuery={setQuery}
                chips={{
                  options: SORT_CHIPS,
                  value: topRated ? 'top' : 'newest',
                  onChange: (k) => setTopRated(k === 'top'),
                }}
              />
            ) : (
              <TreeToolbar
                query={query}
                onQuery={setQuery}
                placeholder="Search my custom tests"
                chips={{ options: CUSTOM_STATE_CHIPS, value: customState, onChange: (k) => setCustomState(k as CustomStateFilter) }}
              />
            )}
          </View>
          <View style={{ marginTop: space.md }}>
            {/* Each tree mounts on first visit and stays mounted, so open subjects survive switching segments */}
            {TREE_SEGMENTS.filter((k) => visited.has(k)).map((k) => (
              <View key={k} style={{ display: segment === k ? 'flex' : 'none' }}>
                <CurriculumTree kind={k} query={query} topRated={topRated} />
              </View>
            ))}
            {segment === 'custom' ? <CustomTestsPanel query={query} state={customState} /> : null}
          </View>
        </View>

        {loading ? (
          <View style={{ marginTop: space.xl }}>
            <SkeletonBlock height={72} radius={radius.md} />
          </View>
        ) : !isNewUser ? (
          <Stagger delayMs={320}>
            <View style={{ marginTop: space.xl }}>
              <View
                style={[
                  styles.summary,
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.md,
                    paddingVertical: space.md,
                  },
                  shadow(),
                ]}
              >
                <SummaryStat label="Accuracy" value={accuracy != null ? `${accuracy}%` : '—'} />
                <Divider />
                <SummaryStat label="Avg. Score" value={avgScore != null ? `${Math.round(avgScore)}%` : '—'} />
                <Divider />
                <SummaryStat label="This Week" value={`${weeklyCount}`} />
              </View>
            </View>
          </Stagger>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              RECENT TESTS
            </Text>
            <Pressable onPress={() => router.push(ROUTES.student.testHistory)}>
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                View all →
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={{ gap: space.xs }}>
              <SkeletonBlock height={60} radius={radius.md} />
              <SkeletonBlock height={60} radius={radius.md} />
              <SkeletonBlock height={60} radius={radius.md} />
            </View>
          ) : isNewUser ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: space.lg,
                gap: space.xs,
              }}
            >
              <Stack size={28} color={color('text/tertiary')} weight="duotone" />
              <Text
                style={[
                  type['type/body-m'],
                  { color: color('text/secondary'), textAlign: 'center' },
                ]}
              >
                Your recent attempts will show up here — start with Q Bank or Practice.
              </Text>
            </View>
          ) : (
            <View style={{ gap: space.xs }}>
              {recentAttempts.map((t) => {
                const breadcrumb = t.test?.subject?.name 
                  ? `${t.test.subject.name} › ${t.test.chapter?.name || 'General'}` 
                  : (t.test?.course?.name || 'General');

                return (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    t.status === 'submitted'
                      ? router.push({
                          pathname: ROUTES.student.testResult,
                          params: { id: t.id, fromHistory: '1' },
                        })
                      : router.push({
                          pathname: ROUTES.student.testQuestion,
                          params: { id: t.test_id },
                        })
                  }
                  style={({ pressed }) => [
                    {
                      backgroundColor: color('bg/surface'),
                      borderRadius: radius.md,
                      padding: space.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: pressed ? 0.94 : 1,
                    },
                    shadow(),
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                      numberOfLines={1}
                    >
                      {t.test?.title || 'Practice Test'}
                    </Text>
                    <Text
                      style={[
                        type['type/caption'],
                        { color: color('text/tertiary'), marginTop: 2 },
                      ]}
                    >
                      {breadcrumb}
                    </Text>
                  </View>
                  {t.status === 'submitted' ? (
                    <View
                      style={[
                        styles.scoreBadge,
                        { backgroundColor: color('accent/tint'), borderRadius: radius.pill },
                      ]}
                    >
                      <Text
                        style={[type['type/caption'], { color: color('accent/default') }]}
                      >
                        {t.total_marks ? `${t.score ?? 0}/${t.total_marks}` : `${t.score ?? 0}`}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: color('semantic/warning'),
                          borderRadius: radius.pill,
                        },
                      ]}
                    >
                      <Text
                        style={[type['type/caption'], { color: color('text/primary') }]}
                      >
                        In Progress
                      </Text>
                    </View>
                  )}
                </Pressable>
              )})}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const { color } = useTheme();
  return <View style={{ width: 1, backgroundColor: color('border/subtle') }} />;
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  catCard: { justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4 },
});

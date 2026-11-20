import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretRight, ChartLineUp, ClockCounterClockwise, Timer, WarningCircle } from 'phosphor-react-native';
import Animated from 'react-native-reanimated';
import { BottomSheet, CollapsingHeader, EmptyState, SegmentedControl, SkeletonBlock, TextButton, useCollapsingHeader, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listExams, registerForExam, unregisterFromExam, type ExamCard } from '@/src/api/exams';
import { CompactTestCard, NextUpCard, SeriesCard } from '@/src/exam/TestsHomeParts';
import { buildTestsHome, clockOffset, formatCountdown, withPhaseAt, type SeriesProgress } from '@/src/exam/logic';
import { useServerNow } from '@/src/exam/useServerNow';
import { DEFAULT_YEAR, monthGroups, TEST_TABS, TEST_VIEWS, YEARS, countTab, type TestTab, type TestView } from '@/src/exam/testsTabs';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { useHasSubscription } from '@/src/queries/curriculum';
import { ROUTES } from '@/src/navigation/routes';

/** Tests home: one thing to do now, then your tests by type and your series with progress. */
export default function TestsTab() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const header = useCollapsingHeader(64);
  const { show } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const courseId = user && 'selected_course_id' in user ? (user.selected_course_id as string | undefined) : undefined;
  const [tab, setTab] = useState<TestTab>('grand');
  const [view, setView] = useState<TestView>('live');
  const [year, setYear] = useState<number>(DEFAULT_YEAR);
  const { width } = useWindowDimensions();
  const [openSeries, setOpenSeries] = useState<SeriesProgress | null>(null);

  const q = useQuery({ queryKey: ['exams', courseId ?? 'all'], queryFn: () => listExams(courseId) });
  useRefetchOnFocus(() => void q.refetch());
  const [receivedAt] = useState(() => Date.now());
  const offset = useMemo(() => (q.data ? clockOffset(q.data.server_now, receivedAt) : 0), [q.data, receivedAt]);
  const now = useServerNow(offset, true);
  const tests = useMemo(() => withPhaseAt(q.data?.tests ?? [], now), [q.data, now]);
  const home = useMemo(() => buildTestsHome(tests, 'all', now), [tests, now]);
  // A test crossed its start or end: fetch again so my attempt, late entry and results are current.
  const crossed = tests.some((c, i) => c.phase !== q.data?.tests[i]?.phase);
  const { refetch } = q;
  useEffect(() => {
    if (crossed) void refetch();
  }, [crossed, refetch]);

  const remind = useMutation({
    mutationFn: (c: ExamCard) => (c.registered ? unregisterFromExam(c.id) : registerForExam(c.id)),
    onSuccess: (_r, c) => {
      void qc.invalidateQueries({ queryKey: ['exams'] });
      show(c.registered ? 'Reminder off' : 'We will remind you', 'success');
    },
    onError: () => show('Couldn’t update the reminder. Try again.', 'error'),
  });

  const hasSub = useHasSubscription();
  const open = (c: ExamCard) => {
    // A taken test opens its result (or "result pending"), never the Start screen. Practising again is a button there.
    if (c.my_attempt?.status === 'submitted') {
      return router.push({ pathname: ROUTES.student.testResult, params: { id: c.my_attempt.id, fromHistory: '1' } });
    }
    if (c.requires_subscription && !hasSub && !c.my_attempt) return router.push(ROUTES.student.subscriptionPlans);
    router.push({ pathname: ROUTES.student.testPreStart, params: { id: c.id } });
  };

  const groups = useMemo(() => monthGroups(tests, tab, view, year), [tests, tab, view, year]);
  const total = q.data?.tests.length ?? 0;
  const resultsLink = (
    <Pressable
      onPress={() => router.push(ROUTES.student.testHistory)}
      accessibilityRole="button"
      accessibilityLabel={`My results${home.resultsCount ? `, ${home.resultsCount}` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space['2xs'], minHeight: 44, paddingHorizontal: space.sm, opacity: pressed ? 0.6 : 1 })}
    >
      <ClockCounterClockwise size={20} color={color('header/text')} />
      <Text style={[type['type/body-m-medium'], { color: color('header/text') }]}>Results{home.resultsCount ? ` (${home.resultsCount})` : ''}</Text>
    </Pressable>
  );
  const label = (t: string) => <Text style={[type['type/overline'], { color: color('text/tertiary'), paddingHorizontal: space.md }]}>{t}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>Tests</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Timed like the real exam</Text>
            </View>
            {resultsLink}
          </View>
        }
        compact={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>Tests</Text>
            {resultsLink}
          </View>
        }
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingTop: header.maxHeight + space.md, gap: space.lg, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {q.isPending ? (
          <View style={{ paddingHorizontal: space.md, gap: space.md }}>
            <SkeletonBlock height={170} radius={radius.lg} />
            <SkeletonBlock height={120} radius={radius.lg} />
          </View>
        ) : q.isError ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load tests" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
        ) : total === 0 ? (
          <EmptyState icon={<Timer size={32} color={color('text/tertiary')} />} title="No tests yet" description="Tests your teachers publish will show up here." />
        ) : (
          <>
            <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
              <SegmentedControl options={TEST_TABS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={(t) => { setTab(t); setView('live'); }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
                {TEST_VIEWS[tab].map((v) => {
                  const on = v.key === view;
                  const n = countTab(tests, tab, v.key);
                  return (
                    <Pressable
                      key={v.key}
                      onPress={() => setView(v.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{ minHeight: 36, paddingHorizontal: space.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}
                    >
                      <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/secondary') }]}>{v.label}{n ? ` (${n})` : ''}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {tab === 'grand' ? (
              <Pressable
                onPress={() => router.push(ROUTES.student.grandAnalysis)}
                accessibilityRole="button"
                style={({ pressed }) => ({ marginHorizontal: space.md, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 })}
              >
                <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
                <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>My Grand Test performance analysis</Text>
                <CaretRight size={18} color={color('accent/default')} />
              </Pressable>
            ) : null}

            {tab === 'grand' && view === 'live' && home.next.kind !== 'none' ? (
              <View style={{ paddingHorizontal: space.md }}>
                <NextUpCard next={home.next} now={now} onOpen={open} onRemind={(c) => remind.mutate(c)} />
              </View>
            ) : null}

            {tab === 'grand' && view === 'attempted' && home.waiting.length > 0 ? (
              <View style={{ paddingHorizontal: space.md }}>
                <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.sm, gap: 2 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                    {home.waiting.length === 1 ? 'Waiting for results' : `${home.waiting.length} tests waiting for results`}
                  </Text>
                  {home.waiting.slice(0, 2).map((c) => {
                    const at = c.results_at ? new Date(c.results_at).getTime() : null;
                    return (
                      <Text key={c.id} style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={1}>
                        {c.title}{at && at > now ? ` · in ${formatCountdown(at - now)}` : ''}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {tab === 'grand' && view === 'library' && home.series.length > 0 ? (
              <View style={{ gap: space.sm }}>
                {label('YOUR SERIES')}
                <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
                  {home.series.map((s) => <SeriesCard key={s.id} series={s} onOpen={() => setOpenSeries(s)} />)}
                </View>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
              {YEARS.map((y) => {
                const on = y === year;
                return (
                  <Pressable key={y} onPress={() => setYear(y)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 36, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color('accent/default') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}>
                    <Text style={[type['type/body-m-medium'], { color: on ? color('accent/on-accent') : color('text/secondary') }]}>{y}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {groups.length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/tertiary'), paddingHorizontal: space.md }]}>
                {view === 'attempted' ? `You have not attempted any ${TEST_TABS.find((t) => t.key === tab)?.label} in ${year} yet.` : view === 'live' ? `No live or upcoming tests in ${year}.` : `No tests in ${year}.`}
              </Text>
            ) : (
              groups.map((g) => (
                <View key={g.key} style={{ gap: space.sm }}>
                  {label(g.title.toUpperCase())}
                  <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
                    {g.cards.map((c) => <CompactTestCard key={c.id} card={c} width={width - space.md * 2} onOpen={() => open(c)} />)}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </Animated.ScrollView>

      <BottomSheet visible={!!openSeries} onClose={() => setOpenSeries(null)} title={openSeries?.title ?? ''}>
        <View style={{ gap: space.xs }}>
          {openSeries?.cards.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => { setOpenSeries(null); open(c); }}
              accessibilityRole="button"
              style={({ pressed }) => [{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{c.title}</Text>
              <Text style={[type['type/caption'], { color: c.my_attempt?.status === 'submitted' ? color('semantic/success') : color('text/tertiary') }]}>
                {c.my_attempt?.status === 'submitted' ? (c.results_released ? 'Taken. Tap for result' : 'Submitted. Result pending') : c.phase === 'upcoming' ? 'Upcoming' : 'Not taken'}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

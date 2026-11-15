import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClockCounterClockwise, Timer, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, Screen, SkeletonBlock, TAB_EDGES, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listExams, registerForExam, unregisterFromExam, type ExamCard } from '@/src/api/exams';
import { CompactTestCard, NextUpCard, SeriesCard } from '@/src/exam/TestsHomeParts';
import { buildTestsHome, clockOffset, formatCountdown, type SeriesProgress } from '@/src/exam/logic';
import { useServerNow } from '@/src/exam/useServerNow';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { useHasSubscription } from '@/src/queries/curriculum';
import { ROUTES } from '@/src/navigation/routes';

type Filter = 'all' | 'new' | 'taken';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'Not attempted' },
  { key: 'taken', label: 'Taken' },
];

/** Tests home: one thing to do now, then your tests by type and your series with progress. */
export default function TestsTab() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const courseId = user && 'selected_course_id' in user ? (user.selected_course_id as string | undefined) : undefined;
  const [filter, setFilter] = useState<Filter>('all');
  const [openSeries, setOpenSeries] = useState<SeriesProgress | null>(null);

  const q = useQuery({ queryKey: ['exams', courseId ?? 'all'], queryFn: () => listExams(courseId) });
  useRefetchOnFocus(() => void q.refetch());
  const [receivedAt] = useState(() => Date.now());
  const offset = useMemo(() => (q.data ? clockOffset(q.data.server_now, receivedAt) : 0), [q.data, receivedAt]);
  const now = useServerNow(offset, true);
  const home = useMemo(() => buildTestsHome(q.data?.tests ?? [], filter, now), [q.data, filter, now]);

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
    if (c.my_attempt?.status === 'submitted' && c.results_released) {
      return router.push({ pathname: ROUTES.student.testResult, params: { id: c.my_attempt.id, fromHistory: '1' } });
    }
    if (c.requires_subscription && !hasSub && !c.my_attempt) return router.push(ROUTES.student.subscriptionPlans);
    router.push({ pathname: ROUTES.student.testPreStart, params: { id: c.id } });
  };

  const total = q.data?.tests.length ?? 0;
  const label = (t: string) => <Text style={[type['type/overline'], { color: color('text/tertiary'), paddingHorizontal: space.md }]}>{t}</Text>;

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>Tests</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>Timed like the real exam.</Text>
        </View>
        <Pressable
          onPress={() => router.push(ROUTES.student.testHistory)}
          accessibilityRole="button"
          accessibilityLabel={`My results${home.resultsCount ? `, ${home.resultsCount}` : ''}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space['2xs'], minHeight: 44, paddingHorizontal: space.sm, opacity: pressed ? 0.6 : 1 })}
        >
          <ClockCounterClockwise size={20} color={color('accent/default')} />
          <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>My results{home.resultsCount ? ` (${home.resultsCount})` : ''}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: space.md, gap: space.lg, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
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
            {home.next.kind !== 'none' ? (
              <View style={{ paddingHorizontal: space.md }}>
                <NextUpCard next={home.next} now={now} onOpen={open} onRemind={(c) => remind.mutate(c)} />
              </View>
            ) : null}

            {home.waiting.length > 0 ? (
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

            {home.series.length > 0 ? (
              <View style={{ gap: space.sm }}>
                {label('YOUR SERIES')}
                <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
                  {home.series.map((s) => <SeriesCard key={s.id} series={s} onOpen={() => setOpenSeries(s)} />)}
                </View>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{ minHeight: 36, paddingHorizontal: space.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}
                  >
                    <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/secondary') }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {home.rows.length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/tertiary'), paddingHorizontal: space.md }]}>
                {filter === 'new' ? 'You have attempted every test here.' : 'Nothing here yet.'}
              </Text>
            ) : (
              home.rows.map((r) => (
                <View key={r.key} style={{ gap: space.sm }}>
                  {label(r.title.toUpperCase())}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.sm, paddingBottom: space.xs }}>
                    {r.cards.map((c) => <CompactTestCard key={c.id} card={c} onOpen={() => open(c)} />)}
                  </ScrollView>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

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
    </Screen>
  );
}

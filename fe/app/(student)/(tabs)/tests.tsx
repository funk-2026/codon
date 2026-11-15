import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Timer, WarningCircle } from 'phosphor-react-native';
import { EmptyState, Screen, SegmentedControl, SkeletonBlock, TAB_EDGES, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listExams, registerForExam, unregisterFromExam, type ExamCard } from '@/src/api/exams';
import { ExamCardView } from '@/src/exam/ExamCardView';
import { clockOffset, groupExams } from '@/src/exam/logic';
import { useServerNow } from '@/src/exam/useServerNow';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';

type Segment = 'now' | 'library' | 'mine';

/** Tests are exams, not practice: live events, a library of past and anytime tests, and my results. */
export default function TestsTab() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const courseId = user && 'selected_course_id' in user ? (user.selected_course_id as string | undefined) : undefined;
  const [segment, setSegment] = useState<Segment>('now');

  const q = useQuery({ queryKey: ['exams', courseId ?? 'all'], queryFn: () => listExams(courseId) });
  useRefetchOnFocus(() => void q.refetch());
  const [receivedAt] = useState(() => Date.now());
  const offset = useMemo(() => (q.data ? clockOffset(q.data.server_now, receivedAt) : 0), [q.data, receivedAt]);
  const now = useServerNow(offset, true);
  const groups = useMemo(() => groupExams(q.data?.tests ?? []), [q.data]);

  const remind = useMutation({
    mutationFn: (c: ExamCard) => (c.registered ? unregisterFromExam(c.id) : registerForExam(c.id)),
    onSuccess: (_r, c) => {
      void qc.invalidateQueries({ queryKey: ['exams'] });
      show(c.registered ? 'Reminder off' : 'We will remind you', 'success');
    },
    onError: () => show('Couldn’t update the reminder. Try again.', 'error'),
  });

  const open = (c: ExamCard) => router.push({ pathname: ROUTES.student.testPreStart, params: { id: c.id } });
  const result = (c: ExamCard) => c.my_attempt && router.push({ pathname: ROUTES.student.testResult, params: { id: c.my_attempt.id } });
  const view = (c: ExamCard) => (
    <ExamCardView key={c.id} card={c} now={now} onOpen={() => open(c)} onRemind={() => remind.mutate(c)} onResult={() => result(c)} />
  );
  const section = (title: string, cards: ExamCard[]) =>
    cards.length === 0 ? null : (
      <View key={title} style={{ gap: space.sm }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{title}</Text>
        {cards.map(view)}
      </View>
    );

  // The library groups by series so a mock series reads as one set.
  const bySeries = useMemo(() => {
    const m = new Map<string, ExamCard[]>();
    for (const c of groups.library) {
      const k = c.series?.title ?? 'More tests';
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.entries()];
  }, [groups.library]);

  const empty = (title: string, description: string) => (
    <EmptyState icon={<Timer size={32} color={color('text/tertiary')} />} title={title} description={description} />
  );

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Tests</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>Timed like the real exam. Answers open when results are out.</Text>
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <SegmentedControl
          options={[{ key: 'now' as const, label: 'Live & upcoming' }, { key: 'library' as const, label: 'Library' }, { key: 'mine' as const, label: 'My results' }]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={150} radius={radius.lg} />)
        ) : q.isError ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load tests" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
        ) : segment === 'now' ? (
          groups.liveNow.length + groups.upcoming.length === 0
            ? empty('No live tests scheduled', 'When a live test is announced it appears here, with a reminder. Meanwhile, the library has past tests you can take anytime.')
            : [section('LIVE NOW', groups.liveNow), section('UPCOMING', groups.upcoming)]
        ) : segment === 'library' ? (
          bySeries.length === 0
            ? empty('No tests yet', 'Tests your teachers publish will show up here.')
            : bySeries.map(([title, cards]) => section(title.toUpperCase(), cards))
        ) : groups.mine.length === 0 ? (
          empty('No results yet', 'Your finished tests, with scores and ranks, will be here.')
        ) : (
          groups.mine.map(view)
        )}
      </ScrollView>
    </Screen>
  );
}

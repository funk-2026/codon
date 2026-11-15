import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { CaretLeft, Timer, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, HeaderBand, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useFlag } from '@/src/config/AppConfigContext';
import { getModule } from '@/src/modules/registry';
import { ApiError, newIdempotencyKey } from '@/src/api/client';
import { type AttemptBreakdown, type BreakdownRow, type StudentAttempt } from '@/src/api/attempts';
import { customFromAttempt } from '@/src/api/customTests';
import { ResultInsights } from '@/src/attempt/ResultInsights';
import { ShareResultSheet } from '@/src/attempt/ShareResultSheet';
import { useAuth } from '@/src/auth/AuthContext';
import { StarRating } from '@/src/social/RatingControl';
import { formatClock } from '@/src/attempt/logic';
import { track } from '@/src/analytics/track';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useAttemptResult } from '@/src/queries/attempts';
import { rankText } from '@/src/exam/logic';

function band(p: number): { color: 'semantic/success' | 'semantic/warning' | 'semantic/danger'; headline: string } {
  if (p >= 85) return { color: 'semantic/success', headline: 'Excellent work.' };
  if (p >= 60) return { color: 'semantic/success', headline: 'Solid attempt.' };
  if (p >= 35) return { color: 'semantic/warning', headline: 'Good effort — let’s review what to sharpen.' };
  return { color: 'semantic/danger', headline: 'This one’s a starting point, not a verdict.' };
}

const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

export default function TestResultRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const customEnabled = useFlag('custom_test.enabled');
  const { id, expired } = useLocalSearchParams<{ id: string; fromHistory?: string; expired?: string }>();

  const resultQuery = useAttemptResult(id, expired === '1');
  const loading = resultQuery.isPending;
  const loadError = resultQuery.isError;
  // Still retrying a not-yet-finalised result after a deadline.
  const notReady = resultQuery.isPending && resultQuery.failureCount > 0;
  const attempt: StudentAttempt | null = resultQuery.data?.attempt ?? null;
  const breakdown: AttemptBreakdown | null = resultQuery.data?.breakdown ?? null;
  const cohort = resultQuery.data?.cohort ?? null;
  const load = () => void resultQuery.refetch();
  const [mistakesOpen, setMistakesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { user } = useAuth();
  const [include, setInclude] = useState<'wrong' | 'unattempted' | 'both'>('both');
  const [building, setBuilding] = useState(false);
  const idemKey = useRef(newIdempotencyKey());


  const hasMarks = attempt?.total_marks != null && attempt.total_marks > 0;
  const SCORE = attempt?.score ?? 0;
  const MAX = attempt?.total_marks ?? 0;
  const CORRECT = attempt?.correct_count ?? 0;
  const INCORRECT = attempt?.wrong_count ?? 0;
  const UNATTEMPTED = attempt?.unattempted_count ?? 0;
  // negative marking can push the score below zero — the ring never goes below empty
  const PERCENT = hasMarks ? Math.max(0, Math.min(100, Math.round((SCORE / MAX) * 100))) : 0;
  const b = band(hasMarks ? PERCENT : CORRECT + INCORRECT > 0 ? Math.round((CORRECT / (CORRECT + INCORRECT)) * 100) : 0);

  const module = getModule(attempt?.test?.module_type);
  const isCustom = attempt?.test?.module_type === 'custom';
  const canPractiseMistakes = customEnabled && INCORRECT + UNATTEMPTED > 0;

  const weakest = useMemo(() => {
    const rows = (breakdown?.subjects ?? []).filter((r) => r.attempted >= 3);
    if (rows.length < 2) return null;
    return [...rows].sort((x, y) => x.accuracy - y.accuracy)[0];
  }, [breakdown]);

  const practiseMistakes = async () => {
    if (!id) return;
    setBuilding(true);
    try {
      const res = await customFromAttempt(id, { include }, idemKey.current);
      track('custom.practise_mistakes', { include, count: res.test.total_questions });
      setMistakesOpen(false);
      idemKey.current = newIdempotencyKey();
      router.push({ pathname: ROUTES.student.testPreStart, params: { id: res.test.id } });
    } catch (e) {
      const msg =
        e instanceof ApiError && e.code === 'pool_too_small' ? 'Not enough questions left to build a test from these.'
        : e instanceof ApiError && e.code === 'quota_exceeded' ? 'You’ve reached today’s limit for custom tests.'
        : 'Couldn’t build your practice test. Try again.';
      show(msg, 'error');
    } finally {
      setBuilding(false);
    }
  };

  const breadcrumb = attempt?.test?.subject?.name
    ? `${attempt.test.subject.name} › ${attempt.test.chapter?.name || 'General'}`
    : attempt?.test?.course?.name || module.label;

  if (loading || notReady) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: space.md, marginTop: space['2xl'] }}>
          <View style={{ alignItems: 'center' }}>
            <SkeletonBlock width={120} height={120} radius={60} />
          </View>
          {notReady ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.md }]}>Finalising your test…</Text>
          ) : null}
          <View style={[styles.row, { gap: space.xs, marginTop: space.xl }]}>
            {[0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} style={{ flex: 1 }} />)}
          </View>
        </View>
      </Screen>
    );
  }

  if (resultQuery.data?.pending && attempt) {
    const at = resultQuery.data.results_at ? new Date(resultQuery.data.results_at) : null;
    return (
      <Screen>
        <EmptyState
          icon={<Timer size={36} color={color('accent/default')} />}
          title="Submitted. Results are not out yet"
          description={`${attempt.test?.title ?? 'Your test'} is a live event. Scores, ranks and answers open${at ? ` on ${at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ' later'}. We will notify you.`}
          action={<PrimaryButton label="Back to Tests" onPress={() => router.replace(ROUTES.student.tests)} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </Screen>
    );
  }

  if (loadError || !attempt) {
    return (
      <Screen>
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load your result"
          description="Something went wrong fetching this test result. Check your connection and try again."
          action={<TextButton label="Retry" onPress={load} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </Screen>
    );
  }

  const R = 54;
  const CIRC = 2 * Math.PI * R;

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        <HeaderBand>
          <Pressable
            onPress={() => router.replace(ROUTES.student.practice)}
            hitSlop={space.xs}
            accessibilityRole="button"
            accessibilityLabel="Back to Practice"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, justifyContent: 'center' })}
          >
            <CaretLeft size={24} color={color('header/text')} />
          </Pressable>

          {/* Score hero */}
          <View style={{ alignItems: 'center', marginTop: space.xs }} accessible accessibilityLabel={`Score ${fmtScore(SCORE)}${hasMarks ? ` out of ${fmtScore(MAX)}, ${PERCENT} percent` : ''}`}>
            <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={120} height={120} style={{ position: 'absolute' }}>
                <Circle cx={60} cy={60} r={R} stroke={color('bg/surface')} strokeWidth={8} fill="none" />
                {hasMarks ? (
                  <Circle
                    cx={60} cy={60} r={R} stroke={color(b.color)} strokeWidth={8} fill="none"
                    strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - PERCENT / 100)} strokeLinecap="round" rotation={-90} origin="60,60"
                  />
                ) : null}
              </Svg>
              <Text style={[type['type/numeral-display'], { color: color('header/text'), fontSize: hasMarks ? 30 : 36 }]}>
                {hasMarks ? `${fmtScore(SCORE)}/${fmtScore(MAX)}` : fmtScore(SCORE)}
              </Text>
              {hasMarks ? <Text style={[type['type/body-m'], { color: color('header/text-secondary') }]}>{PERCENT}%</Text> : null}
            </View>
            <Text style={[type['type/h3'], { color: color('header/text'), textAlign: 'center', marginTop: space.sm }]}>{b.headline}</Text>
          </View>
        </HeaderBand>

        <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        {expired === '1' || attempt.auto_submitted ? (
          <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Timer size={20} weight="fill" color={color('semantic/warning')} />
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>Time’s up — your answers so far were submitted automatically.</Text>
          </View>
        ) : null}

        {/* Counts */}
        <View style={[styles.row, { gap: space.xs, marginTop: space.md }]}>
          <BreakTile label="Correct" value={CORRECT} ink={color('semantic/success')} />
          <BreakTile label="Incorrect" value={INCORRECT} ink={color('semantic/danger')} />
          <BreakTile label="Unattempted" value={UNATTEMPTED} ink={color('text/secondary')} />
        </View>

        {/* Meta */}
        <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg }, shadow()]}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{attempt.test?.title || 'Test'}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {breadcrumb}
            {attempt.time_taken_seconds != null ? ` · ${formatClock(attempt.time_taken_seconds)} taken` : ''}
            {attempt.attempt_no && attempt.attempt_no > 1 ? ` · Attempt ${attempt.attempt_no}` : ''}
          </Text>
        </View>

        {cohort ? (
          <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }, shadow()]} accessible>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HOW YOU DID AMONG STUDENTS</Text>
              {cohort.locked ? (
                <>
                  <Text style={[type['type/h3'], { color: color('text/primary'), marginTop: 2 }]}>Rank is for subscribers</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{cohort.total} students took this test.</Text>
                </>
              ) : cohort.rank != null ? (
                <>
                  <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: 2 }]}>{rankText({ rank: cohort.rank, total: cohort.total, estimated: cohort.estimated, top_percent: cohort.top_percent }).line}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                    {cohort.top_percent != null ? `Top ${cohort.top_percent}%` : 'Percentile shows once more students have taken it'}
                    {cohort.avg_score != null ? ` · average ${fmtScore(cohort.avg_score)}` : ''}
                    {cohort.top_score != null ? ` · best ${fmtScore(cohort.top_score)}` : ''}
                  </Text>
                  {cohort.estimated ? (
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>Estimated against the students who took it in the live window. It does not change the real ranking.</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Performance breakdown — sections with no data are hidden, never fabricated */}
        {weakest ? (
          <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, marginTop: space.lg }}>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
              Focus area: <Text style={type['type/body-m-medium']}>{weakest.name}</Text> — {Math.round(weakest.accuracy * 100)}% accuracy ({weakest.correct}/{weakest.attempted}).
            </Text>
          </View>
        ) : null}
        <BreakdownSection title="By subject" rows={breakdown?.subjects} />
        <BreakdownSection title="By chapter" rows={breakdown?.chapters} limit={6} />
        <BreakdownSection title="By difficulty" rows={breakdown?.difficulty} />
        {attempt.id ? (
          <ResultInsights
            attemptId={attempt.id}
            onOpenQuestion={(position) => router.push({ pathname: ROUTES.student.testReview, params: { id, position: String(position) } })}
          />
        ) : null}

        {/* Rating (authored tests only) */}
        {!isCustom && attempt.test_id ? (
          <View style={{ marginTop: space.xl }}>
            <StarRating itemType="test" itemId={attempt.test_id} value={(attempt.test as any)?.my_rating ?? null} label="How was this test?" />
          </View>
        ) : null}

        {/* Actions */}
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <PrimaryButton
            label="Review Answers"
            onPress={() => {
              track('custom.review_opened', { custom: isCustom });
              router.push({ pathname: ROUTES.student.testReview, params: { id } });
            }}
          />
          {module.key === 'test_series' ? (
            <>
              <SecondaryButton label="Detailed analysis" onPress={() => router.push({ pathname: ROUTES.student.testAnalysis, params: { id } })} />
              <SecondaryButton label="Leaderboard" onPress={() => router.push({ pathname: ROUTES.student.testLeaderboard, params: { id: attempt.test_id } })} />
            </>
          ) : null}
          {canPractiseMistakes ? (
            <SecondaryButton label="Practise my mistakes" onPress={() => setMistakesOpen(true)} />
          ) : null}
          {module.canRetake ? (
            <SecondaryButton
              label={isCustom ? 'Retake these questions' : module.key === 'test_series' ? 'Practise this test again' : 'Retake Test'}
              onPress={() => router.push({ pathname: ROUTES.student.testPreStart, params: { id: attempt.test_id } })}
            />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
            <TextButton label="Share result" onPress={() => setShareOpen(true)} />
            <TextButton label={module.key === 'test_series' ? 'Back to Tests' : 'Back to Practice'} onPress={() => router.replace(module.key === 'test_series' ? ROUTES.student.tests : ROUTES.student.practice)} />
          </View>
        </View>
        </View>
      </ScrollView>

      <ShareResultSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        data={{
          firstName: user?.name?.split(' ')[0] || 'I',
          testTitle: attempt.test?.title ?? module.label,
          percent: hasMarks ? PERCENT : null,
          score: hasMarks ? `${SCORE}/${MAX}` : `${CORRECT}/${CORRECT + INCORRECT + UNATTEMPTED}`,
          correct: CORRECT,
          attempted: CORRECT + INCORRECT,
        }}
      />
      <BottomSheet visible={mistakesOpen} onClose={() => setMistakesOpen(false)} title="Practise my mistakes" dismissable={!building}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          We’ll build a new private test from the questions you got wrong or skipped.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {([
            ['both', `Wrong + unattempted (${INCORRECT + UNATTEMPTED})`],
            ['wrong', `Only wrong (${INCORRECT})`],
            ['unattempted', `Only unattempted (${UNATTEMPTED})`],
          ] as const).map(([k, label]) => {
            const disabled = (k === 'wrong' && INCORRECT === 0) || (k === 'unattempted' && UNATTEMPTED === 0);
            const on = include === k;
            return (
              <Pressable
                key={k}
                disabled={disabled}
                onPress={() => setInclude(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled }}
                style={{
                  padding: space.md, minHeight: 48, borderRadius: radius.md, borderWidth: on ? 2 : 1.5, opacity: disabled ? 0.4 : 1,
                  borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/surface'),
                }}
              >
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton label="Build test" onPress={practiseMistakes} loading={building} style={{ marginTop: space.lg }} />
      </BottomSheet>
    </View>
  );
}

function BreakdownSection({ title, rows, limit }: { title: string; rows?: BreakdownRow[]; limit?: number }) {
  const { color, type, space, radius } = useTheme();
  if (!rows || rows.length === 0) return null;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{title.toUpperCase()}</Text>
      <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.md }}>
        {shown.map((r) => {
          const pct = Math.round(r.accuracy * 100);
          const ink = r.attempted === 0 ? color('text/tertiary') : pct >= 70 ? color('semantic/success') : pct >= 40 ? color('semantic/warning') : color('semantic/danger');
          return (
            <View key={`${r.id ?? r.name}`} accessible accessibilityLabel={`${r.name}: ${r.correct} of ${r.attempted} attempted correct, ${r.total} questions`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[type['type/body-m-medium'], { color: ink }]}>{r.attempted === 0 ? '—' : `${pct}%`}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken'), marginTop: 6 }}>
                <View style={{ width: `${r.attempted === 0 ? 0 : pct}%`, height: 6, borderRadius: 3, backgroundColor: ink }} />
              </View>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 4 }]}>
                {r.correct} correct · {r.wrong} wrong · {r.total - r.attempted} skipped
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BreakTile({ label, value, ink }: { label: string; value: number; ink: string }) {
  const { color, type, radius } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
      <Text style={[type['type/h2'], { color: ink }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row' },
});

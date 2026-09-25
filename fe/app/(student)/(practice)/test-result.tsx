import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { CaretLeft, Timer, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useFlag } from '@/src/config/AppConfigContext';
import { getModule } from '@/src/modules/registry';
import { ApiError, newIdempotencyKey } from '@/src/api/client';
import { getAttemptResult, type AttemptBreakdown, type BreakdownRow, type StudentAttempt } from '@/src/api/attempts';
import { customFromAttempt } from '@/src/api/customTests';
import { StarRating } from '@/src/social/RatingControl';
import { formatClock } from '@/src/attempt/logic';
import { track } from '@/src/analytics/track';

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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [breakdown, setBreakdown] = useState<AttemptBreakdown | null>(null);
  const [mistakesOpen, setMistakesOpen] = useState(false);
  const [include, setInclude] = useState<'wrong' | 'unattempted' | 'both'>('both');
  const [building, setBuilding] = useState(false);
  const idemKey = useRef(newIdempotencyKey());
  const retries = useRef(0);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    getAttemptResult(id)
      .then((res) => {
        setAttempt(res.attempt);
        setBreakdown(res.breakdown ?? null);
        setNotReady(false);
      })
      .catch((err) => {
        // Right after a deadline the server may still be finalising the attempt: retry a few times before failing.
        if (err instanceof ApiError && err.status === 404 && expired === '1' && retries.current < 5) {
          retries.current += 1;
          setNotReady(true);
          setTimeout(load, 1500);
          return;
        }
        console.error('Failed to load result', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id, expired]);

  useEffect(() => {
    load();
  }, [load]);

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
      router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: res.test.id } });
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
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
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
      </SafeAreaView>
    );
  }

  if (loadError || !attempt) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load your result"
          description="Something went wrong fetching this test result. Check your connection and try again."
          action={<TextButton label="Retry" onPress={load} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  const R = 54;
  const CIRC = 2 * Math.PI * R;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Pressable
          onPress={() => router.replace('/(student)/(practice)')}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Back to Practice"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, justifyContent: 'center' })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {expired === '1' || attempt.auto_submitted ? (
          <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Timer size={20} weight="fill" color={color('semantic/warning')} />
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>Time’s up — your answers so far were submitted automatically.</Text>
          </View>
        ) : null}

        {/* Score hero */}
        <View style={{ alignItems: 'center', marginTop: space.lg }} accessible accessibilityLabel={`Score ${fmtScore(SCORE)}${hasMarks ? ` out of ${fmtScore(MAX)}, ${PERCENT} percent` : ''}`}>
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={120} height={120} style={{ position: 'absolute' }}>
              <Circle cx={60} cy={60} r={R} stroke={color('bg/sunken')} strokeWidth={8} fill="none" />
              {hasMarks ? (
                <Circle
                  cx={60} cy={60} r={R} stroke={color(b.color)} strokeWidth={8} fill="none"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - PERCENT / 100)} strokeLinecap="round" rotation={-90} origin="60,60"
                />
              ) : null}
            </Svg>
            <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: hasMarks ? 30 : 36 }]}>
              {hasMarks ? `${fmtScore(SCORE)}/${fmtScore(MAX)}` : fmtScore(SCORE)}
            </Text>
            {hasMarks ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{PERCENT}%</Text> : null}
          </View>
          <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center', marginTop: space.sm }]}>{b.headline}</Text>
        </View>

        {/* Counts */}
        <View style={[styles.row, { gap: space.xs, marginTop: space.xl }]}>
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
              router.push({ pathname: '/(student)/(practice)/test-review', params: { id } });
            }}
          />
          {canPractiseMistakes ? (
            <SecondaryButton label="Practise my mistakes" onPress={() => setMistakesOpen(true)} />
          ) : null}
          {module.canRetake ? (
            <SecondaryButton
              label={isCustom ? 'Retake these questions' : 'Retake Test'}
              onPress={() => router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: attempt.test_id } })}
            />
          ) : null}
          <View style={{ alignItems: 'center' }}>
            <TextButton label="Back to Practice" onPress={() => router.replace('/(student)/(practice)')} />
          </View>
        </View>
      </ScrollView>

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
    </SafeAreaView>
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

function shadow() {
  return { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row' },
});

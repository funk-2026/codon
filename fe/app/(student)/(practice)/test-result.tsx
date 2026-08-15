import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { CaretLeft } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttemptResult } from '@/src/api/attempts';
import type { StudentAttempt } from '@/src/api/attempts';


function band(p: number): { color: string; headline: string } {
  if (p >= 85) return { color: 'semantic/success', headline: 'Excellent work.' };
  if (p >= 60) return { color: 'semantic/success', headline: 'Solid attempt.' };
  if (p >= 35) return { color: 'semantic/warning', headline: 'Good effort \u2014 let\u2019s review what to sharpen.' };
  return { color: 'semantic/danger', headline: 'This one\u2019s a starting point, not a verdict.' };
}

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 280 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function TestResultRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, fromHistory } = useLocalSearchParams<{ id: string; fromHistory?: string }>();
  const revisited = fromHistory === '1';

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);

  useEffect(() => {
    if (!id) return;
    getAttemptResult(id)
      .then(res => setAttempt(res.attempt))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const SCORE = attempt?.score || 0;
  const MAX = attempt?.total_marks || 100;
  const CORRECT = attempt?.correct_count || 0;
  const INCORRECT = attempt?.wrong_count || 0;
  const UNATTEMPTED = attempt?.unattempted_count || 0;
  const PERCENT = MAX > 0 ? Math.round((SCORE / MAX) * 100) : 0;

  const ringFill = useSharedValue(0);
  const scoreNum = useSharedValue(0);
  const headlineShown = useSharedValue(0);

  const b = band(PERCENT);

  useEffect(() => {
    if (revisited) {
      ringFill.value = PERCENT / 100;
      scoreNum.value = SCORE;
      headlineShown.value = 1;
      return;
    }
    ringFill.value = withTiming(PERCENT / 100, { duration: 900 });
    scoreNum.value = withTiming(SCORE, { duration: 900 });
    const t = setTimeout(() => {
      headlineShown.value = withTiming(1, { duration: 300 });
    }, 950);
    return () => clearTimeout(t);
  }, [revisited, ringFill, scoreNum, headlineShown]);

  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const ringStyle = useAnimatedStyle(() => ({
    // SVG strokeDashoffset driven via useAnimatedStyle won't work; we use state instead
  }));
  void ringStyle;

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));
  void scoreStyle;

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineShown.value,
  }));

  const moduleType = attempt?.test?.module_type || 'test_series';
  const canRetake = moduleType === 'qbank' || moduleType === 'practice';
  
  const breadcrumb = attempt?.test?.subject?.name 
    ? `${attempt.test.subject.name} › ${attempt.test.chapter?.name || 'General'}` 
    : (attempt?.test?.course?.name || 'General');

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas'), justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Loading results...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Pressable
          onPress={() => router.replace('/(student)/(practice)')}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score hero */}
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={120} height={120} style={{ position: 'absolute' }}>
              <Circle cx={60} cy={60} r={R} stroke={color('bg/sunken')} strokeWidth={8} fill="none" />
              <Circle
                cx={60}
                cy={60}
                r={R}
                stroke={color(b.color as 'semantic/success' | 'semantic/warning' | 'semantic/danger')}
                strokeWidth={8}
                fill="none"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - PERCENT / 100)}
                strokeLinecap="round"
                rotation={-90}
                origin="60,60"
              />
            </Svg>
            <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 32 }]}>
              {SCORE}/{MAX}
            </Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{PERCENT}%</Text>
          </View>
          <Animated.View style={[headlineStyle, { marginTop: space.sm }]}>
            <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
              {b.headline}
            </Text>
          </Animated.View>
        </View>

        {/* Breakdown */}
        <Stagger delayMs={revisited ? 0 : 1000}>
          <View style={[styles.breakdownRow, { gap: space.xs, marginTop: space.xl }]}>
            <BreakTile label="Correct" value={CORRECT} ink={color('semantic/success')} />
            <BreakTile label="Incorrect" value={INCORRECT} ink={color('semantic/danger')} />
            <BreakTile label="Unattempted" value={UNATTEMPTED} ink={color('text/secondary')} />
          </View>
        </Stagger>

        {/* Meta card */}
        <Stagger delayMs={revisited ? 60 : 1100}>
          <View
            style={[
              {
                backgroundColor: color('bg/surface'),
                borderRadius: radius.md,
                padding: space.md,
                marginTop: space.lg,
              },
              shadow(),
            ]}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
              {attempt?.test?.title || 'Practice Test'}
            </Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
              {breadcrumb} · {Math.floor((attempt?.time_taken_seconds || 0) / 60)} min
            </Text>
          </View>
        </Stagger>

        {/* Actions */}
        <Stagger delayMs={revisited ? 120 : 1200}>
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <PrimaryButton
              label="Review Answers"
              onPress={() => router.push({ pathname: '/(student)/(practice)/test-review', params: { id } })}
            />
            {canRetake ? (
              <SecondaryButton
                label="Retake Test"
                onPress={() => router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: attempt?.test_id } })}
              />
            ) : null}
            <View style={{ alignItems: 'center' }}>
              <TextButton label="Back to Practice" onPress={() => router.replace('/(student)/(practice)')} />
            </View>
          </View>
        </Stagger>
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakTile({ label, value, ink }: { label: string; value: number; ink: string }) {
  const { color, type, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color('bg/surface'),
        borderRadius: radius.md,
        padding: 12,
        alignItems: 'center',
      }}
    >
      <Text style={[type['type/h2'], { color: ink }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

function shadow() {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  breakdownRow: { flexDirection: 'row' },
});

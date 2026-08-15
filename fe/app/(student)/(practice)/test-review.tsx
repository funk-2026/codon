import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Check, X, GridFour } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttemptReview, getAttemptResult } from '@/src/api/attempts';
import type { AttemptReviewResponse } from '@/src/api/attempts';
import { MOCK_ATTEMPT_REVIEW, MOCK_ATTEMPT_RESULT } from '@/src/mocks/mockReview';

type Status = 'correct' | 'incorrect' | 'unattempted';

type ReviewQuestion = {
  n: number;
  text: string;
  options: string[];
  correctIdx: number;
  pickedIdx?: number;
  explanation?: string;
};

function status(q: ReviewQuestion): Status {
  if (q.pickedIdx == null) return 'unattempted';
  return q.pickedIdx === q.correctIdx ? 'correct' : 'incorrect';
}

function mapReview(res: AttemptReviewResponse): ReviewQuestion[] {
  return res.review.map((r, i) => ({
    n: i + 1,
    text: r.question_text,
    options: [r.option_a, r.option_b, r.option_c, r.option_d],
    correctIdx: r.correct_option.charCodeAt(0) - 65,
    pickedIdx: r.selected_option ? r.selected_option.charCodeAt(0) - 65 : undefined,
    explanation: r.explanation || undefined,
  }));
}

type Filter = 'all' | 'incorrect' | 'correct' | 'unattempted';

const FALLBACK_REVIEW_MINUTES = 10;

export default function TestReviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(FALLBACK_REVIEW_MINUTES * 60);

  useEffect(() => {
    async function load() {
      try {
        if (!id) throw new Error('no attempt id — using local mock data');
        const [reviewRes, resultRes] = await Promise.all([
          getAttemptReview(id),
          getAttemptResult(id),
        ]);
        setQuestions(mapReview(reviewRes));
        const mins = resultRes.attempt.test?.duration_minutes;
        setSecondsLeft((mins && mins > 0 ? mins : FALLBACK_REVIEW_MINUTES) * 60);
      } catch (err) {
        // Local-only fallback so this screen is testable without a running backend
        // or a real submitted attempt — see src/mocks/mockReview.ts.
        console.warn('Falling back to local mock review data', err);
        setQuestions(mapReview(MOCK_ATTEMPT_REVIEW));
        const mins = MOCK_ATTEMPT_RESULT.attempt.test?.duration_minutes;
        setSecondsLeft((mins && mins > 0 ? mins : FALLBACK_REVIEW_MINUTES) * 60);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [loading]);

  const [filter, setFilter] = useState<Filter>('all');
  const [current, setCurrent] = useState(0);

  const counts = {
    all: questions.length,
    incorrect: questions.filter((q) => status(q) === 'incorrect').length,
    correct: questions.filter((q) => status(q) === 'correct').length,
    unattempted: questions.filter((q) => status(q) === 'unattempted').length,
  };

  const filtered = questions.filter((q) => {
    if (filter === 'all') return true;
    return status(q) === filter;
  });

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'incorrect', label: `Incorrect (${counts.incorrect})` },
    { id: 'correct', label: `Correct (${counts.correct})` },
    { id: 'unattempted', label: `Unattempted (${counts.unattempted})` },
  ];

  const selectFilter = (f: Filter) => {
    setFilter(f);
    setCurrent(0);
  };

  const TOTAL = filtered.length;
  const q = filtered[current];

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const slideX = useSharedValue(0);
  const sheetRise = useSharedValue(0);

  const goNext = () => {
    if (current >= TOTAL - 1) return;
    setSlideDir(1);
    slideX.value = 0;
    setCurrent((c) => c + 1);
  };

  const goPrev = () => {
    if (current <= 0) return;
    setSlideDir(-1);
    slideX.value = 0;
    setCurrent((c) => c - 1);
  };

  const jumpToQuestion = (n: number) => {
    setPaletteOpen(false);
    setFilter('all');
    setCurrent(n - 1);
  };

  useEffect(() => {
    if (paletteOpen) {
      sheetRise.value = withTiming(1, { duration: 260 });
      slideX.value = withTiming(slideDir * 12, { duration: 200 });
    } else {
      sheetRise.value = withTiming(0, { duration: 200 });
    }
  }, [paletteOpen, sheetRise, slideDir, slideX]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetRise.value) * 400 }],
  }));

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timerWarning = secondsLeft > 60 && secondsLeft <= 300;
  const timerDanger = secondsLeft <= 60;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas'), justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Loading review...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Top bar */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
            {TOTAL > 0 ? `Question ${current + 1} of ${TOTAL}` : 'Review'}
          </Text>
          <View
            style={[
              styles.timerChip,
              {
                backgroundColor: timerDanger
                  ? color('semantic/danger')
                  : timerWarning
                    ? color('semantic/warning')
                    : color('bg/sunken'),
                borderRadius: radius.pill,
                paddingHorizontal: space.sm,
                paddingVertical: 4,
              },
            ]}
          >
            <Text
              style={[
                type['type/body-m-medium'],
                { color: timerDanger || timerWarning ? color('text/inverse') : color('text/primary') },
              ]}
            >
              {mm(secondsLeft)}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        {TOTAL > 0 ? (
          <View style={{ height: 3, backgroundColor: color('bg/sunken'), borderRadius: 2, marginTop: space.xs }}>
            <View
              style={{
                width: `${((current + 1) / TOTAL) * 100}%`,
                height: 3,
                backgroundColor: color('accent/default'),
                borderRadius: 2,
              }}
            />
          </View>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: space.md, maxHeight: 44, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}
      >
        {chips.map((c) => {
          const active = filter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => selectFilter(c.id)}
              style={{
                backgroundColor: active ? color('accent/default') : color('bg/sunken'),
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: 6,
              }}
            >
              <Text
                style={[
                  type['type/caption'],
                  { color: active ? color('accent/on-accent') : color('text/secondary') },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Question */}
      {TOTAL === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, gap: space.xs }}>
          <Check size={28} color={color('semantic/success')} weight="duotone" />
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
            Nothing here — you got every question right.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.lg }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={slideStyle}>
              <ReviewCard q={q} />
            </Animated.View>
          </ScrollView>

          {/* Bottom bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: color('bg/surface'),
                borderTopColor: color('border/subtle'),
                borderTopWidth: 1,
                paddingHorizontal: space.md,
                paddingTop: space.sm,
                paddingBottom: space.sm + insets.bottom,
              },
            ]}
          >
            {current > 0 ? (
              <SecondaryButton label="Previous" onPress={goPrev} />
            ) : (
              <View style={{ width: 100 }} />
            )}
            <Pressable
              onPress={() => setPaletteOpen(true)}
              hitSlop={space.xs}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <GridFour size={26} color={color('text/primary')} />
            </Pressable>
            <PrimaryButton
              label={current >= TOTAL - 1 ? 'Done' : 'Next'}
              onPress={() => (current >= TOTAL - 1 ? router.back() : goNext())}
            />
          </View>
        </>
      )}

      {/* Review Palette sheet */}
      {paletteOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            onPress={() => setPaletteOpen(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: color('bg/surface'),
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                padding: space.lg,
                paddingBottom: space.lg + insets.bottom,
              },
              sheetStyle,
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={[type['type/h3'], { color: color('text/primary'), marginTop: space.md }]}>
              Review Palette
            </Text>
            <View style={[styles.legendRow, { gap: space.md, marginTop: space.sm }]}>
              <LegendDot color={color('semantic/success')} label="Correct" filled />
              <LegendDot color={color('semantic/danger')} label="Incorrect" filled />
              <LegendDot color={color('border/strong')} label="Unattempted" />
            </View>
            <View style={[styles.paletteGrid, { marginTop: space.md, gap: space.sm }]}>
              {questions.map((item) => {
                const st = status(item);
                const isCurrent = item.n === q?.n;
                const fill =
                  st === 'correct'
                    ? color('semantic/success')
                    : st === 'incorrect'
                      ? color('semantic/danger')
                      : color('bg/sunken');
                return (
                  <Pressable
                    key={item.n}
                    onPress={() => jumpToQuestion(item.n)}
                    style={[
                      styles.chip,
                      {
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: fill,
                        borderWidth: isCurrent ? 2 : 1,
                        borderColor: isCurrent ? color('accent/default') : color('border/strong'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type['type/body-m-medium'],
                        { color: st === 'unattempted' ? color('text/secondary') : color('text/inverse') },
                      ]}
                    >
                      {item.n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ReviewCard({ q }: { q: ReviewQuestion }) {
  const { color, type, space, radius } = useTheme();
  const st = status(q);

  const badgeMap = {
    correct: { text: 'Correct', bg: color('semantic/success'), fg: color('text/inverse') },
    incorrect: { text: 'Incorrect', bg: color('semantic/danger'), fg: color('text/inverse') },
    unattempted: { text: 'Unattempted', bg: color('bg/sunken'), fg: color('text/tertiary') },
  } as const;
  const badge = badgeMap[st];

  return (
    <View
      style={[
        {
          backgroundColor: color('bg/surface'),
          borderRadius: radius.lg,
          padding: space.lg,
        },
        shadow(),
      ]}
    >
      <View style={[styles.overlineRow, { marginBottom: space.sm }]}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
          QUESTION {q.n}
        </Text>
        <View
          style={{
            backgroundColor: badge.bg,
            borderRadius: radius.pill,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={[type['type/caption'], { color: badge.fg }]}>{badge.text}</Text>
        </View>
      </View>

      <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{q.text}</Text>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIdx;
          const isPicked = i === q.pickedIdx;
          const showCorrect = isCorrect;
          const showWrong = isPicked && !isCorrect;
          const border = showCorrect
            ? color('semantic/success')
            : showWrong
              ? color('semantic/danger')
              : color('border/subtle');
          const bg = showCorrect
            ? color('semantic/success')
            : showWrong
              ? color('semantic/danger')
              : color('bg/surface');
          return (
            <View
              key={i}
              style={[
                styles.optionRow,
                {
                  backgroundColor: showCorrect || showWrong ? bg + '22' : color('bg/surface'),
                  borderRadius: radius.md,
                  borderWidth: showCorrect || showWrong ? 2 : 1.5,
                  borderColor: border,
                  padding: space.md,
                  minHeight: 52,
                },
              ]}
            >
              <View
                style={[
                  styles.letterBadge,
                  {
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isCorrect || isPicked ? border : color('bg/sunken'),
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text
                  style={[
                    type['type/body-m-medium'],
                    {
                      color: isCorrect || isPicked ? color('text/inverse') : color('text/secondary'),
                    },
                  ]}
                >
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text
                style={[
                  type['type/body-l'],
                  { color: color('text/primary'), flex: 1, marginLeft: space.sm },
                ]}
              >
                {opt}
              </Text>
              {showCorrect ? (
                <Check size={20} color={color('semantic/success')} weight="bold" />
              ) : showWrong ? (
                <X size={20} color={color('semantic/danger')} weight="bold" />
              ) : null}
            </View>
          );
        })}
      </View>

      {q.explanation ? (
        <View
          style={{
            backgroundColor: color('bg/sunken'),
            borderRadius: radius.md,
            padding: space.md,
            marginTop: space.md,
          }}
        >
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 6 }]}>
            EXPLANATION
          </Text>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{q.explanation}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({
  color: ink,
  label,
  filled,
}: {
  color: string;
  label: string;
  filled?: boolean;
}) {
  const { type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: filled ? ink : 'transparent',
          borderWidth: 1,
          borderColor: ink,
        }}
      />
      <Text style={[type['type/caption'], { color: ink }]}>{label}</Text>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerChip: {},
  overlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  letterBadge: {},
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {},
});

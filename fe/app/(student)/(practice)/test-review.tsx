import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Check, WarningCircle, X } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttemptReview } from '@/src/api/attempts';
import type { ReviewItem } from '@/src/api/attempts';
import type { StudentAttempt } from '@/src/api/attempts';

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

type Filter = 'all' | 'incorrect' | 'correct' | 'unattempted';

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 260 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function TestReviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getAttemptReview(id as string);
      const mapped: ReviewQuestion[] = res.review.map((r, i) => ({
        n: i + 1,
        text: r.question_text,
        options: [r.option_a, r.option_b, r.option_c, r.option_d],
        correctIdx: r.correct_option.charCodeAt(0) - 65,
        pickedIdx: r.selected_option ? r.selected_option.charCodeAt(0) - 65 : undefined,
        explanation: r.explanation || undefined,
      }));
      setQuestions(mapped);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load review', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const [filter, setFilter] = useState<Filter>('all');
  const [fadeKey, setFadeKey] = useState(0);

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

  const fade = useSharedValue(1);
  useEffect(() => {
    fade.value = 0;
    const t1 = setTimeout(() => {
      fade.value = withTiming(1, { duration: 150 });
      setFadeKey((k) => k + 1);
    }, 80);
    return () => clearTimeout(t1);
  }, [filter, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <View style={{ marginLeft: space.xs }}>
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>Review</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
              Test Review
            </Text>
          </View>
        </View>
      </View>

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
              onPress={() => setFilter(c.id)}
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

      <ScrollView
        key={fadeKey}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom, gap: space.lg, paddingTop: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={fadeStyle}>
          {loading ? (
            <View style={{ gap: space.lg }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View
                  key={i}
                  style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, gap: space.sm }}
                >
                  <SkeletonBlock width={120} height={16} radius={radius.sm} />
                  <SkeletonBlock height={48} radius={radius.md} />
                  <SkeletonBlock height={52} radius={radius.md} />
                  <SkeletonBlock height={52} radius={radius.md} />
                </View>
              ))}
            </View>
          ) : loadError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load review"
              description="Something went wrong fetching your test review."
              action={<TextButton label="Retry" onPress={load} />}
            />
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
              <Check size={28} color={color('semantic/success')} weight="duotone" />
              <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
                Nothing here \u2014 you got every question right.
              </Text>
            </View>
          ) : (
            filtered.map((q, i) => (
              <Stagger key={q.n} delayMs={i * 50}>
                <ReviewCard q={q} />
              </Stagger>
            ))
          )}
        </Animated.View>
      </ScrollView>
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  overlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  letterBadge: {},
});

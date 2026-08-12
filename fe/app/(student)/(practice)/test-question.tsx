import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { X, GridFour, CaretLeft, CaretRight } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Question = {
  id: string;
  text: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'A gas undergoes an isothermal expansion. Which of the following remains constant?',
    options: ['Internal energy', 'Pressure', 'Volume', 'Temperature and internal energy'],
  },
  {
    id: 'q2',
    text: 'For an adiabatic process, the first law of thermodynamics reduces to:',
    options: ['Q = W', 'ΔU = 0', 'ΔU = -W', 'Q = ΔU + W'],
  },
  {
    id: 'q3',
    text: 'The efficiency of a Carnot engine operating between 400 K and 300 K is:',
    options: ['25%', '33%', '50%', '75%'],
  },
  {
    id: 'q4',
    text: 'In which thermodynamic process is work done by the gas zero?',
    options: ['Isothermal', 'Adiabatic', 'Isochoric', 'Isobaric'],
  },
  {
    id: 'q5',
    text: 'The second law of thermodynamics states that:',
    options: [
      'Energy is conserved',
      'Entropy of an isolated system never decreases',
      'Heat flows from cold to hot spontaneously',
      'Work can be fully converted to heat',
    ],
  },
];

const TOTAL = QUESTIONS.length;
const TOTAL_SECONDS = 25 * 60;

export default function TestQuestionRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const slideX = useSharedValue(0);
  const sheetRise = useSharedValue(0);

  const timed = true;
  const q = QUESTIONS[current];

  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          router.push({
            pathname: '/(student)/(practice)/test-submit-confirm',
            params: { id: id ?? '1', expired: '1' },
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timed, router, id]);

  const selectOption = (optIdx: number) => {
    setAnswers((a) => ({ ...a, [current]: optIdx }));
  };

  const clearResponse = () => {
    setAnswers((a) => {
      const copy = { ...a };
      delete copy[current];
      return copy;
    });
  };

  const goNext = () => {
    if (current >= TOTAL - 1) {
      router.push({ pathname: '/(student)/(practice)/test-submit-confirm', params: { id: id ?? '1' } });
      return;
    }
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

  const jumpTo = (idx: number) => {
    setPaletteOpen(false);
    setSlideDir(idx > current ? 1 : -1);
    slideX.value = 0;
    setCurrent(idx);
  };

  const answeredCount = Object.keys(answers).length;
  const selectedOpt = answers[current];
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timerWarning = timed && secondsLeft <= 300 && secondsLeft > 60;
  const timerDanger = timed && secondsLeft <= 60 && secondsLeft > 0;

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetRise.value) * 400 }],
  }));

  useEffect(() => {
    if (paletteOpen) {
      sheetRise.value = withTiming(1, { duration: 260 });
      slideX.value = withTiming(slideDir * 12, { duration: 200 });
    } else {
      sheetRise.value = withTiming(0, { duration: 200 });
    }
  }, [paletteOpen, sheetRise, slideDir, slideX]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Top bar */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setExitOpen(true)}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <X size={24} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
            Question {current + 1} of {TOTAL}
          </Text>
          {timed ? (
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
                  {
                    color: timerDanger || timerWarning ? color('text/inverse') : color('text/primary'),
                  },
                ]}
              >
                {mm(secondsLeft)}
              </Text>
            </View>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>
        {/* Progress bar */}
        <View
          style={{
            height: 3,
            backgroundColor: color('bg/sunken'),
            borderRadius: 2,
            marginTop: space.xs,
          }}
        >
          <View
            style={{
              width: `${((current + 1) / TOTAL) * 100}%`,
              height: 3,
              backgroundColor: color('accent/default'),
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      {/* Question + options */}
      <View style={{ flex: 1, paddingHorizontal: space.md, marginTop: space.xl }}>
        <Animated.View style={slideStyle}>
          <View
            style={[
              styles.questionCard,
              {
                backgroundColor: color('bg/surface'),
                borderRadius: radius.lg,
                padding: space.lg,
              },
              shadow(),
            ]}
          >
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              QUESTION {current + 1}
            </Text>
            <Text
              style={[type['type/body-l'], { color: color('text/primary'), marginTop: space['2xs'] }]}
            >
              {q.text}
            </Text>
          </View>

          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {q.options.map((opt, i) => {
              const isSel = selectedOpt === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => selectOption(i)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: isSel ? color('accent/tint') : color('bg/surface'),
                      borderRadius: radius.md,
                      borderWidth: isSel ? 2 : 1.5,
                      borderColor: isSel ? color('accent/default') : color('border/subtle'),
                      padding: space.md,
                      minHeight: 56,
                      opacity: pressed ? 0.94 : 1,
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
                        backgroundColor: isSel ? color('accent/default') : color('bg/sunken'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type['type/body-m-medium'],
                        { color: isSel ? color('accent/on-accent') : color('text/secondary') },
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
                </Pressable>
              );
            })}
          </View>

          {selectedOpt != null ? (
            <View style={{ alignItems: 'center', marginTop: space.sm }}>
              <TextButton label="Clear my response" onPress={clearResponse} />
            </View>
          ) : null}
        </Animated.View>
      </View>

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
          label={current >= TOTAL - 1 ? 'Review & Submit' : 'Next'}
          onPress={goNext}
        />
      </View>

      {/* Question Palette sheet */}
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
              Question Palette
            </Text>
            <View style={[styles.legendRow, { gap: space.md, marginTop: space.sm }]}>
              <LegendDot color={color('accent/default')} label="Answered" filled />
              <LegendDot color={color('border/strong')} label="Unanswered" />
              <LegendDot color={color('accent/default')} label="Current" ring />
            </View>
            <View style={[styles.paletteGrid, { marginTop: space.md, gap: space.sm }]}>
              {Array.from({ length: TOTAL }).map((_, i) => {
                const answered = answers[i] != null;
                const isCurrent = i === current;
                return (
                  <Pressable
                    key={i}
                    onPress={() => jumpTo(i)}
                    style={[
                      styles.chip,
                      {
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: answered ? color('accent/default') : color('bg/sunken'),
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
                        {
                          color: answered ? color('text/inverse') : color('text/secondary'),
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <PrimaryButton
              label="Submit Test"
              onPress={() => {
                setPaletteOpen(false);
                router.push({ pathname: '/(student)/(practice)/test-submit-confirm', params: { id: id ?? '1' } });
              }}
              style={{ marginTop: space.lg }}
            />
          </Animated.View>
        </View>
      ) : null}

      {/* Exit confirmation */}
      {exitOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            onPress={() => setExitOpen(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          />
          <View
            style={{
              position: 'absolute',
              top: '35%',
              left: space.lg,
              right: space.lg,
              backgroundColor: color('bg/surface'),
              borderRadius: radius.lg,
              padding: space.lg,
              gap: space.sm,
            }}
          >
            <Text style={[type['type/h2'], { color: color('text/primary') }]}>Exit test?</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              Your answers are saved \u2014 you can resume anytime from Practice.
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
              <SecondaryButton label="Exit" onPress={() => router.replace('/(student)/(practice)')} />
              <PrimaryButton label="Stay" onPress={() => setExitOpen(false)} />
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function LegendDot({
  color: ink,
  label,
  filled,
  ring,
}: {
  color: string;
  label: string;
  filled?: boolean;
  ring?: boolean;
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
          borderWidth: ring ? 2 : 1,
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
  questionCard: {},
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  letterBadge: {},
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CFCCC3',
    alignSelf: 'center',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {},
});

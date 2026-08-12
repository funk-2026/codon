import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Check } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const INSTRUCTIONS_TIMED = [
  'Once started, a timed test\u2019s clock cannot be paused.',
  'You can move between questions freely and change your answers anytime before submitting.',
  'Unanswered questions score zero \u2014 they\u2019re not counted as wrong.',
  'You can end the test early from the question palette.',
];
const INSTRUCTIONS_UNTIMED = [
  'This is untimed \u2014 take the time you need.',
  'You can move between questions freely and change your answers anytime before submitting.',
  'Unanswered questions score zero \u2014 they\u2019re not counted as wrong.',
  'You can end the test early from the question palette.',
];

type TestKind = 'qbank' | 'test_series' | 'practice';

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

export default function TestPreStartRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();

  const isResume = kind === 'resume';
  const timed = true;
  const moduleType: TestKind = 'test_series';
  const moduleLabel = moduleType === 'test_series' ? 'Test Series' : moduleType === 'qbank' ? 'Q Bank' : 'Practice';

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const instructions = timed ? INSTRUCTIONS_TIMED : INSTRUCTIONS_UNTIMED;

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
          <View style={{ flex: 1, marginLeft: space.xs }}>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
              NEET UG · Physics · Thermodynamics
            </Text>
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>
              Thermodynamics Full Chapter Test
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: color('bg/surface'),
                borderRadius: radius.lg,
                padding: space.md,
                marginTop: space.xl,
              },
              shadow(),
            ]}
          >
            {loading ? (
              <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Loading\u2026</Text>
              </View>
            ) : (
              <View>
                <View style={styles.statGrid}>
                  <StatCell label="Questions" value="20" />
                  <View style={{ width: 1, backgroundColor: color('border/subtle') }} />
                  <StatCell label="Duration" value={timed ? '25 min' : 'Untimed'} />
                </View>
                <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.sm }} />
                <View style={styles.statGrid}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: 4 }]}>
                      Marking
                    </Text>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                      <Text style={{ color: color('semantic/success') }}>+4</Text>
                      {' / '}
                      <Text style={{ color: color('semantic/danger') }}>-1</Text>
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: color('border/subtle') }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: 4 }]}>
                      Type
                    </Text>
                    <View
                      style={{
                        backgroundColor: color('accent/tint'),
                        borderRadius: radius.pill,
                        paddingHorizontal: space.sm,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                        {moduleLabel}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Stagger>

        {isResume ? (
          <Stagger delayMs={80}>
            <View
              style={[
                styles.resumeCallout,
                {
                  backgroundColor: color('accent/tint'),
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  marginTop: space.md,
                },
              ]}
            >
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                You answered 7 of 20 questions. Pick up where you left off.
              </Text>
            </View>
          </Stagger>
        ) : null}

        <Stagger delayMs={160}>
          <View style={{ marginTop: space.xl }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
              BEFORE YOU START
            </Text>
            <View style={{ gap: space.sm }}>
              {instructions.map((line, i) => (
                <View key={i} style={[styles.instructionRow, { gap: space.sm }]}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: color('accent/tint'),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} color={color('accent/default')} weight="bold" />
                  </View>
                  <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Stagger>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: space.md,
            paddingBottom: space.lg + insets.bottom,
            backgroundColor: color('bg/canvas'),
          },
        ]}
      >
        <PrimaryButton
          label={isResume ? 'Resume Test' : 'Start Test'}
          onPress={() => router.push({ pathname: '/(student)/(practice)/test-question', params: { id: id ?? '1' } })}
        />
      </View>
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: 4 }]}>
        {label}
      </Text>
      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{value}</Text>
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
  statCard: {},
  statGrid: { flexDirection: 'row', alignItems: 'center' },
  resumeCallout: {},
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start' },
  footer: {},
});

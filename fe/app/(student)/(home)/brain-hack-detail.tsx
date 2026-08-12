import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft } from 'phosphor-react-native';
import { TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Hack = { id: string; title: string; tag: string; readMins: number; body: string };

const HACKS: Record<string, Hack> = {
  '1': {
    id: '1',
    title: 'Beat exam-day anxiety in 5 minutes',
    tag: 'Exam Day',
    readMins: 3,
    body: `Exam-day nerves aren't a sign you're unprepared — they're a sign your body is readying for something that matters to you. The trick is turning that arousal into focus instead of letting it spiral.

Here's a technique you can run in the five minutes before the bell:

1. Inhale through your nose for four counts.
2. Hold for four counts.
3. Exhale through your mouth for six counts — longer than the inhale, on purpose. The long exhale is what downshifts your nervous system.
4. Repeat four rounds. That's under two minutes.

Then one framing line, said to yourself, not just thought: "I don't have to know every answer. I have to know the ones I know, and not lose them to panic."

That's it. The breathing is mechanical, repeatable, and works whether you believe in it or not. The framing line is specific — it doesn't tell you to "stay calm" (which never works when you're already not calm). It tells you what to actually do when a question you don't know appears: move on, protect the marks you can earn.

Run this in the corridor before you walk in. Run it again if your hand shakes halfway through. It works because it's small, concrete, and yours.`,
  },
};

const DEFAULT_HACK: Hack = {
  id: '0',
  title: 'Brain Hack',
  tag: 'Focus',
  readMins: 2,
  body: 'A short, practical tip will appear here.',
};

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function BrainHackDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);

  const hack = (id && HACKS[id]) || DEFAULT_HACK;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={{ marginTop: space.lg }}>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: color('accent/tint'),
                  borderRadius: radius.pill,
                  paddingHorizontal: space.sm,
                  paddingVertical: 4,
                  alignSelf: 'flex-start',
                },
              ]}
            >
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                {hack.tag}
              </Text>
            </View>
            <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.xs }]}>
              {hack.title}
            </Text>
            <Text
              style={[
                type['type/caption'],
                { color: color('text/tertiary'), marginTop: space['2xs'] },
              ]}
            >
              {hack.readMins} min read
            </Text>
          </View>
        </Stagger>

        <Stagger delayMs={120}>
          <View style={{ marginTop: space.lg }}>
            {loading ? (
              <View style={{ gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      height: 16,
                      borderRadius: 6,
                      backgroundColor: color('bg/sunken'),
                      width: i === 3 ? '60%' : '100%',
                    }}
                  />
                ))}
              </View>
            ) : (
              <Text style={[type['type/body-l'], { color: color('text/primary') }]}>
                {hack.body}
              </Text>
            )}
          </View>
        </Stagger>

        <View style={{ marginTop: space.xl, alignItems: 'center' }}>
          <TextButton label="Back to Brain Hacks" onPress={() => router.replace('/(student)/(home)/brain-hacks')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pill: {},
});

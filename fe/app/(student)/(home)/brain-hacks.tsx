import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Sparkle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

type Hack = { id: string; title: string; tag: string };

const HACKS: Hack[] = [
  { id: '1', title: 'Beat exam-day anxiety in 5 minutes', tag: 'Exam Day' },
  { id: '2', title: 'The 2-minute recall trick', tag: 'Memory' },
  { id: '3', title: 'How to read a question twice, not once', tag: 'Focus' },
  { id: '4', title: 'Build a study playlist that actually helps', tag: 'Focus' },
  { id: '5', title: 'What to eat before a 3-hour test', tag: 'Exam Day' },
  { id: '6', title: 'The Pomodoro method, adapted for NEET prep', tag: 'Focus' },
];

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

export default function BrainHacksListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);

  const GRID_GAP = space.sm;
  const cardWidth = (screenWidth - space.md * 2 - GRID_GAP) / 2;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const empty = HACKS.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.xs }]}>
            Free Brain Hacks.
          </Text>
        </View>
        <Text
          style={[
            type['type/body-m'],
            { color: color('text/secondary'), marginTop: space['2xs'], marginLeft: 32 },
          ]}
        >
          Quick, practical tips — no course or subscription needed.
        </Text>
      </View>

      {loading ? (
        <View style={[styles.grid, { paddingHorizontal: space.md, marginTop: space.lg, gap: space.sm }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: cardWidth,
                backgroundColor: color('bg/surface'),
                borderRadius: radius.md,
                padding: space.sm,
                minHeight: 150,
                opacity: 0.6,
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: color('bg/sunken') }} />
              <View style={{ height: 14, backgroundColor: color('bg/sunken'), borderRadius: 6, marginTop: space.sm, width: '90%' }} />
              <View style={{ height: 14, backgroundColor: color('bg/sunken'), borderRadius: 6, marginTop: 6, width: '60%' }} />
              <View style={{ height: 12, backgroundColor: color('bg/sunken'), borderRadius: 6, marginTop: space.sm, width: '40%' }} />
            </View>
          ))}
        </View>
      ) : empty ? (
        <View style={{ alignItems: 'center', paddingVertical: space['3xl'], gap: space.xs }}>
          <Sparkle size={32} color={color('text/tertiary')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
            New Brain Hacks are on the way — check back soon.
          </Text>
        </View>
      ) : (
        <View style={[styles.grid, { paddingHorizontal: space.md, marginTop: space.lg, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }]}>
          {HACKS.map((h, i) => (
            <Stagger key={h.id} delayMs={i * 60}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(student)/(home)/brain-hack-detail',
                    params: { id: h.id },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  {
                    width: cardWidth,
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.md,
                    padding: space.sm,
                    opacity: pressed ? 0.94 : 1,
                  },
                  shadow(),
                ]}
              >
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: color('accent/tint'), borderRadius: radius.sm },
                  ]}
                >
                  <Sparkle size={24} color={color('accent/default')} weight="duotone" />
                </View>
                <Text
                  style={[type['type/h3'], { color: color('text/primary'), marginTop: space.xs, fontSize: 15 }]}
                  numberOfLines={2}
                >
                  {h.title}
                </Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 4 }]}>
                  {h.tag}
                </Text>
              </Pressable>
            </Stagger>
          ))}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { minHeight: 150 },
  cardIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});

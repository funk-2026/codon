import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { CaretLeft } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

const PILLARS = [
  {
    label: 'MIND',
    phrase: 'Clarity before pressure.',
    body: "Exam stress isn't a character flaw — it's what a mind under sustained pressure does. Mind is about giving that pressure somewhere honest to go: naming it, understanding it, and building the small habits that keep your thinking clear when it matters most.",
  },
  {
    label: 'MENTOR',
    phrase: 'Guidance, not just information.',
    body: "A mentor doesn't just hand you facts — they help you make sense of where you are and what's next. Codon is built to play that role in the moments a real mentor isn't in the room: steady guidance woven into your everyday study routine, not a separate appointment you have to make time for.",
  },
  {
    label: 'MITRA',
    phrase: 'A friend, not a judge.',
    body: "Mitra means friend. Nothing in this app is here to grade how you feel, rank your resilience, or compare you to anyone else. It's here the way a good friend is — present, honest, and on your side, especially on the days that are harder than the rest.",
  },
];

function RevealBlock({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const y = useSharedValue(20);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));
  return (
    <Animated.View
      style={style}
      onLayout={() => {
        opacity.value = withTiming(1, { duration: 400 });
        y.value = withTiming(0, { duration: 400 });
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function AboutMmmRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('wellness/bg') }]}>
      <View style={[styles.topBar, { paddingHorizontal: space.lg, marginTop: space.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('wellness/text-primary')} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <RevealBlock>
          <View style={{ alignItems: 'center', marginTop: space.xl }}>
            <OrbitTriad color={color('wellness/accent')} size={72} />
          </View>
        </RevealBlock>

        <RevealBlock>
          <View style={{ alignItems: 'center', marginTop: space.lg }}>
            <Text style={[type['type/overline'], { color: color('wellness/accent') }]}>OUR PRINCIPLE</Text>
            <Text
              style={[type['type/display'], { color: color('wellness/text-primary'), marginTop: space['2xs'] }]}
            >
              MMM
            </Text>
            <Text
              style={[type['type/h3'], { color: color('text/secondary'), marginTop: space['2xs'] }]}
            >
              Mind. Mentor. Mitra.
            </Text>
          </View>
        </RevealBlock>

        <View style={{ marginTop: space['2xl'], gap: space.xl }}>
          {PILLARS.map((p) => (
            <RevealBlock key={p.label}>
              <View>
                <Text style={[type['type/overline'], { color: color('wellness/accent') }]}>{p.label}</Text>
                <Text
                  style={[type['type/h2'], { color: color('wellness/text-primary'), marginTop: space.xs }]}
                >
                  {p.phrase}
                </Text>
                <Text
                  style={[type['type/body-l'], { color: color('wellness/text-primary'), marginTop: space.xs, lineHeight: 26 }]}
                >
                  {p.body}
                </Text>
              </View>
            </RevealBlock>
          ))}
        </View>

        <RevealBlock>
          <Text
            style={[type['type/h2'], { color: color('wellness/text-primary'), textAlign: 'center', marginTop: space['2xl'] }]}
          >
            You are not behind. One step at a time.
          </Text>
        </RevealBlock>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrbitTriad({ color: ink, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      {[0, 120, 240].map((angle) => (
        <G key={angle} transform={`rotate(${angle} 36 36)`}>
          <Circle cx={36} cy={12} r={5} fill={ink} />
        </G>
      ))}
      <Circle cx={36} cy={36} r={22} stroke={ink} strokeWidth={2} fill="none" opacity={0.6} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
});

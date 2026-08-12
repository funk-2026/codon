import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Flame } from 'phosphor-react-native';
import RNSvg, { Line, Polygon, Polyline } from 'react-native-svg';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const TREND = [42, 55, 48, 61, 58, 70, 65, 74, 71, 78];
const SUBJECTS = [
  { name: 'Physics', accuracy: 78 },
  { name: 'Chemistry', accuracy: 71 },
  { name: 'Botany', accuracy: 84 },
  { name: 'Zoology', accuracy: 66 },
];
const LAST_7_DAYS = [true, true, false, true, true, true, true];

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

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function ProgressDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const chartWidth = 320;
  const chartHeight = 100;
  const max = 100;
  const points = TREND.map((v, i) => {
    const x = (i / (TREND.length - 1)) * chartWidth;
    const y = chartHeight - (v / max) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Your Progress
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={[styles.statRow, { gap: space.xs, marginTop: space.xl }]}>
            {loading ? (
              <>
                <SkeletonBlock height={72} radius={radius.md} style={{ flex: 1 }} />
                <SkeletonBlock height={72} radius={radius.md} style={{ flex: 1 }} />
                <SkeletonBlock height={72} radius={radius.md} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                <StatTile label="Tests Taken" value="24" />
                <StatTile label="Avg. Score" value="78%" />
                <StatTile label="Day Streak" value="12" />
              </>
            )}
          </View>
        </Stagger>

        <Stagger delayMs={80}>
          <View style={{ marginTop: space.xl }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
              LAST 10 ATTEMPTS
            </Text>
            {loading ? (
              <SkeletonBlock height={140} radius={radius.lg} />
            ) : (
              <View
                style={[
                  { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md },
                  shadow(),
                ]}
              >
                <Svg width={chartWidth} height={chartHeight} points={points} lineColor={color('accent/default')} fillColor={color('accent/tint')} gridColor={color('border/subtle')} />
              </View>
            )}
          </View>
        </Stagger>

        <Stagger delayMs={160}>
          <View style={{ marginTop: space.xl }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
              BY SUBJECT
            </Text>
            <View style={{ gap: space.xs }}>
              {SUBJECTS.map((s) => (
                <View
                  key={s.name}
                  style={[
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm },
                    shadow(),
                  ]}
                >
                  <View style={styles.subjectRow}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>{s.name}</Text>
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                      {s.accuracy}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: color('bg/sunken'),
                      borderRadius: 3,
                      marginTop: space.xs,
                    }}
                  >
                    <View
                      style={{
                        width: `${s.accuracy}%`,
                        height: 6,
                        backgroundColor: color('accent/default'),
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Stagger>

        <Stagger delayMs={240}>
          <View style={{ marginTop: space.xl }}>
            <View
              style={[
                { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg },
                shadow(),
              ]}
            >
              <View style={styles.streakRow}>
                <Flame size={28} color={color('semantic/warning')} weight="fill" />
                <Text
                  style={[type['type/numeral-display'], { color: color('text/primary'), marginLeft: space.sm }]}
                >
                  12
                </Text>
                <Text style={[type['type/body-m'], { color: color('text/secondary'), marginLeft: space.xs }]}>
                  day streak
                </Text>
              </View>
              <View style={[styles.dotsRow, { gap: space.xs, marginTop: space.md }]}>
                {LAST_7_DAYS.map((active, i) => (
                  <View
                    key={i}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      backgroundColor: active ? color('accent/default') : 'transparent',
                      borderWidth: active ? 0 : 1,
                      borderColor: color('bg/sunken'),
                    }}
                  />
                ))}
              </View>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}>
                Best streak: 23 days
              </Text>
            </View>
          </View>
        </Stagger>
      </ScrollView>
    </SafeAreaView>
  );
}

function Svg({
  width,
  height,
  points,
  lineColor,
  fillColor,
  gridColor,
}: {
  width: number;
  height: number;
  points: string;
  lineColor: string;
  fillColor: string;
  gridColor: string;
}) {
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <RNSvg width={width} height={height}>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={0} y1={height * f} x2={width} y2={height * f} stroke={gridColor} strokeWidth={1} />
      ))}
      <Polygon points={fillPoints} fill={fillColor} stroke="none" />
      <Polyline points={points} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </RNSvg>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color('bg/surface'),
        borderRadius: radius.md,
        padding: space.sm,
      }}
    >
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 26 }]}>
        {value}
      </Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  statRow: { flexDirection: 'row' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  dotsRow: { flexDirection: 'row' },
});

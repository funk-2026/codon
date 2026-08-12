import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import RNSvg, { G, Rect } from 'react-native-svg';
import { CaretLeft } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Range = '7D' | '30D' | 'All Time';

const RANGES: Range[] = ['7D', '30D', 'All Time'];

const REVENUE_BARS = [4, 6, 5, 8, 7, 9, 6];
const STUDENT_BARS = [5, 6, 6, 8, 7, 9, 8];
const TEACHER_BARS = [1, 1, 0, 1, 0, 1, 1];

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function BarChart({
  series,
  color: barColor,
  width,
  height,
}: {
  series: number[];
  color: string;
  width: number;
  height: number;
}) {
  const max = Math.max(...series, 1);
  const gap = 6;
  const barWidth = (width - gap * (series.length - 1)) / series.length;
  return (
    <RNSvg width={width} height={height}>
      {series.map((v, i) => {
        const barHeight = (v / max) * height;
        return (
          <Rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={4}
            fill={barColor}
          />
        );
      })}
    </RNSvg>
  );
}

function StackedBarChart({ width, height }: { width: number; height: number }) {
  const { color } = useTheme();
  const max = Math.max(...STUDENT_BARS.map((s, i) => s + TEACHER_BARS[i]), 1);
  const gap = 6;
  const barWidth = (width - gap * (STUDENT_BARS.length - 1)) / STUDENT_BARS.length;
  return (
    <RNSvg width={width} height={height}>
      {STUDENT_BARS.map((s, i) => {
        const t = TEACHER_BARS[i];
        const studentHeight = (s / max) * height;
        const teacherHeight = (t / max) * height;
        const x = i * (barWidth + gap);
        return (
          <G key={i}>
            <Rect x={x} y={height - studentHeight - teacherHeight} width={barWidth} height={studentHeight} rx={4} fill={color('accent/default')} />
            <Rect x={x} y={height - teacherHeight} width={barWidth} height={teacherHeight} rx={4} fill={color('semantic/warning')} />
          </G>
        );
      })}
    </RNSvg>
  );
}

export default function AnalyticsOverviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('7D');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const chartWidth = 320;

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
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          Analytics
        </Text>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.md, flexDirection: 'row', gap: space.xs }}>
        {RANGES.map((r) => {
          const active = range === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  paddingHorizontal: space.sm,
                  backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                  borderWidth: 1,
                  borderColor: active ? color('accent/default') : color('border/subtle'),
                },
              ]}
            >
              <Text style={[type['type/caption'], { color: active ? color('accent/default') : color('text/primary') }]}>
                {r}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid2, { gap: space.sm }]}>
          {loading ? (
            <>
              <SkeletonBlock height={84} radius={radius.md} style={styles.tile} />
              <SkeletonBlock height={84} radius={radius.md} style={styles.tile} />
              <SkeletonBlock height={84} radius={radius.md} style={styles.tile} />
              <SkeletonBlock height={84} radius={radius.md} style={styles.tile} />
            </>
          ) : (
            <>
              <StatTile label="New Users" value="186" delta="+12%" positive />
              <StatTile label="Revenue" value="₹42,986" delta="+8%" positive />
              <StatTile label="Active Subscriptions" value="342" delta="+3%" positive />
              <StatTile label="Tests Attempted" value="1,204" delta="-4%" positive={false} />
            </>
          )}
        </View>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            REVENUE
          </Text>
          {loading ? (
            <SkeletonBlock height={140} radius={radius.lg} />
          ) : (
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
              <BarChart series={REVENUE_BARS} color={color('accent/default')} width={chartWidth} height={100} />
            </View>
          )}
        </View>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            USER GROWTH
          </Text>
          {loading ? (
            <SkeletonBlock height={140} radius={radius.lg} />
          ) : (
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
              <StackedBarChart width={chartWidth} height={100} />
              <View style={[styles.legendRow, { gap: space.md, marginTop: space.sm }]}>
                <LegendItem label="Students" swatch={color('accent/default')} />
                <LegendItem label="Teachers" swatch={color('semantic/warning')} />
              </View>
            </View>
          )}
        </View>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            CONTENT LIBRARY
          </Text>
          {loading ? (
            <SkeletonBlock height={92} radius={radius.md} />
          ) : (
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}>
              <ContentStatRow label="Published Tests" value="86" />
              <Divider />
              <ContentStatRow label="Published Videos & Docs" value="142" />
              <Divider />
              <ContentStatRow label="Published Brain Hacks" value="34" />
              <Divider />
              <ContentStatRow label="Pending Review" value="6" warn />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value, delta, positive }: { label: string; value: string; delta: string; positive: boolean }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }]}>
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 22 }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{label}</Text>
      <Text
        style={[
          type['type/caption'],
          { color: positive ? color('semantic/success') : color('semantic/danger'), marginTop: 4 },
        ]}
      >
        {delta} vs last period
      </Text>
    </View>
  );
}

function ContentStatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{label}</Text>
      <Text style={[type['type/body-m-medium'], { color: warn ? color('semantic/warning') : color('text/primary') }]}>
        {value}
      </Text>
    </View>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: swatch }]} />
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginLeft: 6 }]}>{label}</Text>
    </View>
  );
}

function Divider() {
  const { color, space } = useTheme();
  return <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.xs }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  chip: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '48%' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
});

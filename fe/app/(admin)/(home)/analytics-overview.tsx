import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import RNSvg, { G, Rect } from 'react-native-svg';
import { CaretLeft } from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminAnalyticsOverview } from '@/src/api/admin';

type Range = '7D' | '30D' | 'All Time';

const RANGES: Range[] = ['7D', '30D', 'All Time'];

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

function StackedBarChart({ width, height, studentBars, teacherBars }: { width: number; height: number; studentBars: number[], teacherBars: number[] }) {
  const { color } = useTheme();
  const max = Math.max(...studentBars.map((s, i) => s + teacherBars[i]), 1);
  const gap = 6;
  const barWidth = (width - gap * (studentBars.length - 1)) / studentBars.length;
  return (
    <RNSvg width={width} height={height}>
      {studentBars.map((s, i) => {
        const t = teacherBars[i];
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
  const [loadError, setLoadError] = useState(false);
  const [range, setRange] = useState<Range>('7D');
  const [data, setData] = useState<any>({});

  const loadData = useCallback(() => {
    setLoading(true);
    adminAnalyticsOverview(range)
      .then(res => {
        setData(res);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

      {loadError ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
          <ErrorBanner onRetry={loadData} />
        </View>
      ) : null}

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
              <StatTile label="New Users" value={String(data?.new_users || 0)} delta={data?.new_users_delta || '0%'} positive={data?.new_users_positive ?? true} />
              <StatTile label="Revenue" value={`₹${data?.revenue?.toLocaleString('en-IN') || 0}`} delta={data?.revenue_delta || '0%'} positive={data?.revenue_positive ?? true} />
              <StatTile label="Active Subscriptions" value={String(data?.active_subscriptions || 0)} delta={data?.active_subscriptions_delta || '0%'} positive={data?.active_subscriptions_positive ?? true} />
              <StatTile label="Tests Attempted" value={String(data?.tests_attempted || 0)} delta={data?.tests_attempted_delta || '0%'} positive={data?.tests_attempted_positive ?? true} />
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
              <BarChart series={data?.revenue_bars || [0]} color={color('accent/default')} width={chartWidth} height={100} />
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
              <StackedBarChart width={chartWidth} height={100} studentBars={data?.student_bars || [0]} teacherBars={data?.teacher_bars || [0]} />
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
              <ContentStatRow label="Published Tests" value={String(data?.published_tests || 0)} />
              <Divider />
              <ContentStatRow label="Published Videos & Docs" value={String(data?.published_content || 0)} />
              <Divider />
              <ContentStatRow label="Published Brain Hacks" value={String(data?.published_brain_hacks || 0)} />
              <Divider />
              <ContentStatRow label="Pending Review" value={String(data?.pending_reviews || 0)} warn={data?.pending_reviews > 0} />
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

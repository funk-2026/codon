import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChartLineUp } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, ErrorBanner } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { useAreaCounts } from '@/src/home/useAreaCounts';
import { DailyLineChart } from '@/src/home/DailyLineChart';
import { ANALYSIS_AREAS, EXTRA_AREAS, type AnalysisArea } from '@/src/home/DetailedAnalysisCard';
import { ROUTES } from '@/src/navigation/routes';

const DAYS = 14;
const ALL_AREAS = [...ANALYSIS_AREAS, ...EXTRA_AREAS];
const UNIT: Record<AnalysisArea, string> = { schema: 'topics', qbank: 'modules solved', tests: 'tests taken', video: 'lectures completed', pulse: 'items read', flashcards: 'cards reviewed' };
const DONE_VERB: Record<AnalysisArea, string> = { schema: 'mark a topic Confident', qbank: 'finish a QBank module', tests: 'finish a test', video: 'complete a lecture', pulse: 'read a Pulse item', flashcards: 'review a flashcard' };

/**
 * One daily graph for an area, reached from Home. QBank and Test series count submitted tests per day.
 * Schema and Video lectures have no events to count yet, and say so instead of drawing an empty chart.
 */
export default function AnalyticsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { area: raw } = useLocalSearchParams<{ area?: string }>();
  const area: AnalysisArea = ALL_AREAS.some((a) => a.key === raw) ? (raw as AnalysisArea) : 'qbank';
  const title = ALL_AREAS.find((a) => a.key === area)!.label;
  const data = useAreaCounts(area);
  useRefetchOnFocus(data.refetch);
  const [selected, setSelected] = useState<number | null>(null);
  const { points, total, byDay, days } = data;
  const mod = data.supported;

  const openRow = (id: string) => {
    if (area === 'video') router.push({ pathname: ROUTES.student.videoPlayer, params: { id } });
    else if (area === 'schema') router.push({ pathname: ROUTES.student.schemaTopic, params: { id } });
    else if (area === 'pulse') router.push({ pathname: ROUTES.student.pulseReader, params: { id, subject: 'All' } });
    else if (area === 'qbank' || area === 'tests') router.push({ pathname: ROUTES.student.testPreStart, params: { id } });
  };
  const picked = selected != null ? days[selected] : null;
  const rows = picked ? byDay.get(picked.key) ?? [] : [];

  return (
    <Screen>
      <ScreenHeader title={`${title} analysis`} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }}>
        {!mod ? (
          <EmptyState
            icon={<ChartLineUp size={32} color={color('text/tertiary')} />}
            title="Nothing to show yet"
            description="This graph is not available yet."
          />
        ) : data.isPending ? (
          <SkeletonBlock height={220} radius={radius.lg} />
        ) : data.isError ? (
          <ErrorBanner onRetry={() => void data.refetch()} />
        ) : total === 0 ? (
          <EmptyState
            icon={<ChartLineUp size={32} color={color('text/tertiary')} />}
            title="No activity in the last 14 days"
            description={`When you ${DONE_VERB[area]}, it shows up here.`}
          />
        ) : (
          <>
            <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }}>
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>{UNIT[area][0].toUpperCase() + UNIT[area].slice(1)} per day</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginBottom: space.sm }]}>Last {DAYS} days · {total} in total</Text>
              <DailyLineChart points={points} selected={selected} onSelect={setSelected} unit={UNIT[area]} />
            </View>
            <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs }}>
              {picked ? (
                <>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{picked.key}: {rows.length} {UNIT[area]}</Text>
                  {rows.length === 0 ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Nothing finished that day.</Text> : rows.map((r) => (
                    <Pressable key={r.id} onPress={() => openRow(r.id)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{r.title}{r.pct != null ? ` · ${r.pct}%` : ''}</Text>
                      {r.where ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{r.where}</Text> : null}
                    </Pressable>
                  ))}
                </>
              ) : (
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Tap a point to see what you finished that day.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

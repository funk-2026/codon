import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAreaCounts } from '@/src/home/useAreaCounts';
import { MiniSpark } from '@/src/home/MiniSpark';
import { ANALYSIS_AREAS, type AnalysisArea } from '@/src/home/DetailedAnalysisCard';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const UNIT: Record<AnalysisArea, string> = { schema: 'topics', qbank: 'modules solved', tests: 'tests taken', video: 'lectures completed', pulse: 'items read', flashcards: 'cards reviewed' };

function Mini({ area, label }: { area: AnalysisArea; label: string }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const d = useAreaCounts(area);
  useRefetchOnFocus(d.refetch);
  return (
    <Pressable
      onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area } })}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${d.supported ? `${d.total} ${UNIT[area]} in the last 14 days` : 'No data yet'}. Open`}
      style={({ pressed }) => [{ width: '48.5%', backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{label}</Text>
      {!d.supported ? (
        <View style={{ height: 56, justifyContent: 'center' }}><Text style={[type['type/caption'], { color: color('text/tertiary') }]}>No data yet</Text></View>
      ) : d.isPending ? (
        <SkeletonBlock height={56} radius={radius.sm} />
      ) : d.total === 0 ? (
        <View style={{ height: 56, justifyContent: 'center' }}><Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Nothing in 14 days</Text></View>
      ) : (
        <MiniSpark points={d.points} />
      )}
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{d.supported ? `${d.total} ${UNIT[area]}, last 14 days` : 'Starts counting soon'}</Text>
    </Pressable>
  );
}

/** Four small graphs, one per area. Tap one for the full daily graph. */
export default function MyProgressRoute() {
  const { space } = useTheme();
  const order: AnalysisArea[] = ['qbank', 'tests', 'video', 'schema'];
  return (
    <Screen>
      <ScreenHeader title="My progress" />
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {order.map((a) => <Mini key={a} area={a} label={ANALYSIS_AREAS.find((x) => x.key === a)!.label === 'Video lectures' ? 'Videos' : ANALYSIS_AREAS.find((x) => x.key === a)!.label} />)}
        </View>
      </ScrollView>
    </Screen>
  );
}

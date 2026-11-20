import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, ChartLineUp } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

export const ANALYSIS_AREAS = [
  { key: 'schema', label: 'Schema' },
  { key: 'qbank', label: 'QBank' },
  { key: 'tests', label: 'Test series' },
  { key: 'video', label: 'Video lectures' },
] as const;
/** Pulse and Flashcards have their own blue analysis entries; they are not on the Home card. */
export const EXTRA_AREAS = [
  { key: 'pulse', label: 'Pulse' },
  { key: 'flashcards', label: 'Flashcards' },
] as const;
export type AnalysisArea = (typeof ANALYSIS_AREAS)[number]['key'] | (typeof EXTRA_AREAS)[number]['key'];

/** Home's way into My progress: one card, one place for every graph. */
export function DetailedAnalysisCard() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(ROUTES.student.myProgress)}
      accessibilityRole="button"
      accessibilityLabel="My progress. See how you are doing, day by day"
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
        <ChartLineUp size={26} color={color('accent/default')} weight="duotone" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>My progress</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]}>See how you are doing, day by day</Text>
      </View>
      <CaretRight size={20} color={color('text/tertiary')} />
    </Pressable>
  );
}

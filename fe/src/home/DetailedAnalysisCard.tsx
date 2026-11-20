import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretDown, CaretUp, ChartLineUp } from 'phosphor-react-native';
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

/** "See detailed analysis": one card that opens in place to four areas, each its own graph. */
export function DetailedAnalysisCard() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
          <ChartLineUp size={22} color={color('accent/default')} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>Detailed analysis</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>See how you are doing, day by day</Text>
        </View>
        {open ? <CaretUp size={18} color={color('text/tertiary')} /> : <CaretDown size={18} color={color('text/tertiary')} />}
      </Pressable>
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
          {ANALYSIS_AREAS.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => (a.key === 'tests' ? router.push(ROUTES.student.grandAnalysis) : router.push({ pathname: ROUTES.student.analytics, params: { area: a.key } }))}
              accessibilityRole="button"
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: color('accent/tint'), opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Blueprint, ClockCounterClockwise, Exam, Scales } from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';
import { Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const TILES: { kind: string; label: string; text: string; Icon: Icon }[] = [
  { kind: 'pattern', label: 'Paper Pattern', text: 'How the paper is set', Icon: Blueprint },
  { kind: 'past_paper', label: 'Past Year Papers', text: 'Earlier board papers', Icon: ClockCounterClockwise },
  { kind: 'practice_paper', label: 'Practice Question Papers', text: 'Papers to practise with', Icon: Exam },
  { kind: 'weightage', label: 'Weightage', text: 'Marks by chapter', Icon: Scales },
];

/** The Class 10 board-paper hub: four tiles, opened straight from Home with no class picker. */
export default function BoardPapersRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Sample Board Exam Paper" />
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] }}>
        <Text style={[type['type/h2'], { color: color('text/primary'), marginBottom: space.sm }]}>Class 10</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {TILES.map((t) => (
            <Pressable
              key={t.kind}
              onPress={() => router.push({ pathname: ROUTES.student.boardPaperList, params: { kind: t.kind } })}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}. ${t.text}`}
              style={({ pressed }) => [{ width: '48.5%', minHeight: 124, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, justifyContent: 'space-between', opacity: pressed ? 0.94 : 1 }, shadow()]}
            >
              <t.Icon size={30} color={color('accent/default')} weight="duotone" />
              <View>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{t.label}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{t.text}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

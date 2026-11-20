import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, ListChecks, Sliders, Trophy } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { ROUTES } from '@/src/navigation/routes';

/** The Custom Module heading of the MCQs tab: exactly three tiles. */
export function CustomTestsPanel() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const tiles = [
    { n: 1, label: 'Create a custom module', text: 'Pick subjects, chapters, number of questions and timer.', Icon: Sliders, href: ROUTES.student.customModule },
    { n: 2, label: 'Create a template', text: 'Build a template of subjects and settings to reuse for tests.', Icon: ListChecks, href: ROUTES.student.customTemplate },
    { n: 3, label: 'Challenges', text: 'Friends’ codes and test history.', Icon: Trophy, href: ROUTES.student.customChallenges },
  ] as const;
  return (
    <View style={{ gap: space.sm }}>
      {tiles.map((t) => (
        <Pressable key={t.n} onPress={() => router.push(t.href)} accessibilityRole="button" accessibilityLabel={`${t.label}. ${t.text}`} style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 84, opacity: pressed ? 0.94 : 1 }, shadow()]}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
            <t.Icon size={24} color={color('accent/default')} weight="duotone" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{t.label}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{t.text}</Text>
          </View>
          <CaretRight size={18} color={color('text/tertiary')} />
        </Pressable>
      ))}
    </View>
  );
}

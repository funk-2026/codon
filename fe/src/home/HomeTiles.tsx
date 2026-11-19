import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookmarkSimple, Cards, Pulse, TreeStructure } from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const TILES: { label: string; text: string; Icon: Icon; href: string }[] = [
  { label: 'Bookmarks', text: 'Saved questions', Icon: BookmarkSimple, href: ROUTES.student.bookmarks },
  { label: 'Schema', text: 'Topics and how often asked', Icon: TreeStructure, href: ROUTES.student.schema },
  { label: 'Flashcard', text: 'Quick recall', Icon: Cards, href: ROUTES.student.flashcards },
  { label: 'Pulse', text: 'One-minute revision', Icon: Pulse, href: ROUTES.student.pulse },
];

/** Four equal tiles in a 2 by 2 grid: Bookmarks and Schema on top, Flashcard and Pulse below. */
export function HomeTiles() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {TILES.map((t) => (
        <Pressable
          key={t.label}
          onPress={() => router.push(t.href as never)}
          accessibilityRole="button"
          accessibilityLabel={`${t.label}. ${t.text}`}
          style={({ pressed }) => [{ width: '48.5%', minHeight: 92, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, justifyContent: 'space-between', opacity: pressed ? 0.94 : 1 }, shadow()]}
        >
          <t.Icon size={28} color={color('accent/default')} weight="duotone" />
          <View>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{t.label}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{t.text}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

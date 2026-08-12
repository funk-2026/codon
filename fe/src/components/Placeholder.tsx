import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';

export type PlaceholderLink = { label: string; href: Href };

/**
 * Minimal placeholder used to scaffold the navigation shell. Each real screen
 * spec replaces the corresponding route's content later. Optional links keep
 * every downstream route reachable by tapping during scaffolding.
 */
export function Placeholder({
  title,
  links,
}: {
  title: string;
  links?: PlaceholderLink[];
}) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        contentContainerStyle={[styles.center, { padding: space.lg, gap: space.sm }]}
      >
        <Text
          style={[type['type/h2'], { color: color('text/primary'), marginBottom: space.md }]}
        >
          {title}
        </Text>
        {links?.map((link) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [
              styles.link,
              {
                backgroundColor: pressed ? color('accent/pressed') : color('accent/default'),
                borderRadius: radius.md,
                paddingVertical: space.sm,
                paddingHorizontal: space.lg,
              },
            ]}
          >
            <Text style={[type['type/body-m-medium'], { color: color('accent/on-accent') }]}>
              {link.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  link: { alignItems: 'center', minWidth: 220 },
});

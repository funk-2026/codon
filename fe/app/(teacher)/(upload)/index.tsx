import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipboardText, VideoCamera, Lightbulb, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

type Option = { label: string; description: string; icon: React.ReactNode; href: Href };

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function UploadHubRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();

  const options: Option[] = [
    {
      label: 'New Test',
      description: 'Q Bank, Test Series, or Practice — build questions one at a time or bulk-upload via CSV.',
      icon: <ClipboardText size={26} color={color('accent/default')} weight="duotone" />,
      href: '/(teacher)/(upload)/create-test',
    },
    {
      label: 'New Video / Document',
      description: 'Upload a video lecture or write a document lesson for a chapter.',
      icon: <VideoCamera size={26} color={color('accent/default')} weight="duotone" />,
      href: '/(teacher)/(upload)/create-content',
    },
    {
      label: 'New Brain Hack',
      description: 'A short, practical tip — no course attachment needed.',
      icon: <Lightbulb size={26} color={color('accent/default')} weight="duotone" />,
      href: '/(teacher)/(upload)/create-brain-hack',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.lg }]}>
          What would you like to create?
        </Text>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          {options.map((o, i) => (
            <Stagger key={o.label} delayMs={i * 80}>
              <Pressable
                onPress={() => router.push(o.href)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: color('accent/tint'), borderRadius: radius.md }]}>
                  {o.icon}
                </View>
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{o.label}</Text>
                  <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={2}>
                    {o.description}
                  </Text>
                </View>
                <CaretRight size={20} color={color('text/tertiary')} />
              </Pressable>
            </Stagger>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 88 },
  iconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { CaretRight } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { wellnessRadius } from '@/src/theme/tokens';

type Shelf = { label: string; cards: { title: string; readMins: number }[] };

const SHELVES: Shelf[] = [
  {
    label: 'Guidance',
    cards: [
      { title: 'What exam stress actually does to your brain', readMins: 5 },
      { title: "Building a study schedule you'll still follow in week 3", readMins: 4 },
      { title: 'Sleep and memory: the science most aspirants ignore', readMins: 6 },
    ],
  },
  {
    label: 'Motivation',
    cards: [
      { title: 'The myth of studying 16 hours a day', readMins: 3 },
      { title: "Every topper's first mock score was a disappointment too", readMins: 3 },
      { title: "You don't need to feel ready to start", readMins: 2 },
    ],
  },
  {
    label: 'Reflection Prompts',
    cards: [
      { title: "What's one thing that made sense today that didn't last week?", readMins: 1 },
      { title: 'Name one worry you can set down until tomorrow', readMins: 1 },
      { title: "What would 'enough' look like today — not perfect, enough?", readMins: 1 },
    ],
  },
];

export default function SupportHomeRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const fade = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    fade.value = withTiming(1, { duration: 320 });
    return () => clearTimeout(t);
  }, [fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('wellness/bg') }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={fadeStyle}>
          <View style={{ marginTop: space.lg }}>
            <Text style={[type['type/h1'], { color: color('wellness/text-primary') }]}>Support</Text>
            <Text
              style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}
            >
              A steady space, built into your everyday routine.
            </Text>
          </View>

          <View style={{ marginTop: space.xl }}>
            {loading ? (
              <SkeletonBlock height={140} radius={wellnessRadius(24)} />
            ) : (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(student)/(support)/wellness-article',
                    params: { id: 'featured' },
                  })
                }
                style={({ pressed }) => [
                  {
                    backgroundColor: color('wellness/surface'),
                    borderRadius: wellnessRadius(24),
                    padding: space.lg,
                    opacity: pressed ? 0.95 : 1,
                  },
                  shadow(),
                ]}
              >
                <Text style={[type['type/overline'], { color: color('wellness/accent') }]}>TODAY</Text>
                <Text
                  style={[type['type/h2'], { color: color('wellness/text-primary'), marginTop: space['2xs'] }]}
                >
                  Building a study schedule you&apos;ll still follow in week 3
                </Text>
                <Text
                  style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}
                >
                  Motivation fluctuates over a multi-month prep window — plan for that, not against it.
                </Text>
              </Pressable>
            )}
          </View>

          {SHELVES.map((shelf) => (
            <View key={shelf.label} style={{ marginTop: space.xl }}>
              <View style={styles.shelfHeader}>
                <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
                  {shelf.label.toUpperCase()}
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/(support)/wellness-category',
                      params: { category: shelf.label },
                    })
                  }
                >
                  <Text style={[type['type/caption'], { color: color('wellness/accent') }]}>
                    See all →
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, marginTop: space.sm }}
              >
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonBlock key={i} width={160} height={120} radius={wellnessRadius(16)} />
                    ))
                  : shelf.cards.map((c) => (
                      <Pressable
                        key={c.title}
                        onPress={() =>
                          router.push({
                            pathname: '/(student)/(support)/wellness-article',
                            params: { title: c.title },
                          })
                        }
                        style={({ pressed }) => [
                          styles.shelfCard,
                          {
                            width: 160,
                            backgroundColor: color('wellness/surface'),
                            borderRadius: wellnessRadius(16),
                            padding: space.sm,
                            opacity: pressed ? 0.95 : 1,
                          },
                          shadow(),
                        ]}
                      >
                        <Text
                          style={[type['type/h3'], { color: color('wellness/text-primary'), fontSize: 15 }]}
                          numberOfLines={3}
                        >
                          {c.title}
                        </Text>
                        <Text
                          style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}
                        >
                          {c.readMins} min read
                        </Text>
                      </Pressable>
                    ))}
              </ScrollView>
            </View>
          ))}

          <Pressable
            onPress={() => router.push('/(student)/(support)/about-mmm')}
            style={({ pressed }) => [
              styles.principleCard,
              {
                backgroundColor: color('wellness/accent'),
                borderRadius: wellnessRadius(24),
                padding: space.lg,
                marginTop: space.xl,
                opacity: pressed ? 0.95 : 1,
              },
            ]}
          >
            <OrbitTriad color={color('text/inverse')} />
            <Text
              style={[type['type/body-m-medium'], { color: color('text/inverse'), flex: 1, marginLeft: space.md }]}
            >
              Rooted in MMM — Mind Mentor Mitra
            </Text>
            <CaretRight size={20} color={color('text/inverse')} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrbitTriad({ color: ink }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      {[0, 120, 240].map((angle) => (
        <G key={angle} transform={`rotate(${angle} 14 14)`}>
          <Circle cx={14} cy={5} r={2.5} fill={ink} />
        </G>
      ))}
      <Circle cx={14} cy={14} r={9} stroke={ink} strokeWidth={1.5} fill="none" opacity={0.6} />
    </Svg>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  shelfHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shelfCard: { minHeight: 100 },
  principleCard: { flexDirection: 'row', alignItems: 'center' },
});

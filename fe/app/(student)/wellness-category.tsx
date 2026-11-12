import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SkeletonBlock, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { wellnessRadius } from '@/src/theme/tokens';
import { useWellnessCategory } from '@/src/queries/wellness';
import { categoryKey, toCard, type ShelfCard } from '@/src/wellness/shelves';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const DESCRIPTIONS: Record<string, string> = {
  Guidance: 'Practical, specific ways to handle the pressure of exam prep.',
  Motivation: 'Grounded encouragement — not hype, just honest perspective.',
  'Reflection Prompts': 'A few minutes to think something through. No response needed, no one’s grading this.',
};

const CARDS: Record<string, { title: string; excerpt: string; readMins: number }[]> = {
  Guidance: [
    { title: 'What exam stress actually does to your brain', excerpt: 'The physiology behind the pressure, and what actually helps.', readMins: 5 },
    { title: "Building a study schedule you'll still follow in week 3", excerpt: 'Concrete scheduling advice grounded in how motivation fluctuates.', readMins: 4 },
    { title: 'Sleep and memory: the science most aspirants ignore', excerpt: "Why cutting sleep to study more usually backfires.", readMins: 6 },
  ],
  Motivation: [
    { title: 'The myth of studying 16 hours a day', excerpt: 'Why marathon sessions rarely produce marathon results.', readMins: 3 },
    { title: "Every topper's first mock score was a disappointment too", excerpt: 'A look at where most high scorers actually started.', readMins: 3 },
    { title: "You don't need to feel ready to start", excerpt: 'Readiness is a byproduct of starting, not a precondition for it.', readMins: 2 },
  ],
  'Reflection Prompts': [
    { title: "What's one thing that made sense today that didn't last week?", excerpt: 'A short prompt for the end of a study session.', readMins: 1 },
    { title: 'Name one worry you can set down until tomorrow', excerpt: 'A short prompt for winding down.', readMins: 1 },
    { title: "What would 'enough' look like today — not perfect, enough?", excerpt: 'A short prompt for recalibrating expectations.', readMins: 1 },
  ],
};

export default function WellnessCategoryRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const name = category ?? 'Guidance';
  const wellness = useWellnessCategory(categoryKey(name));
  const loading = wellness.isPending;
  const liveCards: ShelfCard[] | null = wellness.data && wellness.data.content.length > 0 ? wellness.data.content.map(toCard) : null;

  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 320 });
  }, [fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const cards: ShelfCard[] = liveCards ?? CARDS[name] ?? CARDS.Guidance;

  return (
    <Screen wellness>
      <ScreenHeader title={name} />
      <Text
        style={[
          type['type/body-m'],
          { color: color('text/secondary'), paddingHorizontal: space.lg, marginTop: space['2xs'] },
        ]}
      >
        {DESCRIPTIONS[name] ?? DESCRIPTIONS.Guidance}
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[{ gap: space.sm }, fadeStyle]}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} height={92} radius={wellnessRadius(16)} />
              ))
            : cards.map((c) => (
                <Pressable
                  key={c.id ?? c.title}
                  onPress={() =>
                    router.push({ pathname: ROUTES.student.wellnessArticle, params: c.id ? { id: c.id } : { title: c.title } })
                  }
                  style={({ pressed }) => [
                    {
                      backgroundColor: color('wellness/surface'),
                      borderRadius: wellnessRadius(16),
                      padding: space.md,
                      opacity: pressed ? 0.95 : 1,
                    },
                    shadow(),
                  ]}
                >
                  <Text style={[type['type/h3'], { color: color('wellness/text-primary') }]}>{c.title}</Text>
                  {c.excerpt ? (
                    <Text
                      style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}
                      numberOfLines={2}
                    >
                      {c.excerpt}
                    </Text>
                  ) : null}
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                    {c.readMins} min read
                  </Text>
                </Pressable>
              ))}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
});

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CaretLeft } from 'phosphor-react-native';
import { TextButton, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Article = {
  category: 'Guidance' | 'Motivation' | 'Reflection Prompts';
  title: string;
  readMins: number;
  body: string;
  closingLine?: string;
  framing?: string;
};

const ARTICLES: Record<string, Article> = {
  "Building a study schedule you'll still follow in week 3": {
    category: 'Guidance',
    title: "Building a study schedule you'll still follow in week 3",
    readMins: 4,
    body: `Most study schedules fail for the same reason: they're built for the version of you that exists on day one, full of resolve, not the version that exists in week three, tired and a little behind.

A schedule that survives has slack built in on purpose. Plan for six productive days, not seven — the seventh is your buffer for the day that inevitably goes sideways. Block subjects by energy, not by importance: put your hardest subject in your highest-energy window, whenever that actually is for you, not whenever a generic study guide says mornings are best.

Review your schedule every Sunday, not to punish yourself for what slipped, but to adjust it. A schedule is a plan you're allowed to renegotiate with yourself — it isn't a contract you either keep perfectly or fail.`,
    closingLine: "A schedule you adjust is still a schedule. A schedule you abandon isn't.",
  },
  'What exam stress actually does to your brain': {
    category: 'Guidance',
    title: 'What exam stress actually does to your brain',
    readMins: 5,
    body: `Under sustained pressure, your body doesn't distinguish between a tiger and a test — it releases the same stress hormones either way. In short bursts, that response sharpens focus. Sustained for weeks, it does the opposite: it narrows attention, disrupts sleep, and makes recall noticeably harder right when you need it most.

The fix isn't "stop feeling stressed" — that's rarely in anyone's control on command. It's building small, repeatable habits that interrupt the sustained part: short breaks that are actually breaks (not just switching to your phone), consistent sleep timing even during heavy revision weeks, and a few minutes of slow breathing before a study block rather than diving straight in tense.

None of this makes the exam smaller. It just keeps your brain working the way it's supposed to while you prepare for it.`,
    closingLine: 'Managing stress is part of studying, not a distraction from it.',
  },
  "You don't need to feel ready to start": {
    category: 'Motivation',
    title: "You don't need to feel ready to start",
    readMins: 2,
    body: `Waiting to feel ready is one of the most common ways a study session gets delayed by an hour, or a day. Readiness, in practice, is usually a byproduct of starting — the feeling shows up after the first ten minutes, not before them.

If you're waiting for motivation to open the book, try opening the book first and letting the motivation catch up. It almost always does.`,
    closingLine: 'Start before you feel ready. Readiness follows.',
  },
};

const DEFAULT_ARTICLE: Article = {
  category: 'Guidance',
  title: 'A Note for Today',
  readMins: 3,
  body: 'A short, considered piece of guidance will appear here, written in the same steady voice as the rest of Support.',
  closingLine: 'One step at a time.',
};

const REFLECTION_PROMPTS: Record<string, Article> = {
  "What's one thing that made sense today that didn't last week?": {
    category: 'Reflection Prompts',
    title: "What's one thing that made sense today that didn't last week?",
    readMins: 1,
    body: '',
    framing: "Progress in exam prep is rarely dramatic — it's usually one small thing clicking into place. Take a moment to notice it.",
  },
  'Name one worry you can set down until tomorrow': {
    category: 'Reflection Prompts',
    title: 'Name one worry you can set down until tomorrow',
    readMins: 1,
    body: '',
    framing: "Not every worry needs to be carried right now. Pick one, and give yourself permission to pick it back up tomorrow.",
  },
};

export default function WellnessArticleRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { title } = useLocalSearchParams<{ title?: string; id?: string }>();
  const [loading, setLoading] = useState(true);

  const fade = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    fade.value = withTiming(1, { duration: 320 });
    return () => clearTimeout(t);
  }, [fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const article =
    (title && (ARTICLES[title] || REFLECTION_PROMPTS[title])) ||
    ARTICLES["Building a study schedule you'll still follow in week 3"] ||
    DEFAULT_ARTICLE;
  const isPrompt = article.category === 'Reflection Prompts';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('wellness/bg') }]}>
      <View style={[styles.topBar, { paddingHorizontal: space.lg, marginTop: space.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('wellness/text-primary')} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <SkeletonBlock height={20} width={100} />
            <SkeletonBlock height={34} />
            <SkeletonBlock height={16} width={140} />
            <View style={{ marginTop: space.md, gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} height={16} width={i === 4 ? '60%' : '100%'} />
              ))}
            </View>
          </View>
        ) : (
          <Animated.View style={[{ marginTop: space.lg }, fadeStyle]}>
            <View
              style={[
                styles.tag,
                { backgroundColor: color('wellness/surface'), borderRadius: 999, paddingHorizontal: space.sm },
              ]}
            >
              <Text style={[type['type/caption'], { color: color('wellness/accent') }]}>{article.category}</Text>
            </View>

            {isPrompt ? (
              <>
                <Text
                  style={[type['type/h2'], { color: color('wellness/text-primary'), marginTop: space.md }]}
                >
                  {article.title}
                </Text>
                <Text
                  style={[type['type/body-l'], { color: color('wellness/text-primary'), marginTop: space.md, lineHeight: 28 }]}
                >
                  {article.framing}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={[type['type/h1'], { color: color('wellness/text-primary'), marginTop: space.xs }]}
                >
                  {article.title}
                </Text>
                <Text
                  style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}
                >
                  {article.readMins} min read
                </Text>
                <Text
                  style={[type['type/body-l'], { color: color('wellness/text-primary'), marginTop: space.lg, lineHeight: 28 }]}
                >
                  {article.body}
                </Text>
                {article.closingLine ? (
                  <Text
                    style={[type['type/h3'], { color: color('wellness/accent'), marginTop: space.xl }]}
                  >
                    {article.closingLine}
                  </Text>
                ) : null}
              </>
            )}

            <View style={{ marginTop: space.xl, alignItems: 'center' }}>
              <TextButton
                label="Back to Support"
                onPress={() => router.push('/(student)/(support)')}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  tag: { alignSelf: 'flex-start', paddingVertical: 4 },
});

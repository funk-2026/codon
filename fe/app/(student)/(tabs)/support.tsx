import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { CaretRight, Compass, PencilSimpleLine, Sun } from 'phosphor-react-native';
import { CollapsingHeader, EmptyState, SegmentedControl, SkeletonBlock, useCollapsingHeader } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useWellness } from '@/src/queries/wellness';
import { categoryKey, toCard, WELLNESS_CATEGORIES, type ShelfCard } from '@/src/wellness/shelves';
import type { WellnessCategory } from '@/src/api/wellness';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/**
 * Sample articles for development only, so the screen isn't empty before an admin publishes
 * anything (Admin → Wellness). Students never see them: with no live content they get an empty state.
 */
const STARTERS: Record<WellnessCategory, ShelfCard[]> = {
  guidance: [
    { title: 'What exam stress actually does to your brain', readMins: 5 },
    { title: "Building a study schedule you'll still follow in week 3", readMins: 4, excerpt: 'Motivation fluctuates over a multi-month prep window — plan for that, not against it.' },
    { title: 'Sleep and memory: the science most aspirants ignore', readMins: 6 },
  ],
  motivation: [
    { title: 'The myth of studying 16 hours a day', readMins: 3 },
    { title: "Every topper's first mock score was a disappointment too", readMins: 3 },
    { title: "You don't need to feel ready to start", readMins: 2 },
  ],
  reflection_prompt: [
    { title: "What's one thing that made sense today that didn't last week?", readMins: 1 },
    { title: 'Name one worry you can set down until tomorrow', readMins: 1 },
    { title: "What would 'enough' look like today — not perfect, enough?", readMins: 1 },
  ],
};

const SEGMENTS = [
  { key: 'guidance' as const, label: 'Guidance' },
  { key: 'motivation' as const, label: 'Motivation' },
  { key: 'reflection_prompt' as const, label: 'Reflection' },
];

const ICONS = { guidance: Compass, motivation: Sun, reflection_prompt: PencilSimpleLine } as const;
const sameCard = (a: ShelfCard, b: ShelfCard) => (a.id && b.id ? a.id === b.id : a.title === b.title);

export default function SupportHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const header = useCollapsingHeader(64);
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const wellness = useWellness();

  const [segment, setSegmentState] = useState<WellnessCategory>(categoryKey(params.category) ?? 'guidance');
  const [query, setQuery] = useState('');
  const setSegment = (k: WellnessCategory) => {
    setSegmentState(k);
    setQuery('');
  };

  const liveItems = useMemo(() => wellness.data?.content ?? [], [wellness.data]);
  const useSamples = __DEV__ && !wellness.isPending && liveItems.length === 0;
  const byCategory = useMemo(() => {
    const out: Record<WellnessCategory, ShelfCard[]> = { guidance: [], motivation: [], reflection_prompt: [] };
    for (const c of WELLNESS_CATEGORIES) {
      out[c.key] = useSamples ? STARTERS[c.key] : liveItems.filter((i) => i.category === c.key).map(toCard);
    }
    return out;
  }, [liveItems, useSamples]);

  // "Today": the newest guidance piece, else the newest item of any kind.
  const featured: ShelfCard | null = byCategory.guidance[0] ?? byCategory.motivation[0] ?? byCategory.reflection_prompt[0] ?? null;

  const q = query.trim().toLowerCase();
  const inSegment = byCategory[segment];
  // Don't list the Today article twice, unless it's the only one here.
  const listed = (q || !featured || inSegment.length <= 1 ? inSegment : inSegment.filter((c) => !sameCard(c, featured))).filter(
    (c) => !q || c.title.toLowerCase().includes(q),
  );

  const open = (c: ShelfCard) =>
    router.push({ pathname: ROUTES.student.wellnessArticle, params: c.id ? { id: c.id } : { title: c.title } });
  const Icon = ICONS[segment];
  const hasAnything = WELLNESS_CATEGORIES.some((c) => byCategory[c.key].length > 0);

  return (
    <View style={[styles.container, { backgroundColor: color('wellness/bg') }]}>
      <CollapsingHeader
        state={header}
        background={color('wellness/header')}
        expanded={
          <View>
            <Text style={[type['type/h1'], { color: color('wellness/text-primary') }]}>Support</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
              A steady space, built into your everyday routine.
            </Text>
          </View>
        }
        compact={<Text style={[type['type/h3'], { color: color('wellness/text-primary') }]}>Support</Text>}
      />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {wellness.isPending ? (
          <View style={{ gap: space.xs }}>
            <SkeletonBlock height={110} radius={radius.lg} />
            <SkeletonBlock height={64} radius={radius.md} />
            <SkeletonBlock height={64} radius={radius.md} />
          </View>
        ) : !hasAnything ? (
          <EmptyState
            icon={<Compass size={32} color={color('text/tertiary')} />}
            title="Nothing here yet"
            description="New articles and reflection prompts will show up here as they’re published."
          />
        ) : (
          <>
            {featured ? (
              <Pressable
                onPress={() => open(featured)}
                accessibilityRole="button"
                accessibilityLabel={`Today: ${featured.title}`}
                style={({ pressed }) => [
                  { backgroundColor: color('wellness/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.95 : 1 },
                  shadow(),
                ]}
              >
                <Text style={[type['type/overline'], { color: color('wellness/accent') }]}>TODAY</Text>
                <Text style={[type['type/h2'], { color: color('wellness/text-primary'), marginTop: space['2xs'] }]} numberOfLines={3}>
                  {featured.title}
                </Text>
                {featured.excerpt ? (
                  <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]} numberOfLines={2}>
                    {featured.excerpt}
                  </Text>
                ) : null}
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>{featured.readMins} min read</Text>
              </Pressable>
            ) : null}

            <View style={{ marginTop: space.lg }}>
              <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} accent="wellness/accent" />
            </View>
            <View style={{ marginTop: space.md }}>
              <TreeToolbar query={query} onQuery={setQuery} placeholder="Search articles" />
            </View>

            <View style={{ gap: space.xs, marginTop: space.md }}>
              {listed.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
                  <Icon size={28} color={color('text/tertiary')} weight="duotone" />
                  <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
                    {q ? `No matches for ‘${query}’` : 'Nothing here yet'}
                  </Text>
                  {!q ? (
                    <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
                      New {SEGMENTS.find((s) => s.key === segment)?.label.toLowerCase()} pieces will appear here.
                    </Text>
                  ) : null}
                </View>
              ) : (
                listed.map((c) => (
                  <Pressable
                    key={c.id ?? c.title}
                    onPress={() => open(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.title}. ${c.readMins} minute read`}
                    style={({ pressed }) => [
                      { backgroundColor: color('wellness/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 },
                      shadow(),
                    ]}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('wellness/header'), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={22} color={color('wellness/accent')} weight="duotone" />
                    </View>
                    <View style={{ flex: 1, marginLeft: space.sm }}>
                      <Text style={[type['type/h3'], { color: color('wellness/text-primary') }]} numberOfLines={2}>{c.title}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{c.readMins} min read</Text>
                    </View>
                    <CaretRight size={20} color={color('text/tertiary')} />
                  </Pressable>
                ))
              )}
            </View>
            {useSamples ? (
              <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center', marginTop: space.md }]}>
                Sample articles (development builds only)
              </Text>
            ) : null}
          </>
        )}

        <Pressable
          onPress={() => router.push(ROUTES.student.aboutMmm)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.principleCard,
            { backgroundColor: color('wellness/accent'), borderRadius: radius.lg, padding: space.md, marginTop: space.xl, opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <OrbitTriad color={color('text/inverse')} />
          <Text style={[type['type/body-m-medium'], { color: color('text/inverse'), flex: 1, marginLeft: space.md }]}>
            Rooted in MMM — Mind Mentor Mitra
          </Text>
          <CaretRight size={20} color={color('text/inverse')} />
        </Pressable>
      </Animated.ScrollView>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  principleCard: { flexDirection: 'row', alignItems: 'center' },
});

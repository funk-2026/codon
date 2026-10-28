import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { CaretLeft, CaretRight, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useFlag } from '@/src/config/AppConfigContext';
import { getExplore, type Deck, type Explore } from '@/src/api/discover';
import { getModule } from '@/src/modules/registry';

const CARD_W = 220;

/**
 * Explore (FE-6.2): real discovery for the student's course — continue,
 * recommendations, quick-start presets, chapters to practise, flashcards and
 * Brain Hacks. Every section hides when empty; custom-test entry points hide
 * when the module is off.
 */
export default function ExploreRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const customOn = useFlag('custom_test.enabled');
  const [data, setData] = useState<Explore | null>(null);
  const [error, setError] = useState(false);

  const courseId = user?.selected_course_id;
  const load = useCallback(() => {
    if (!courseId) return;
    setError(false);
    getExplore(courseId).then(setData).catch(() => setError(true));
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const builder = (params: Record<string, string>) => router.push({ pathname: '/(student)/(practice)/custom-builder', params } as Href);
  const decks = data ? dedupeDecks(data.flashcard_decks.top_rated, data.flashcard_decks.newest) : [];
  const empty =
    data && !data.continue.length && !(customOn && (data.recommended.length || data.presets.length || data.qbank.length)) && !decks.length && !data.brain_hacks.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Explore</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {!courseId ? (
          <EmptyState icon={<WarningCircle size={32} color={color('text/tertiary')} />} title="Pick a course first" description="Choose your course in Profile to see what’s available." />
        ) : error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load Explore"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : !data ? (
          <View style={{ padding: space.md, gap: space.md }}>
            {[0, 1, 2].map((i) => <SkeletonBlock key={i} height={120} radius={radius.md} />)}
          </View>
        ) : empty ? (
          <EmptyState icon={<WarningCircle size={32} color={color('text/tertiary')} />} title="Nothing here yet" description="New tests, flashcards and Brain Hacks for your course will show up here." />
        ) : (
          <>
            {data.continue.length > 0 ? (
              <Section title="Continue">
                {data.continue.map((c) => (
                  <Card
                    key={c.attempt_id}
                    title={c.title}
                    meta={`${getModule(c.module).label} · in progress`}
                    onPress={() => router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: c.test_id } })}
                    a11y={`Continue ${c.title}`}
                  />
                ))}
              </Section>
            ) : null}

            {customOn && data.recommended.length > 0 ? (
              <Section title="Recommended for you">
                {data.recommended.map((r) => (
                  <Card key={r.code} title={r.title} meta={r.reason} onPress={() => builder({ patch: JSON.stringify(r.patch) })} a11y={`${r.title}. ${r.reason}`} />
                ))}
              </Section>
            ) : null}

            {customOn && data.presets.length > 0 ? (
              <Section title="Quick start">
                {data.presets.map((p) => (
                  <Card key={p.id} title={p.title} meta={p.description ?? 'Custom test'} onPress={() => builder({ template: JSON.stringify(p.blueprint) })} a11y={`Start from ${p.title}`} />
                ))}
              </Section>
            ) : null}

            {customOn && data.qbank.length > 0 ? (
              <Section title="Practise a chapter">
                {data.qbank.map((q) => (
                  <Card
                    key={q.chapter_id}
                    title={q.chapter}
                    meta={`${q.subject} · ${q.questions} questions`}
                    onPress={() => builder({ patch: JSON.stringify({ filters: { chapter_ids: [q.chapter_id] } }) })}
                    a11y={`Build a test from ${q.chapter}, ${q.questions} questions`}
                  />
                ))}
              </Section>
            ) : null}

            {decks.length > 0 ? (
              <Section title="Flashcards">
                {decks.map((d) => (
                  <Card
                    key={d.id}
                    title={d.title}
                    meta={`${d.card_count} cards${d.rating_count >= 5 ? ` · ★ ${d.rating_avg.toFixed(1)}` : ''}${d.requires_subscription ? ' · subscribers' : ''}`}
                    onPress={() => router.push({ pathname: '/(student)/(learn)/flashcard-study', params: { deckId: d.id } })}
                    a11y={`Study ${d.title}, ${d.card_count} cards`}
                  />
                ))}
              </Section>
            ) : null}

            {data.brain_hacks.length > 0 ? (
              <Section title="Brain Hacks" more={{ label: 'See all', onPress: () => router.push('/(student)/(home)/brain-hacks') }}>
                {data.brain_hacks.map((h) => (
                  <Card
                    key={h.id}
                    title={h.title}
                    meta={`${h.category} · ${h.read_minutes} min`}
                    onPress={() => router.push({ pathname: '/(student)/(home)/brain-hack-detail', params: { id: h.id } })}
                    a11y={`Read ${h.title}`}
                  />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Top-rated first, then newest, without repeats. */
function dedupeDecks(top: Deck[], newest: Deck[]): Deck[] {
  const seen = new Set<string>();
  return [...top, ...newest].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
}

function Section({ title, more, children }: { title: string; more?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  const { color, type, space } = useTheme();
  return (
    <View style={{ marginTop: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, marginBottom: space.sm }}>
        <Text accessibilityRole="header" style={[type['type/overline'], { color: color('text/tertiary'), flex: 1 }]}>{title.toUpperCase()}</Text>
        {more ? (
          <Pressable onPress={more.onPress} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type['type/caption'], { color: color('accent/default') }]}>{more.label} →</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.sm }}>
        {children}
      </ScrollView>
    </View>
  );
}

function Card({ title, meta, onPress, a11y }: { title: string; meta: string; onPress: () => void; a11y: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({ width: CARD_W, minHeight: 96, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, justifyContent: 'space-between', opacity: pressed ? 0.92 : 1 })}
    >
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}>
        <Text style={[type['type/caption'], { color: color('text/secondary'), flex: 1 }]} numberOfLines={2}>{meta}</Text>
        <CaretRight size={14} color={color('text/tertiary')} />
      </View>
    </Pressable>
  );
}

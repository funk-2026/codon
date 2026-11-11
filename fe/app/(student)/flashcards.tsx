import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Cards, Lock, Star, WarningCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { useDecks } from '@/src/queries/discover';
import { ROUTES } from '@/src/navigation/routes';

export default function FlashcardDecksRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const minCount = useAppConfig().config?.limits.ratings.min_count_display ?? 5;
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const list = useDecks(user?.selected_course_id, query);
  const decks = list.data?.pages.flatMap((p) => p.decks) ?? [];
  const loading = list.isPending;
  const error = list.isError;
  const load = () => void list.refetch();
  const more = list.isFetchingNextPage;
  const loadMore = () => void list.fetchNextPage();

  const totalDue = decks.reduce((n, d) => n + (d.locked ? 0 : d.progress?.due ?? 0), 0);

  return (
    <Screen>
      <ScreenHeader title="Flashcards" />
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <InputField label="Search decks" value={q} onChangeText={setQ} autoCorrect={false} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {!loading && !error && totalDue > 0 ? (
          <PrimaryButton label={`Quick review · ${Math.min(totalDue, 10)} cards due`} onPress={() => router.push({ pathname: ROUTES.student.flashcardStudy, params: { quick: '1' } })} />
        ) : null}
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={96} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load decks" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : decks.length === 0 ? (
          <EmptyState icon={<Cards size={32} color={color('text/tertiary')} />} title={query ? 'No decks match' : 'No flashcard decks yet'} description={query ? 'Try a different search.' : 'New decks will appear here as teachers publish them.'} />
        ) : (
          <>
            {decks.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => (d.locked ? router.push(ROUTES.student.subscriptionPlans) : router.push({ pathname: ROUTES.student.flashcardStudy, params: { deckId: d.id } }))}
                accessibilityRole="button"
                accessibilityLabel={`${d.title}. ${d.card_count} cards.${d.locked ? ' Subscription required.' : d.progress ? ` ${d.progress.due} due, ${d.progress.new} new.` : ''}`}
                style={({ pressed }) => ({ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 4, opacity: pressed ? 0.94 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{d.title}</Text>
                  {d.locked ? <Lock size={16} color={color('text/tertiary')} weight="fill" /> : null}
                </View>
                {d.description ? <Text style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={2}>{d.description}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{d.card_count} cards</Text>
                  {!d.locked && d.progress ? (
                    <>
                      {d.progress.due > 0 ? <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>{d.progress.due} due</Text> : null}
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{d.progress.learned} learned</Text>
                    </>
                  ) : d.locked ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Subscription</Text> : null}
                  {d.rating_count >= minCount ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Star size={12} weight="fill" color={color('semantic/warning')} />
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{d.rating_avg.toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {list.hasNextPage ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

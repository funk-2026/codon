import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Cards, Lock, Star, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { useAuth } from '@/src/auth/AuthContext';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { useDecks } from '@/src/queries/discover';
import { ROUTES } from '@/src/navigation/routes';

/**
 * Flashcard decks for the Learn tab. Decks always stay listed. Tapping one studies what is due
 * or new; when nothing is, it opens plain revision of every card so a deck never dead-ends.
 */
export function FlashcardDeckList({ query }: { query: string }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const minCount = useAppConfig().config?.limits.ratings.min_count_display ?? 5;

  // Debounce so the list isn't refetched on every keystroke.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const list = useDecks(user?.selected_course_id, debounced);
  const decks = list.data?.pages.flatMap((p) => p.decks) ?? [];
  const totalDue = decks.reduce((n, d) => n + (d.locked ? 0 : d.progress?.due ?? 0), 0);

  if (list.isPending) {
    return (
      <View style={{ gap: space.sm }}>
        {[0, 1, 2].map((i) => <SkeletonBlock key={i} height={96} radius={radius.md} />)}
      </View>
    );
  }
  if (list.isError) {
    return (
      <EmptyState
        icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
        title="Couldn’t load decks"
        description="Check your connection and try again."
        action={<TextButton label="Retry" onPress={() => void list.refetch()} />}
      />
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {totalDue > 0 ? (
        <PrimaryButton
          label={`Quick review · ${Math.min(totalDue, 10)} cards due`}
          onPress={() => router.push({ pathname: ROUTES.student.flashcardStudy, params: { quick: '1' } })}
        />
      ) : null}
      {decks.length === 0 ? (
        <EmptyState
          icon={<Cards size={32} color={color('text/tertiary')} />}
          title={debounced ? 'No decks match' : 'No flashcard decks yet'}
          description={debounced ? 'Try a different search.' : 'New decks will appear here as teachers publish them.'}
        />
      ) : (
        <>
          {decks.map((d) => {
            const queued = d.progress ? d.progress.due + d.progress.new : 0;
            const caughtUp = !d.locked && d.progress != null && queued === 0;
            return (
              <Pressable
                key={d.id}
                onPress={() => {
                  if (d.locked) return router.push(ROUTES.student.subscriptionPlans);
                  router.push({
                    pathname: ROUTES.student.flashcardStudy,
                    params: caughtUp ? { deckId: d.id, all: '1' } : { deckId: d.id },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${d.title}. ${d.card_count} cards.${d.locked ? ' Subscription required.' : d.progress ? ` ${d.progress.due} due, ${d.progress.new} new.` : ''}${caughtUp ? ' All caught up, opens revision.' : ''}`}
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 4, opacity: pressed ? 0.94 : 1 }, shadow()]}
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
                      {caughtUp ? <Text style={[type['type/caption'], { color: color('accent/default') }]}>Revise all</Text> : null}
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
            );
          })}
          {list.hasNextPage ? (
            <SecondaryButton label={list.isFetchingNextPage ? 'Loading…' : 'Load more'} onPress={() => void list.fetchNextPage()} loading={list.isFetchingNextPage} />
          ) : null}
        </>
      )}
    </View>
  );
}

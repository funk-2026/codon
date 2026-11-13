import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, Cards, Lightning, Lock, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { useAuth } from '@/src/auth/AuthContext';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { useDecks, useQuickPreview } from '@/src/queries/discover';
import type { Deck } from '@/src/api/discover';
import { ROUTES } from '@/src/navigation/routes';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

const MAX_PAGES = 20;

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
  // Due-first ordering and the Quick review count need every deck, so keep paging until done
  // (capped, so a runaway list can't loop forever). Searching narrows the list, so it follows the same rule.
  const pagesLoaded = list.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pagesLoaded < MAX_PAGES) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pagesLoaded]);
  const totalDue = decks.reduce((n, d) => n + (d.locked ? 0 : d.progress?.due ?? 0), 0);
  const quick = useQuickPreview(user?.selected_course_id, totalDue > 0);
  // Coming back from a study session changes every count, so refresh on focus.
  useRefetchOnFocus(() => void Promise.all([list.refetch(), quick.refetch()]));

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

  const queuedOf = (d: Deck) => (d.progress ? d.progress.due + d.progress.new : 0);
  const open = (d: Deck, caughtUp: boolean) => {
    if (d.locked) return router.push(ROUTES.student.subscriptionPlans);
    router.push({ pathname: ROUTES.student.flashcardStudy, params: caughtUp ? { deckId: d.id, all: '1' } : { deckId: d.id } });
  };
  const dueDecks = debounced ? [] : decks.filter((d) => !d.locked && (d.progress?.due ?? 0) > 0);
  const otherDecks = debounced ? decks : decks.filter((d) => !dueDecks.includes(d));

  const renderDeck = (d: Deck) => {
    const queued = queuedOf(d);
    const caughtUp = !d.locked && d.progress != null && queued === 0;
    const learned = d.progress?.learned ?? 0;
    const pct = d.card_count > 0 ? Math.min(1, learned / d.card_count) : 0;
    return (
      <Pressable
        key={d.id}
        onPress={() => open(d, caughtUp)}
        accessibilityRole="button"
        accessibilityLabel={`${d.title}. ${d.card_count} cards.${d.locked ? ' Subscription required.' : d.progress ? ` ${d.progress.due} due, ${d.progress.new} new, ${learned} learned.` : ''}${caughtUp ? ' All caught up, opens revision.' : ''}`}
        style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
            <Cards size={24} color={color('accent/default')} weight="duotone" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{d.title}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
              {d.card_count} cards{d.rating_count >= minCount ? ` · ★ ${d.rating_avg.toFixed(1)}` : ''}
            </Text>
          </View>
          {d.locked ? (
            <Lock size={20} color={color('text/tertiary')} weight="fill" />
          ) : (
            <View
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.xs,
                borderRadius: radius.pill,
                backgroundColor: caughtUp ? 'transparent' : color('action/primary'),
                borderWidth: caughtUp ? 1.5 : 0,
                borderColor: color('accent/default'),
              }}
            >
              <Text style={[type['type/body-m-medium'], { color: caughtUp ? color('accent/default') : color('action/on-primary') }]}>
                {caughtUp ? 'Revise' : 'Study'}
              </Text>
            </View>
          )}
        </View>
        {d.description ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]} numberOfLines={2}>{d.description}</Text> : null}
        {!d.locked && d.progress ? (
          <View style={{ gap: space.xs }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken'), overflow: 'hidden' }}>
              <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: color('semantic/success') }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), flex: 1 }]}>{learned} of {d.card_count} learned</Text>
              {d.progress.due > 0 ? (
                <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                  <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>{d.progress.due} due</Text>
                </View>
              ) : d.progress.new > 0 ? (
                <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                  <Text style={[type['type/caption'], { color: color('accent/default') }]}>{d.progress.new} new</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : d.locked ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Subscription required</Text>
        ) : null}
      </Pressable>
    );
  };

  const sectionLabel = (text: string) => (
    <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.xs }]}>{text}</Text>
  );

  return (
    <View style={{ gap: space.sm }}>
      {totalDue > 0 && !debounced ? (
        <Pressable
          onPress={() => router.push({ pathname: ROUTES.student.flashcardStudy, params: { quick: '1' } })}
          accessibilityRole="button"
          accessibilityLabel={`Quick review, ${Math.min(totalDue, 10)} cards due`}
          style={({ pressed }) => ({ backgroundColor: color('action/primary'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: pressed ? 0.92 : 1 })}
        >
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Lightning size={28} weight="fill" color={color('action/on-primary')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type['type/h3'], { color: color('action/on-primary') }]}>Quick review</Text>
            <Text style={[type['type/body-m'], { color: color('action/on-primary'), opacity: 0.85 }]}>
              {Math.min(totalDue, 10)} cards due{quick.data ? ` · about ${Math.max(1, Math.round(quick.data.minutes_estimate))} min` : ''}
            </Text>
          </View>
          <CaretRight size={22} color={color('action/on-primary')} />
        </Pressable>
      ) : null}
      {decks.length === 0 ? (
        <EmptyState
          icon={<Cards size={32} color={color('text/tertiary')} />}
          title={debounced ? 'No decks match' : 'No flashcard decks yet'}
          description={debounced ? 'Try a different search.' : 'New decks will appear here as teachers publish them.'}
        />
      ) : (
        <>
          {dueDecks.length > 0 ? sectionLabel('DUE TODAY') : null}
          {dueDecks.map(renderDeck)}
          {dueDecks.length > 0 && otherDecks.length > 0 ? sectionLabel('ALL DECKS') : null}
          {otherDecks.map(renderDeck)}
          {list.hasNextPage && pagesLoaded >= MAX_PAGES ? (
            <SecondaryButton label={list.isFetchingNextPage ? 'Loading…' : 'Load more'} onPress={() => void list.fetchNextPage()} loading={list.isFetchingNextPage} />
          ) : null}
        </>
      )}
    </View>
  );
}

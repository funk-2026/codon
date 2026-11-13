import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, WarningCircle } from 'phosphor-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast, Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import { browseDeckCards, quickCards, reviewCard, studyDeck, type ReviewResult, type StudyCard } from '@/src/api/discover';
import type { MediaMap } from '@/src/rich';
import { FlipCard, type SwipeDir } from '@/src/flashcards/FlipCard';
import { RatingBar } from '@/src/flashcards/RatingBar';
import { StudyComplete } from '@/src/flashcards/StudyComplete';
import { tap } from '@/src/flashcards/haptics';
import { track } from '@/src/analytics/track';
import { ROUTES } from '@/src/navigation/routes';
import { useSafeBack } from '@/src/navigation/useSafeBack';

export default function FlashcardStudyRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { user } = useAuth();
  const { deckId, quick, all } = useLocalSearchParams<{ deckId?: string; quick?: string; all?: string }>();
  // Revision mode: every card in order, no spaced-repetition rating. Cards never run out.
  const revise = all === '1' && !!deckId;

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [title, setTitle] = useState('Flashcards');
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'locked'>('loading');
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<ReviewResult, number>>({ again: 0, hard: 0, good: 0, easy: 0 });

  const load = useCallback(async () => {
    setState('loading');
    setI(0);
    setFlipped(false);
    setCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    try {
      if (revise && deckId) {
        const r = await browseDeckCards(deckId);
        setCards(r.cards.map((c) => ({ ...c, state: 'new' as const }))); setMedia(r.media ?? {}); setTitle(r.deck.title);
      } else if (quick === '1') {
        const r = await quickCards({ course_id: user?.selected_course_id ?? undefined, limit: 10 });
        setCards(r.cards); setMedia(r.media ?? {}); setTitle('Quick review');
      } else if (deckId) {
        const r = await studyDeck(deckId, 20);
        setCards(r.cards); setMedia(r.media ?? {}); setTitle(r.deck.title);
      }
      setState('ready');
    } catch (e) {
      setState(e instanceof ApiError && e.status === 403 ? 'locked' : 'error');
    }
  }, [deckId, quick, revise, user?.selected_course_id]);
  useEffect(() => { void load(); }, [load]);

  const card = cards[i];
  const done = state === 'ready' && i >= cards.length;
  const reviewed = i;

  const rate = async (r: ReviewResult) => {
    if (!card || saving) return;
    setSaving(true);
    try {
      await reviewCard(card.id, r);
      track('flashcards.reviewed', { result: r });
      tap(r === 'again' ? 'light' : 'success');
      setCounts((c) => ({ ...c, [r]: c[r] + 1 }));
      setFlipped(false);
      setI((n) => n + 1);
    } catch {
      show('Couldn’t save that answer. Try again.', 'error'); // the card stays so nothing is skipped silently
    } finally {
      setSaving(false);
    }
  };

  const flip = () => {
    tap('light');
    setFlipped((f) => !f);
  };
  const step = (delta: 1 | -1) => {
    setFlipped(false);
    setI((n) => Math.max(0, n + delta));
  };
  // Revise: swipe left for next, right for previous. Study: after flipping, left is Again and right is Good.
  const onSwipe = (dir: SwipeDir) => {
    if (revise) return step(dir === 'left' ? 1 : -1);
    void rate(dir === 'left' ? 'again' : 'good');
  };
  const swipeOn = revise ? true : flipped && !saving;

  const remaining = useMemo(() => Math.max(0, cards.length - i), [cards.length, i]);
  const reviseAll = () => router.replace({ pathname: ROUTES.student.flashcardStudy, params: { deckId, all: '1' } });

  return (
    <Screen>
      <ScreenHeader
        size="small"
        title={title}
        right={state === 'ready' && !done ? <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>{i + 1} / {cards.length}</Text> : null}
      />
      {state === 'ready' && cards.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 3, marginHorizontal: space.md, marginTop: space.xs }}>
          {cards.length <= 30 ? (
            cards.map((c, n) => (
              <View key={c.id} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: n < i ? color('accent/default') : n === i ? color('accent/default') : color('bg/sunken'), opacity: n === i ? 0.45 : 1 }} />
            ))
          ) : (
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: color('bg/sunken'), overflow: 'hidden' }}>
              <View style={{ width: `${(Math.min(i, cards.length) / cards.length) * 100}%`, height: 6, backgroundColor: color('accent/default') }} />
            </View>
          )}
        </View>
      ) : null}

      {state === 'loading' ? (
        <View style={{ padding: space.md }}><SkeletonBlock height={360} radius={radius.lg} /></View>
      ) : state === 'locked' ? (
        <EmptyState icon={<WarningCircle size={32} color={color('text/tertiary')} />} title="This deck needs a subscription" description="Upgrade to study every deck." action={<TextButton label="See plans" onPress={() => router.replace(ROUTES.student.subscriptionPlans)} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : state === 'error' ? (
        <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load cards" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : cards.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />} title="You’re all caught up" description="No cards are due right now." action={deckId ? <TextButton label="Revise all cards" onPress={reviseAll} /> : <TextButton label="Back" onPress={() => goBack()} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : done ? (
        <StudyComplete
          revise={revise}
          total={reviewed}
          knew={counts.good + counts.easy}
          again={counts.again}
          onAgain={load}
          onRevise={!revise && deckId ? reviseAll : undefined}
          onDone={() => goBack()}
        />
      ) : card ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: space.md }}>
            <FlipCard
              key={card.id}
              front={card.front}
              back={card.back}
              format={card.content_format}
              media={media}
              flipped={flipped}
              onFlip={flip}
              onSwipe={swipeOn ? onSwipe : undefined}
              swipeHints={!revise && flipped ? { left: 'Again', right: 'Good' } : undefined}
              deckTitle={title}
            />
          </View>
          <View style={{ padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm }}>
            {revise ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="Previous" disabled={i === 0} onPress={() => step(-1)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label={i === cards.length - 1 ? 'Finish' : 'Next'} onPress={() => step(1)} />
                </View>
              </View>
            ) : flipped ? (
              <RatingBar onRate={rate} disabled={saving} />
            ) : (
              <PrimaryButton label="Show answer" onPress={flip} />
            )}
            <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>
              {revise ? 'Swipe or use the buttons · tap the card to flip' : flipped ? 'Swipe left for Again, right for Good' : `${remaining} left`}
            </Text>
          </View>
        </GestureHandlerRootView>
      ) : null}
    </Screen>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowsClockwise, CaretLeft, CheckCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import { quickCards, reviewCard, studyDeck, type ReviewResult, type StudyCard } from '@/src/api/discover';
import { RichContent, type MediaMap } from '@/src/rich';
import { track } from '@/src/analytics/track';

const RATINGS: { key: ReviewResult; label: string; hint: string; tone: 'semantic/danger' | 'semantic/warning' | 'semantic/success' | 'accent/default' }[] = [
  { key: 'again', label: 'Again', hint: 'in 10 min', tone: 'semantic/danger' },
  { key: 'hard', label: 'Hard', hint: 'soon', tone: 'semantic/warning' },
  { key: 'good', label: 'Good', hint: 'tomorrow', tone: 'semantic/success' },
  { key: 'easy', label: 'Easy', hint: 'in 3 days', tone: 'accent/default' },
];

export default function FlashcardStudyRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { user } = useAuth();
  const { deckId, quick } = useLocalSearchParams<{ deckId?: string; quick?: string }>();

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
      if (quick === '1') {
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
  }, [deckId, quick, user?.selected_course_id]);
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
      setCounts((c) => ({ ...c, [r]: c[r] + 1 }));
      setFlipped(false);
      setI((n) => n + 1);
    } catch {
      show('Couldn’t save that answer. Try again.', 'error'); // the card stays so nothing is skipped silently
    } finally {
      setSaving(false);
    }
  };

  const remaining = useMemo(() => Math.max(0, cards.length - i), [cards.length, i]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Close" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{title}</Text>
        {state === 'ready' && !done ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{i + 1} / {cards.length}</Text> : null}
      </View>
      {state === 'ready' && cards.length > 0 ? (
        <View style={{ height: 3, backgroundColor: color('bg/sunken'), marginHorizontal: space.md, borderRadius: 2, marginTop: space.xs }}>
          <View style={{ width: `${(Math.min(i, cards.length) / cards.length) * 100}%`, height: 3, backgroundColor: color('accent/default'), borderRadius: 2 }} />
        </View>
      ) : null}

      {state === 'loading' ? (
        <View style={{ padding: space.md }}><SkeletonBlock height={300} radius={radius.lg} /></View>
      ) : state === 'locked' ? (
        <EmptyState icon={<WarningCircle size={32} color={color('text/tertiary')} />} title="This deck needs a subscription" description="Upgrade to study every deck." action={<TextButton label="See plans" onPress={() => router.replace('/(student)/(profile)/subscription-plans')} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : state === 'error' ? (
        <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load cards" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : cards.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />} title="You’re all caught up" description="No cards are due right now. Come back later." action={<TextButton label="Back" onPress={() => router.back()} />} style={{ flex: 1, justifyContent: 'center' }} />
      ) : done ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, alignItems: 'center', gap: space.md }}>
          <CheckCircle size={48} color={color('semantic/success')} weight="fill" />
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>Session complete</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>You reviewed {reviewed} card{reviewed === 1 ? '' : 's'}.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {RATINGS.map((r) => (
              <View key={r.key} style={{ alignItems: 'center', minWidth: 60 }}>
                <Text style={[type['type/h2'], { color: color(r.tone) }]}>{counts[r.key]}</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{r.label}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton label="Study more" onPress={load} />
          <SecondaryButton label="Done" onPress={() => router.back()} />
        </ScrollView>
      ) : card ? (
        <>
          <ScrollView contentContainerStyle={{ padding: space.md, flexGrow: 1, justifyContent: 'center' }}>
            <Pressable
              onPress={() => setFlipped((f) => !f)}
              accessibilityRole="button"
              accessibilityLabel={flipped ? 'Answer side. Tap to see the question.' : 'Question side. Tap to reveal the answer.'}
              style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, minHeight: 260, justifyContent: 'center', gap: space.sm }}
            >
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{flipped ? 'ANSWER' : 'QUESTION'}</Text>
              <RichContent value={flipped ? card.back : card.front} format={card.content_format} media={media} variant="stem" />
              {!flipped ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
                  <ArrowsClockwise size={16} color={color('text/tertiary')} />
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Tap to reveal</Text>
                </View>
              ) : null}
            </Pressable>
          </ScrollView>
          <View style={{ padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
            {flipped ? (
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                {RATINGS.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => rate(r.key)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.label}, see again ${r.hint}`}
                    style={({ pressed }) => ({ flex: 1, minHeight: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: color(r.tone), alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.5 : pressed ? 0.8 : 1 })}
                  >
                    <Text style={[type['type/body-m-medium'], { color: color(r.tone) }]}>{r.label}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{r.hint}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <PrimaryButton label="Show answer" onPress={() => setFlipped(true)} />
            )}
            <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>{remaining} left</Text>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

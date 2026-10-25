import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CaretLeft, Cards, Plus, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, StatusBadge, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listTeacherDecks, type TeacherDeck } from '@/src/api/flashcardsTeacher';
import { DECK_BADGE } from '@/src/flashcards/deckBadge';


/** Teacher: my flashcard decks (FE-6.3 authoring). Reloads on focus so status changes show. */
export default function TeacherDecksRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState<TeacherDeck[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    listTeacherDecks()
      .then((r) => setDecks(r.decks))
      .catch(() => setError(true));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (id?: string) => router.push({ pathname: '/(teacher)/flashcard-deck', params: id ? { id } : {} });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Flashcard decks</Text>
        <Pressable onPress={() => open()} accessibilityRole="button" accessibilityLabel="New deck" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={26} weight="bold" color={color('accent/default')} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load your decks"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : decks == null ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={76} radius={radius.md} />)
        ) : decks.length === 0 ? (
          <EmptyState
            icon={<Cards size={32} color={color('text/tertiary')} />}
            title="No decks yet"
            description="Make a deck of quick-recall cards — a prompt on the front, the answer on the back."
            action={<TextButton label="Create a deck" onPress={() => open()} />}
          />
        ) : (
          decks.map((d) => {
            const badge = DECK_BADGE[d.status] ?? DECK_BADGE.draft;
            return (
              <Pressable
                key={d.id}
                onPress={() => open(d.id)}
                accessibilityRole="button"
                accessibilityLabel={`${d.title}. ${d.card_count} cards. ${badge.label}`}
                style={({ pressed }) => ({ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space['2xs'], opacity: pressed ? 0.94 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{d.title}</Text>
                  <StatusBadge status={badge.status} label={badge.label} />
                </View>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                  {d.card_count} card{d.card_count === 1 ? '' : 's'}
                  {d.status === 'published' && d.rating_count > 0 ? ` · ★ ${d.rating_avg.toFixed(1)} (${d.rating_count})` : ''}
                </Text>
                {d.status === 'rejected' && d.rejection_reason ? (
                  <Text style={[type['type/caption'], { color: color('semantic/danger') }]} numberOfLines={2}>Reviewer: {d.rejection_reason}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

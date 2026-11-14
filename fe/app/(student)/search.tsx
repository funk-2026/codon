import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Cards, ClipboardText, FileText, Lightbulb, Lock, MagnifyingGlass, PlayCircle } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { LockedSheet } from '@/src/screens/LockedSheet';
import { useTheme } from '@/src/theme/ThemeProvider';
import { apiFetch } from '@/src/api/client';
import { useHasSubscription } from '@/src/queries/curriculum';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { track } from '@/src/analytics/track';

type Hit = { id: string; title: string; meta: string; kind: 'test' | 'video' | 'document' | 'deck' | 'hack'; requires_subscription: boolean };
type Results = { tests: Hit[]; content: Hit[]; decks: Hit[]; hacks: Hit[] };

const ICON = { test: ClipboardText, video: PlayCircle, document: FileText, deck: Cards, hack: Lightbulb } as const;
const GROUPS: { key: keyof Results; label: string }[] = [
  { key: 'tests', label: 'TESTS' },
  { key: 'content', label: 'LESSONS AND NOTES' },
  { key: 'decks', label: 'FLASHCARDS' },
  { key: 'hacks', label: 'BRAIN HACKS' },
];

/** One search over tests, lessons, notes, flashcard decks and Brain Hacks in the student's course. */
export default function SearchRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hasSub = useHasSubscription();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => apiFetch<Results>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (results.data) track('search.used', { length: q.length });
  }, [results.data, q.length]);

  const open = (h: Hit) => {
    if (h.requires_subscription && !hasSub) return setLocked(true);
    if (h.kind === 'test') router.push({ pathname: ROUTES.student.testPreStart, params: { id: h.id } });
    else if (h.kind === 'video') router.push({ pathname: ROUTES.student.videoPlayer, params: { id: h.id } });
    else if (h.kind === 'document') router.push({ pathname: ROUTES.student.contentReader, params: { id: h.id } });
    else if (h.kind === 'deck') router.push({ pathname: ROUTES.student.flashcardStudy, params: { deckId: h.id } });
    else router.push({ pathname: ROUTES.student.brainHackDetail, params: { id: h.id } });
  };

  const total = results.data ? GROUPS.reduce((n, g) => n + results.data[g.key].length, 0) : 0;

  return (
    <Screen>
      <ScreenHeader title="Search" />
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <TreeToolbar query={text} onQuery={setText} placeholder="Search tests, lessons, flashcards…" />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {q.length < 2 ? (
          <EmptyState icon={<MagnifyingGlass size={32} color={color('text/tertiary')} />} title="Find anything fast" description="Type at least two letters to search tests, video classes, notes, flashcards and Brain Hacks." />
        ) : results.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={56} radius={radius.md} />)
        ) : results.isError ? (
          <EmptyState title="Couldn’t search" description="Check your connection and try again." />
        ) : total === 0 ? (
          <EmptyState icon={<MagnifyingGlass size={32} color={color('text/tertiary')} />} title="No matches" description={`Nothing in your course matches “${q}”. Try a shorter word.`} />
        ) : (
          GROUPS.map((g) => {
            const hits = results.data[g.key];
            if (hits.length === 0) return null;
            return (
              <View key={g.key} style={{ gap: space.xs }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{g.label}</Text>
                {hits.map((h) => {
                  const Icon = ICON[h.kind];
                  const lock = h.requires_subscription && !hasSub;
                  return (
                    <Pressable
                      key={`${h.kind}-${h.id}`}
                      onPress={() => open(h)}
                      accessibilityRole="button"
                      accessibilityLabel={`${h.title}, ${h.meta}${lock ? ', locked' : ''}`}
                      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} color={color('accent/default')} />
                      </View>
                      <View style={{ flex: 1, marginLeft: space.sm }}>
                        <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{h.title}</Text>
                        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{h.meta}</Text>
                      </View>
                      {lock ? <Lock size={18} color={color('text/tertiary')} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
      {locked ? <LockedSheet onClose={() => setLocked(false)} onViewPlans={() => { setLocked(false); router.push(ROUTES.student.subscriptionPlans); }} /> : null}
    </Screen>
  );
}

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, ChartLineUp, MagnifyingGlass, X } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { countBySubject, LOCAL_SUBJECTS, searchMatch } from './logic';
import { useStudyItems, type StudyKind } from './useStudyItems';

const COPY: Record<StudyKind, { title: string; noun: string; empty: string }> = {
  pulse: { title: 'Pulse', noun: 'items', empty: 'One-minute revision items appear here as your teachers add them.' },
  flashcards: { title: 'Flashcards', noun: 'decks', empty: 'Decks appear here once they are published.' },
};

/** Opens to All / Physics / Chemistry / Biology, a search icon, and the blue analysis entry. No bookmark strip here. */
export function StudyLanding({ kind }: { kind: StudyKind }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { items, isPending, isError, refetch } = useStudyItems(kind);
  useRefetchOnFocus(refetch);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const c = COPY[kind];
  const hits = q.trim() ? items.filter((i) => searchMatch(i.title, i.chapter_name, q)) : [];

  const open = (subject: string, search?: string) => router.push({ pathname: ROUTES.student.studyList, params: { kind, subject, ...(search ? { q: search } : {}) } });
  const searchIcon = (
    <Pressable onPress={() => { setSearching((v) => !v); setQ(''); }} accessibilityRole="button" accessibilityLabel={searching ? 'Close search' : `Search ${c.title}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      {searching ? <X size={22} color={color('text/primary')} /> : <MagnifyingGlass size={22} color={color('text/primary')} />}
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title={c.title} right={searchIcon} />
      <View style={{ padding: space.md, gap: space.sm }}>
        {searching ? (
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={`Search ${c.noun} or chapters`}
            placeholderTextColor={color('text/tertiary')}
            returnKeyType="search"
            onSubmitEditing={() => q.trim() && open('All', q.trim())}
            style={[type['type/body-m'], { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color('border/subtle'), backgroundColor: color('bg/surface'), paddingHorizontal: space.md, color: color('text/primary') }]}
          />
        ) : null}
        {searching && q.trim() ? (
          <Pressable onPress={() => open('All', q.trim())} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{hits.length} match{hits.length === 1 ? '' : 'es'}. Show them →</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: kind } })} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 })}>
          <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>Check detailed analysis</Text>
          <CaretRight size={18} color={color('accent/default')} />
        </Pressable>

        {isPending ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={64} radius={radius.lg} />)
        ) : isError ? (
          <ErrorBanner onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={<MagnifyingGlass size={32} color={color('text/tertiary')} />} title={`No ${c.noun} yet`} description={c.empty} />
        ) : (
          LOCAL_SUBJECTS.map((s) => (
            <Pressable key={s} onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={`${s}, ${countBySubject(items, s)} ${c.noun}`} style={({ pressed }) => [{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}>
              <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{countBySubject(items, s)} {c.noun}</Text>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

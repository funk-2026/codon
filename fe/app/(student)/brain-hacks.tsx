import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sparkle, Star, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { getBrainHackCategories, listBrainHacks, type BrainHack } from '@/src/api/discover';
import { MediaImage, type MediaMap } from '@/src/rich';
import { ROUTES } from '@/src/navigation/routes';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

const norm = (c: any): { key: string; label: string } => (typeof c === 'string' ? { key: c, label: c } : c);

export default function BrainHacksListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const minCount = useAppConfig().config?.limits.ratings.min_count_display ?? 5;

  const catQuery = useQuery({ queryKey: ['brain-hack-categories'], queryFn: getBrainHackCategories, select: (r) => (r.categories as any[]).map(norm) as { key: string; label: string }[], staleTime: 10 * 60_000 });
  const cats = catQuery.data ?? [];
  const [category, setCategory] = useState<string | undefined>();
  const list = useInfiniteQuery({
    queryKey: ['brain-hacks', category],
    queryFn: ({ pageParam }) => listBrainHacks({ category, limit: 20, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows: BrainHack[] = list.data?.pages.flatMap((p) => p.brain_hacks) ?? [];
  const media: MediaMap = Object.assign({}, ...(list.data?.pages.map((p) => p.media ?? {}) ?? []));
  const cursor = list.hasNextPage ? 'more' : null;
  const loading = list.isPending;
  const more = list.isFetchingNextPage;
  const error = list.isError;
  const load = () => void list.refetch();
  const loadMore = () => void list.fetchNextPage();




  const GAP = space.sm;
  const cardW = (width - space.md * 2 - GAP) / 2;
  const chip = (on: boolean) => ({
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <Screen>
      <ScreenHeader title="Free Brain Hacks." subtitle="Quick, practical tips — no course or subscription needed." />

      {cats.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: space.md }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
          <Pressable onPress={() => setCategory(undefined)} accessibilityRole="button" accessibilityState={{ selected: !category }} style={chip(!category)}>
            <Text style={[type['type/caption'], { color: !category ? color('accent/default') : color('text/secondary') }]}>All</Text>
          </Pressable>
          {cats.map((c) => (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} accessibilityRole="button" accessibilityState={{ selected: category === c.key }} style={chip(category === c.key)}>
              <Text style={[type['type/caption'], { color: category === c.key ? color('accent/default') : color('text/secondary') }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} width={cardW} height={170} radius={radius.md} />)}
          </View>
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load Brain Hacks" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Sparkle size={32} color={color('text/tertiary')} weight="duotone" />} title="New Brain Hacks are on the way" description={category ? 'Nothing in this category yet.' : 'Check back soon.'} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {rows.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => router.push({ pathname: ROUTES.student.brainHackDetail, params: { id: h.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.title}. ${h.category}. ${h.read_minutes} minute read`}
                  style={({ pressed }) => ({ width: cardW, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, minHeight: 150, opacity: pressed ? 0.94 : 1, gap: space.xs })}
                >
                  {h.cover_media_id && media[h.cover_media_id] ? (
                    <MediaImage media={media[h.cover_media_id]} variant="thumb" maxHeight={90} />
                  ) : (
                    <View style={{ width: 48, height: 48, backgroundColor: color('accent/tint'), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkle size={24} color={color('accent/default')} weight="duotone" />
                    </View>
                  )}
                  <Text style={[type['type/h3'], { color: color('text/primary'), fontSize: 15 }]} numberOfLines={2}>{h.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{h.category} · {h.read_minutes} min</Text>
                    {h.rating_count >= minCount ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Star size={12} weight="fill" color={color('semantic/warning')} />
                        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{h.rating_avg.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
            {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} style={{ marginTop: space.md }} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

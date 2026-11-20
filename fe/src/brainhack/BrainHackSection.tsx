import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Lightbulb, PlayCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getBrainHackCategories, listBrainHacks, type BrainHack } from '@/src/api/discover';
import { MediaImage, type MediaMap } from '@/src/rich';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

export const BRAIN_HACK_CATEGORIES = ['Speed Reading', 'Fourth Book', 'Sleep', 'Breathing'] as const;

const mmss = (s?: number) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** One section of the Brain Hack tab: a title, All plus the four categories, and its cards. Each section filters on its own. */
export function BrainHackSection({ kind, title }: { kind: 'article' | 'video'; title: string }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>();
  const cats = useQuery({ queryKey: ['brain-hack-categories'], queryFn: getBrainHackCategories, staleTime: 10 * 60_000, select: (r) => (r.categories as (string | { key: string; label: string })[]).map((c) => (typeof c === 'string' ? c : c.label ?? c.key)) });
  const categories = cats.data?.length ? cats.data : [...BRAIN_HACK_CATEGORIES];
  const q = useInfiniteQuery({
    queryKey: ['brain-hacks', kind, category],
    queryFn: ({ pageParam }) => listBrainHacks({ kind, category, limit: 10, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows: BrainHack[] = q.data?.pages.flatMap((p) => p.brain_hacks) ?? [];
  const media: MediaMap = Object.assign({}, ...(q.data?.pages.map((p) => p.media ?? {}) ?? []));

  const chip = (label: string, value: string | undefined) => {
    const on = category === value;
    return (
      <Pressable
        key={label}
        onPress={() => setCategory(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}
      >
        <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{title}</Text>
      {/* All the tags show at once, wrapping to a second line, so none hides off the edge of the screen. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {chip('All', undefined)}
        {categories.map((c) => chip(c, c))}
      </View>

      {q.isPending ? (
        <SkeletonBlock height={96} radius={radius.md} />
      ) : q.isError ? (
        <EmptyState icon={<Lightbulb size={28} color={color('semantic/danger')} />} title={`Couldn’t load ${title.toLowerCase()}`} description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
      ) : rows.length === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/tertiary'), paddingVertical: space.sm }]}>
          {category ? `No ${title.toLowerCase()} in ${category} yet.` : `New ${title.toLowerCase()} are on the way.`}
        </Text>
      ) : (
        <>
          {rows.map((h) => {
            const cover = h.cover_media_id ? media[h.cover_media_id] : undefined;
            const video = kind === 'video';
            return (
              <Pressable
                key={h.id}
                onPress={() => router.push({ pathname: video ? ROUTES.student.brainHackVideo : ROUTES.student.brainHackDetail, params: { id: h.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${h.title}. ${h.category}. ${video ? mmss(h.duration_seconds) || 'video' : `${h.read_minutes} minute read`}`}
                style={({ pressed }) => [{ flexDirection: 'row', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ width: 96, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                  {cover ? <MediaImage media={cover} variant="thumb" maxHeight={64} /> : video ? <PlayCircle size={32} color={color('accent/default')} weight="duotone" /> : <Lightbulb size={28} color={color('accent/default')} weight="duotone" />}
                  {video && cover ? <View style={{ position: 'absolute' }}><PlayCircle size={30} color="#fff" weight="fill" /></View> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{h.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{h.category} · {video ? mmss(h.duration_seconds) || 'Video' : `${h.read_minutes} min read`}</Text>
                </View>
              </Pressable>
            );
          })}
          {q.hasNextPage ? <SecondaryButton label={q.isFetchingNextPage ? 'Loading…' : 'Show more'} onPress={() => void q.fetchNextPage()} loading={q.isFetchingNextPage} /> : null}
        </>
      )}
    </View>
  );
}

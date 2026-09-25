import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, Sparkle, Star, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { getBrainHackCategories, listBrainHacks, type BrainHack } from '@/src/api/discover';
import { MediaImage, type MediaMap } from '@/src/rich';

const norm = (c: any): { key: string; label: string } => (typeof c === 'string' ? { key: c, label: c } : c);

export default function BrainHacksListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const minCount = useAppConfig().config?.limits.ratings.min_count_display ?? 5;

  const [cats, setCats] = useState<{ key: string; label: string }[]>([]);
  const [category, setCategory] = useState<string | undefined>();
  const [rows, setRows] = useState<BrainHack[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    getBrainHackCategories().then((r) => setCats((r.categories as any[]).map(norm))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const r = await listBrainHacks({ category, limit: 20 });
      if (my !== seq.current) return;
      setRows(r.brain_hacks);
      setMedia(r.media ?? {});
      setCursor(r.next_cursor);
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const r = await listBrainHacks({ category, limit: 20, cursor });
      setRows((p) => [...p, ...r.brain_hacks]);
      setMedia((m) => ({ ...m, ...(r.media ?? {}) }));
      setCursor(r.next_cursor);
    } finally {
      setMore(false);
    }
  };

  const GAP = space.sm;
  const cardW = (width - space.md * 2 - GAP) / 2;
  const chip = (on: boolean) => ({
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, marginTop: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Free Brain Hacks.</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Quick, practical tips — no course or subscription needed.</Text>
        </View>
      </View>

      {cats.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.md }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
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
                  onPress={() => router.push({ pathname: '/(student)/(home)/brain-hack-detail', params: { id: h.id } })}
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
    </SafeAreaView>
  );
}

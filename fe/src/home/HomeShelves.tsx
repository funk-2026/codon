import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Flame } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getHomeUpdates, listBrainHacks, type BrainHack, type HomeUpdate } from '@/src/api/discover';
import { MediaImage, type MediaMap } from '@/src/rich';

/**
 * Only in-app routes may be opened from server-supplied CTAs. A content editor
 * can't send a student to an arbitrary URL or a screen for another role.
 */
const ALLOWED_PREFIXES = ['/(student)/'];
export function safeRoute(route?: string): string | null {
  if (!route) return null;
  const r = route.trim();
  if (!r.startsWith('/') || r.includes('://') || r.includes('..')) return null;
  return ALLOWED_PREFIXES.some((p) => r.startsWith(p)) ? r : null;
}

/** Admin-curated updates. Renders NOTHING when there are none — no placeholder content (CM-E12). */
export function HomeUpdatesCarousel() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = width - space.md * 2;
  const [updates, setUpdates] = useState<HomeUpdate[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [slide, setSlide] = useState(0);
  const listRef = useRef<FlatList<HomeUpdate>>(null);
  const paused = useRef(false);

  useEffect(() => {
    getHomeUpdates().then((r) => { setUpdates(r.updates ?? []); setMedia(r.media ?? {}); }).catch(() => setUpdates([]));
  }, []);

  useEffect(() => {
    if (updates.length < 2) return;
    const t = setInterval(() => {
      if (paused.current) return;
      listRef.current?.scrollToIndex({ index: (slide + 1) % updates.length, animated: true });
    }, 6000);
    return () => clearInterval(t);
  }, [slide, updates.length]);

  const onViewable = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setSlide(first.index);
  }).current;

  if (updates.length === 0) return null;

  return (
    <View style={{ marginTop: space.lg }} accessibilityRole="summary">
      <FlatList
        ref={listRef}
        data={updates}
        keyExtractor={(u) => u.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(_, i) => ({ length: cardWidth, offset: cardWidth * i, index: i })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollBeginDrag={() => (paused.current = true)}
        onScrollEndDrag={() => (paused.current = false)}
        style={{ width: cardWidth }}
        renderItem={({ item }) => {
          const route = safeRoute(item.cta_route);
          const img = item.media_id ? media[item.media_id] : undefined;
          return (
            <View style={{ width: cardWidth - 12, marginRight: 12, backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md, minHeight: 140, gap: space.xs }}>
              {img ? <MediaImage media={img} variant="thumb" maxHeight={70} /> : null}
              <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{item.title}</Text>
              {item.body ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]} numberOfLines={2}>{item.body}</Text> : null}
              {route && item.cta_label ? (
                <Pressable onPress={() => router.push(route as Href)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{item.cta_label} →</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
      {updates.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xs, marginTop: space.xs }}>
          {updates.map((u, i) => (
            <View key={u.id} style={{ width: i === slide ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === slide ? color('accent/default') : color('border/strong') }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Horizontal strip of real Brain Hacks; hidden when there are none or the request fails. */
export function BrainHacksShelf() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.max(130, Math.min(200, (width - space.md * 2) / 2.6));
  const [rows, setRows] = useState<BrainHack[]>([]);

  const load = useCallback(() => {
    listBrainHacks({ limit: 6 }).then((r) => setRows(r.brain_hacks)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  if (rows.length === 0) return null;
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>FREE BRAIN HACKS</Text>
        <Pressable onPress={() => router.push('/(student)/(home)/brain-hacks')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type['type/caption'], { color: color('accent/default') }]}>See all →</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(h) => h.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(student)/(home)/brain-hack-detail', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.read_minutes} minute read`}
            style={({ pressed }) => ({ width: cardW, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, marginRight: space.sm, opacity: pressed ? 0.92 : 1, gap: space.xs })}
          >
            <View style={{ width: 40, height: 40, backgroundColor: color('accent/tint'), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={20} color={color('accent/default')} weight="duotone" />
            </View>
            <Text style={[type['type/h3'], { color: color('text/primary'), fontSize: 15 }]} numberOfLines={2}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

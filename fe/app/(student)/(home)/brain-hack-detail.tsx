import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getBrainHack, type BrainHack } from '@/src/api/discover';
import { MediaImage, RichContent, type MediaMap } from '@/src/rich';
import { StarRating } from '@/src/social/RatingControl';
import { ApiError } from '@/src/api/client';

export default function BrainHackDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [hack, setHack] = useState<BrainHack | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');

  const load = useCallback(async () => {
    if (!id) return setState('missing');
    setState('loading');
    try {
      const r = await getBrainHack(id);
      setHack(r.brain_hack);
      setMedia(r.media ?? {});
      setState('ready');
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {state === 'loading' ? (
          <View style={{ gap: 10, marginTop: space.lg }}>
            <SkeletonBlock width={90} height={22} radius={radius.pill} />
            <SkeletonBlock height={32} radius={radius.sm} />
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={16} radius={6} width={i === 3 ? '60%' : '100%'} />)}
          </View>
        ) : state !== 'ready' || !hack ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title={state === 'missing' ? 'This Brain Hack isn’t available' : 'Couldn’t load this Brain Hack'}
            description={state === 'missing' ? 'It may have been removed.' : 'Check your connection and try again.'}
            action={state === 'missing' ? <TextButton label="Back to Brain Hacks" onPress={() => router.replace('/(student)/(home)/brain-hacks')} /> : <TextButton label="Retry" onPress={load} />}
            style={{ marginTop: space.xl }}
          />
        ) : (
          <>
            {hack.cover_media_id && media[hack.cover_media_id] ? <View style={{ marginTop: space.md }}><MediaImage media={media[hack.cover_media_id]} /></View> : null}
            <View style={{ marginTop: space.lg }}>
              <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, alignSelf: 'flex-start' }}>
                <Text style={[type['type/caption'], { color: color('accent/default') }]}>{hack.category}</Text>
              </View>
              <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), marginTop: space.xs }]}>{hack.title}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>{hack.read_minutes} min read</Text>
            </View>
            <View style={{ marginTop: space.lg }}>
              <RichContent value={hack.body} format={hack.content_format} media={media} variant="stem" />
            </View>
            <View style={{ marginTop: space.xl }}>
              <StarRating itemType="brain_hack" itemId={hack.id} value={hack.my_rating ?? null} label="Was this helpful?" />
            </View>
            <View style={{ marginTop: space.md, alignItems: 'center' }}>
              <TextButton label="Back to Brain Hacks" onPress={() => router.replace('/(student)/(home)/brain-hacks')} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Lightbulb } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getBrainHack } from '@/src/api/discover';

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }} contentFit="contain" nativeControls allowsPictureInPicture fullscreenOptions={{ enable: true }} />;
}

/** One Brain Hack video: a player with play and pause, a scrub bar and fullscreen. */
export default function BrainHackVideoRoute() {
  const { color, type, space } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['brain-hack', id], queryFn: () => getBrainHack(String(id)), enabled: !!id });
  const h = q.data?.brain_hack;
  return (
    <Screen>
      <ScreenHeader title={h?.title ?? 'Video'} />
      {q.isPending ? (
        <View style={{ padding: space.md }}><SkeletonBlock height={220} /></View>
      ) : q.isError || !h?.video_url ? (
        <EmptyState icon={<Lightbulb size={32} color={color('text/tertiary')} />} title="This video isn’t available" description="It may have been removed. Try again in a moment." action={<TextButton label="Try again" onPress={() => void q.refetch()} />} />
      ) : (
        <>
          <Player url={h.video_url} />
          <View style={{ padding: space.md, gap: space['2xs'] }}>
            <Text style={[type['type/h2'], { color: color('text/primary') }]}>{h.title}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{h.category}</Text>
          </View>
        </>
      )}
    </Screen>
  );
}

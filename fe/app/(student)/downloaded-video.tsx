import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { VideoView, useVideoPlayer } from 'expo-video';
import { EmptyState, Screen, ScreenHeader } from '@/src/components';
import { listDownloads } from '@/src/video/downloads';

/** Plays a downloaded lecture from this phone. No connection or login check is needed. */
export default function DownloadedVideoRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['video-downloads'], queryFn: listDownloads });
  const hit = q.data?.find((d) => d.id === id);
  const player = useVideoPlayer(hit?.file ?? null, (p) => { p.play(); });
  return (
    <Screen>
      <ScreenHeader title={hit?.title ?? 'Downloaded video'} />
      {hit ? (
        <View style={{ backgroundColor: '#000' }}>
          <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="contain" nativeControls allowsPictureInPicture fullscreenOptions={{ enable: true, orientation: 'landscape' }} />
        </View>
      ) : (
        <EmptyState title="This download isn’t on the phone" description="It may have been removed." />
      )}
    </Screen>
  );
}

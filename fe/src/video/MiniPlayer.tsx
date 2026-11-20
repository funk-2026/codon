import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { VideoView } from 'expo-video';
import { Pause, Play, X } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useVideoSession } from './VideoSession';

/** A lesson that keeps playing over any screen. Tap it to go back to the lesson; X stops it. */
export function MiniPlayer() {
  const { space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { player, session, docked, close } = useVideoSession();
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  if (!session || !docked || pathname.includes('test-question')) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: insets.bottom + 72, paddingHorizontal: space.md }]}
    >
      <Pressable
        onPress={() => router.push({ pathname: ROUTES.student.videoPlayer, params: { id: session.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${session.title}. Tap to return to the lesson`}
        style={[{ width: 180, height: 101, backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' }, shadow()]}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
          <Pressable
            onPress={() => (isPlaying ? player.pause() : player.play())}
            hitSlop={space.sm}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? <Pause size={28} color="#fff" weight="fill" /> : <Play size={28} color="#fff" weight="fill" />}
          </Pressable>
        </View>
        <Pressable
          onPress={() => { player.pause(); close(); }}
          hitSlop={space.sm}
          accessibilityRole="button"
          accessibilityLabel="Close the lesson"
          style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color="#fff" weight="bold" />
        </Pressable>
      </Pressable>
    </View>
  );
}

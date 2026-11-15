import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { player, session, docked, close } = useVideoSession();
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  if (!session || !docked || pathname.includes('test-question')) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', paddingBottom: insets.bottom + 72, paddingHorizontal: space.md }]}
    >
      <Pressable
        onPress={() => router.push({ pathname: ROUTES.student.videoPlayer, params: { id: session.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${session.title}. Tap to return to the lesson`}
        style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}
      >
        <View style={{ width: 128, height: 72, backgroundColor: '#000' }}>
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} pointerEvents="none" />
        </View>
        <Text numberOfLines={2} style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1, paddingHorizontal: space.sm }]}>
          {session.title}
        </Text>
        <Pressable
          onPress={() => (isPlaying ? player.pause() : player.play())}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          {isPlaying ? <Pause size={24} color={color('text/primary')} weight="fill" /> : <Play size={24} color={color('text/primary')} weight="fill" />}
        </Pressable>
        <Pressable
          onPress={() => { player.pause(); close(); }}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Close the lesson"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} color={color('text/tertiary')} weight="bold" />
        </Pressable>
      </Pressable>
    </View>
  );
}

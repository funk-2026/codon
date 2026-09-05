import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CaretLeft, Play, Pause, X, GridFour, WarningCircle, LockSimple } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getContentItem, getChapterContent, ContentItem, sendHeartbeat } from '@/src/api/content';
import { ApiError } from '@/src/api/client';
import { EmptyState, PrimaryButton, SkeletonBlock, TextButton } from '@/src/components';



const SPEEDS = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];
const SPEED_VALUES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayerRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [siblings, setSiblings] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    setAccessDenied(false);
    getContentItem(id)
      .then((res) => {
        setContent(res.content);
        setVideoUrl(res.url);
        return getChapterContent(res.content.chapter_id);
      })
      .then((chRes) => {
        setSiblings(chRes.content.filter((c) => c.id !== id));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
        } else {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const player = useVideoPlayer(videoUrl || null, (p) => {
    p.timeUpdateEventInterval = 0.5;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { status: playerStatus } = useEvent(player, 'statusChange', { status: player.status });
  const duration = player.duration || 0;

  const [controlsVisible, setControlsVisible] = useState(true);
  const [floating, setFloating] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPlaying || !controlsVisible || floating) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isPlaying, controlsVisible, floating]);

  useEffect(() => {
    if (!isPlaying || !id || duration <= 0) return;
    const t = setInterval(() => {
      sendHeartbeat(id, Math.floor(currentTime), currentTime >= duration - 5).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [isPlaying, currentTime, duration, id]);

  const floatScale = useSharedValue(0);
  useEffect(() => {
    floatScale.value = withTiming(floating ? 1 : 0, { duration: 280 });
  }, [floating, floatScale]);

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    setControlsVisible(true);
  };
  const selectSpeed = (i: number) => {
    setSpeedIdx(i);
    player.playbackRate = SPEED_VALUES[i];
    setSpeedMenuOpen(false);
  };

  const fullStyle = useAnimatedStyle(() => ({
    opacity: 1 - floatScale.value,
    transform: [{ scale: 1 - floatScale.value * 0.04 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    opacity: floatScale.value,
  }));

  const videoNotReady = !loading && !loadError && !accessDenied && !videoUrl;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Full-screen mode */}
      <Animated.View style={[styles.fullWrap, fullStyle]}>
        {/* Video canvas */}
        <Pressable
          onPress={() => setControlsVisible((v) => !v)}
          style={[styles.canvas, { backgroundColor: '#000', paddingTop: insets.top }]}
        >
          <View style={styles.canvasInner}>
            {videoUrl ? (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
              />
            ) : null}

            {videoNotReady ? (
              <View style={styles.centerMessage}>
                <Text style={[type['type/body-m'], { color: '#fff', textAlign: 'center' }]}>
                  {content?.video_status === 'failed'
                    ? "This video couldn't be processed."
                    : 'This video is still processing — check back soon.'}
                </Text>
              </View>
            ) : null}

            {videoUrl && playerStatus === 'readyToPlay' && !isPlaying ? (
              <View style={styles.centerPlay}>
                <Pressable
                  onPress={togglePlay}
                  style={({ pressed }) => [
                    styles.playBtn,
                    {
                      backgroundColor: pressed ? color('accent/pressed') : color('accent/default'),
                      borderRadius: 32,
                    },
                  ]}
                >
                  <Play size={32} color={color('accent/on-accent')} weight="fill" />
                </Pressable>
              </View>
            ) : null}

            {controlsVisible ? (
              <>
                <View style={[styles.topScrim, styles.topRow, { paddingHorizontal: space.md }]}>
                  <Pressable
                    onPress={() => setFloating(true)}
                    hitSlop={space.xs}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <CaretLeft size={26} color="#fff" />
                  </Pressable>
                  <Text
                    style={[type['type/body-m-medium'], { color: '#fff', flex: 1, marginLeft: space.sm }]}
                    numberOfLines={1}
                  >
                    {content?.title || 'Loading...'}
                  </Text>
                </View>

                <View style={[styles.bottomScrim, { paddingHorizontal: space.md, paddingBottom: space.sm }]}>
                  <View style={[styles.controlsRow, { gap: space.sm }]}>
                    <Pressable onPress={togglePlay} hitSlop={space.xs}>
                      {isPlaying ? (
                        <Pause size={28} color="#fff" weight="fill" />
                      ) : (
                        <Play size={28} color="#fff" weight="fill" />
                      )}
                    </Pressable>
                    <Text style={[type['type/caption'], { color: '#fff' }]}>{mm(currentTime)}</Text>
                    <View
                      style={{
                        flex: 1,
                        height: 4,
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: 2,
                      }}
                    >
                      <View
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                          height: 4,
                          backgroundColor: color('accent/default'),
                          borderRadius: 2,
                        }}
                      />
                    </View>
                    <Text style={[type['type/caption'], { color: '#fff' }]}>{mm(duration)}</Text>
                    <Pressable
                      onPress={() => setSpeedMenuOpen((o) => !o)}
                      hitSlop={space.xs}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: radius.pill,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={[type['type/caption'], { color: '#fff' }]}>{SPEEDS[speedIdx]}</Text>
                    </Pressable>
                    <GridFour size={22} color="#fff" />
                  </View>
                  {speedMenuOpen ? (
                    <View style={[styles.speedMenu, { gap: 4, marginTop: space.xs }]}>
                      {SPEEDS.map((s, i) => (
                        <Pressable
                          key={s}
                          onPress={() => selectSpeed(i)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: i === speedIdx ? 'rgba(255,255,255,0.25)' : 'transparent',
                          }}
                        >
                          <Text style={[type['type/caption'], { color: '#fff' }]}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </Pressable>

        {/* Below-canvas panel */}
        <View style={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}>
          {loading ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <SkeletonBlock height={28} width="70%" />
              <SkeletonBlock height={16} width="40%" />
              <View style={{ marginTop: space.md, gap: space.xs }}>
                <SkeletonBlock height={14} width="45%" />
                <SkeletonBlock height={56} radius={radius.md} />
                <SkeletonBlock height={56} radius={radius.md} />
              </View>
            </View>
          ) : loadError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load this video"
              description="Something went wrong loading this lesson. Check your connection and try again."
              action={<TextButton label="Retry" onPress={load} />}
              style={{ marginTop: space.md }}
            />
          ) : accessDenied ? (
            <EmptyState
              icon={<LockSimple size={32} color={color('text/tertiary')} weight="fill" />}
              title="Subscription required"
              description="Subscribe to a plan to unlock this video."
              action={
                <PrimaryButton
                  label="View Plans"
                  onPress={() => router.replace('/(student)/(profile)/subscription-plans')}
                />
              }
              style={{ marginTop: space.md }}
            />
          ) : (
            <>
              <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.md }]}>
                {content?.title || 'Loading...'}
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                Video Lesson
              </Text>
              <Text
                style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.lg, marginBottom: space.sm }]}
              >
                MORE IN THIS CHAPTER
              </Text>
              <View style={{ gap: space.xs }}>
                {siblings.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: '/(student)/(learn)/video-player', params: { id: s.id } })}
                    style={({ pressed }) => [
                      styles.siblingRow,
                      {
                        backgroundColor: color('bg/surface'),
                        borderRadius: radius.md,
                        padding: space.sm,
                        opacity: pressed ? 0.94 : 1,
                      },
                      shadow(),
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                        numberOfLines={1}
                      >
                        {s.title}
                      </Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        {s.content_type === 'video' ? 'Video' : 'Document'}
                      </Text>
                    </View>
                    <CaretLeft size={18} color={color('text/tertiary')} style={{ transform: [{ rotate: '180deg' }] }} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Floating mini-player */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 80 + insets.bottom,
            right: space.md,
            width: 148,
            height: 84,
            backgroundColor: '#000',
            borderRadius: radius.md,
            overflow: 'hidden',
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          },
          floatStyle,
        ]}
        pointerEvents={floating ? 'auto' : 'none'}
      >
        <Pressable
          onPress={() => setFloating(false)}
          style={{ width: 148, height: 84, backgroundColor: '#000' }}
        >
          {videoUrl ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.floatProgress}>
            <View
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                height: 2,
                backgroundColor: color('accent/default'),
              }}
            />
          </View>
          <View style={styles.floatControls}>
            <Pressable onPress={togglePlay} hitSlop={space.xs}>
              {isPlaying ? (
                <Pause size={20} color="#fff" weight="fill" />
              ) : (
                <Play size={20} color="#fff" weight="fill" />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setFloating(false);
                player.pause();
                router.back();
              }}
              hitSlop={space.xs}
              style={{ position: 'absolute', top: 2, right: 2 }}
            >
              <X size={16} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function shadow() {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullWrap: { flex: 1 },
  canvas: { width: '100%', aspectRatio: 16 / 9 },
  canvasInner: { flex: 1, position: 'relative' },
  centerPlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerMessage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  playBtn: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 8,
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  speedMenu: { alignItems: 'flex-end' },
  siblingRow: { flexDirection: 'row', alignItems: 'center' },
  floatProgress: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  floatControls: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

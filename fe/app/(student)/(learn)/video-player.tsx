import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, Play, Pause, X, GridFour } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getContentItem, getChapterContent, ContentItem } from '@/src/api/content';
import { SkeletonBlock } from '@/src/components';



const SPEEDS = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];

export default function VideoPlayerRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [siblings, setSiblings] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    getContentItem(id)
      .then((res) => {
        setContent(res.content);
        return getChapterContent(res.content.chapter_id);
      })
      .then((chRes) => {
        setSiblings(chRes.content.filter(c => c.id !== id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const [playing, setPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [floating, setFloating] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [elapsed, setElapsed] = useState(14 * 60 + 22);
  const duration = 20 * 60;

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing || !controlsVisible || floating) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, controlsVisible, floating]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => Math.min(e + 1, duration)), 1000);
    return () => clearInterval(t);
  }, [playing, duration]);

  const floatScale = useSharedValue(0);
  useEffect(() => {
    floatScale.value = withTiming(floating ? 1 : 0, { duration: 280 });
  }, [floating, floatScale]);

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const togglePlay = () => {
    setPlaying((p) => !p);
    setControlsVisible(true);
  };
  const cycleSpeed = () => {
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
  };

  const fullStyle = useAnimatedStyle(() => ({
    opacity: 1 - floatScale.value,
    transform: [{ scale: 1 - floatScale.value * 0.04 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    opacity: floatScale.value,
  }));

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
            {playing ? null : (
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
            )}

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
                      {playing ? (
                        <Pause size={28} color="#fff" weight="fill" />
                      ) : (
                        <Play size={28} color="#fff" weight="fill" />
                      )}
                    </Pressable>
                    <Text style={[type['type/caption'], { color: '#fff' }]}>{mm(elapsed)}</Text>
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
                          width: `${(elapsed / duration) * 100}%`,
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
                          onPress={() => {
                            setSpeedIdx(i);
                            setSpeedMenuOpen(false);
                          }}
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
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.md }]}>
            {content?.title || 'Loading...'}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            Video Lesson
          </Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.md }]}>
            {/* We don't have a description on content item currently */}
            This is a video lesson.
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
          <View style={styles.floatProgress}>
            <View
              style={{
                width: `${(elapsed / duration) * 100}%`,
                height: 2,
                backgroundColor: color('accent/default'),
              }}
            />
          </View>
          <View style={styles.floatControls}>
            <Pressable onPress={togglePlay} hitSlop={space.xs}>
              {playing ? (
                <Pause size={20} color="#fff" weight="fill" />
              ) : (
                <Play size={20} color="#fff" weight="fill" />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setFloating(false);
                setPlaying(false);
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

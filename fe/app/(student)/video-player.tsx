import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { isPictureInPictureSupported, VideoView, VideoTrack } from 'expo-video';
import { useVideoSession } from '@/src/video/VideoSession';
import { VideoNotesPanel } from '@/src/video/VideoNotesPanel';
import { track } from '@/src/analytics/track';
import { CaretLeft, PictureInPicture, ArrowsInSimple, WarningCircle, LockSimple } from 'phosphor-react-native';
import { BookmarkToggle } from '@/src/bookmarks/BookmarkToggle';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getContentItem, getChapterContent, ContentItem, sendHeartbeat, type LecturePDFs } from '@/src/api/content';
import { LecturePdfDownloads } from '@/src/content/LecturePdfDownloads';

const WATCHED_FRACTION = 0.9;
const pdfsOf = (r: LecturePDFs): LecturePDFs => ({
  has_notes_pdf: r.has_notes_pdf, notes_pdf_url: r.notes_pdf_url,
  has_annotated_pdf: r.has_annotated_pdf, annotated_pdf_url: r.annotated_pdf_url, annotated_pdf_locked: r.annotated_pdf_locked,
});
import { ApiError } from '@/src/api/client';
import { EmptyState, PrimaryButton, SkeletonBlock, TextButton, Screen } from '@/src/components';
import { ROUTES } from '@/src/navigation/routes';
import { useSafeBack } from '@/src/navigation/useSafeBack';
import { shadow } from '@/src/theme/elevation';



const SPEEDS = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];
const SPEED_VALUES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayerRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { player, start, dock, close, currentId } = useVideoSession();

  // Where to pick up, taken from the server when the lecture opens and used once the player is ready.
  const resumeAt = useRef(0);
  const [content, setContent] = useState<ContentItem | null>(null);
  const [pdfs, setPdfs] = useState<LecturePDFs | null>(null);
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
        // Coming back from the small player: the player is already at the right spot, so don't jump.
        const alreadyLoaded = currentId() === id;
        resumeAt.current = !alreadyLoaded && res.progress_seconds && res.progress_seconds > 5 ? res.progress_seconds : 0;
        if (res.url) start({ id: String(id), title: res.content.title, url: res.url });
        track('video.started', { resumed: resumeAt.current > 0 });
        setPdfs(pdfsOf(res));
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
  }, [id, start, currentId]);

  useEffect(() => {
    load();
  }, [load]);

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { status: playerStatus } = useEvent(player, 'statusChange', { status: player.status });
  const duration = player.duration || 0;

  useEffect(() => {
    if (playerStatus !== 'readyToPlay' || resumeAt.current <= 0) return;
    const to = resumeAt.current;
    resumeAt.current = 0;
    // Don't jump to the very end if they had nearly finished.
    if (!player.duration || to < player.duration - 10) player.currentTime = to;
  }, [playerStatus, player]);

  const videoViewRef = useRef<VideoView>(null);
  // Leaving by Back stops the lesson; leaving through the small-player button keeps it going.
  const dockingRef = useRef(false);
  useEffect(() => {
    dockingRef.current = false;
    return () => {
      if (!dockingRef.current && id) close(String(id));
    };
  }, [id, close]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityTracks, setQualityTracks] = useState<VideoTrack[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPlaying || !controlsVisible) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isPlaying, controlsVisible]);

  // Watch-progress heartbeat. currentTime updates every 0.5 s, so it's read from a
  // ref — depending on it directly restarted the 10 s interval before it ever fired,
  // and progress was never saved. A lecture counts as watched at 90 %.
  const timeRef = useRef(0);
  useEffect(() => {
    timeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    if (!isPlaying || !id) return;
    const beat = () => {
      const d = player.duration || 0;
      if (d > 0) sendHeartbeat(id, Math.floor(timeRef.current), timeRef.current >= d * WATCHED_FRACTION).catch(() => {});
    };
    const t = setInterval(beat, 10000);
    return () => {
      clearInterval(t);
      beat(); // pause / leave: save where they stopped
    };
  }, [isPlaying, id, player]);

  // Crossing 90 %: record completion now and refresh, so the annotated PDF unlocks on the spot.
  const completedSent = useRef(false);
  useEffect(() => {
    if (!id || completedSent.current || duration <= 0 || currentTime < duration * WATCHED_FRACTION) return;
    completedSent.current = true;
    sendHeartbeat(id, Math.floor(currentTime), true)
      .then(() => getContentItem(id))
      .then((res) => setPdfs(pdfsOf(res)))
      .catch(() => {});
  }, [currentTime, duration, id]);

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

  useEffect(() => {
    const sub = player.addListener('sourceLoad', (payload) => {
      setQualityTracks(payload.availableVideoTracks);
    });
    return () => sub.remove();
  }, [player]);

  const qualityOptions = [
    { label: 'Auto', track: null },
    ...qualityTracks
      .filter(t => t.size.height > 0)
      .sort((a, b) => b.size.height - a.size.height)
      .map(t => ({ label: `${t.size.height}p`, track: t })),
  ];

  const selectQuality = (track: VideoTrack | null) => {
    if (!videoUrl) return;
    const savedTime = player.currentTime;
    const wasPlaying = player.playing;
    
    if (track === null) {
      player.replace(videoUrl);
    } else {
      const bwHintMbps = ((track.peakBitrate ?? track.averageBitrate ?? 2_000_000) / 1_000_000).toFixed(1);
      const separator = videoUrl.includes('?') ? '&' : '?';
      player.replace(`${videoUrl}${separator}clientBandwidthHint=${bwHintMbps}`);
    }
    
    setTimeout(() => {
      player.currentTime = savedTime;
      if (wasPlaying) player.play();
    }, 300);
    
    setSelectedQuality(track?.id ?? null);
    setQualityMenuOpen(false);
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      videoViewRef.current?.exitFullscreen();
    } else {
      videoViewRef.current?.enterFullscreen();
    }
  };

  // Turned sideways, a full-width 16:9 video is taller than the screen and pushes everything below it out of
  // reach. Cap its height to about half the screen so the title, notes and next lessons stay scrollable.
  const { width: winW, height: winH } = useWindowDimensions();
  const landscape = winW > winH;
  const videoBox = landscape
    ? ({ height: Math.round(winH * 0.55), width: '100%' } as const)
    : ({ width: '100%', aspectRatio: 16 / 9 } as const);

  const videoNotReady = !loading && !loadError && !accessDenied && !videoUrl;

  return (
    <Screen>
      {/* Full-screen mode */}
      <View style={styles.fullWrap}>
        {/* Video canvas */}
        <View style={{ backgroundColor: '#000' }}>
          {videoUrl ? (
            <VideoView
              ref={videoViewRef}
              player={player}
              style={videoBox}
              contentFit="contain"
              nativeControls
              allowsPictureInPicture
              startsPictureInPictureAutomatically
              fullscreenOptions={{ enable: true, orientation: 'landscape' }}
            />
          ) : videoNotReady ? (
            <View style={{ width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={[type['type/body-m'], { color: '#fff', textAlign: 'center' }]}>
                {content?.video_status === 'failed'
                  ? "This video couldn't be processed."
                  : 'This video is still processing — check back soon.'}
              </Text>
            </View>
          ) : (
            <View style={{ width: '100%', height: 200 }} />
          )}

          <View style={[styles.topRow, { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md, paddingTop: space.sm, justifyContent: 'space-between' }]} pointerEvents="box-none">
            {/* Back really goes back — the mini player is opt-in only (button on the right). */}
            <Pressable
              onPress={() => goBack()}
              hitSlop={space.xs}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                backgroundColor: 'rgba(0,0,0,0.4)',
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <CaretLeft size={24} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {videoUrl ? (
                <Pressable
                  onPress={() => {
                    dockingRef.current = true;
                    dock();
                    goBack();
                  }}
                  hitSlop={space.xs}
                  accessibilityRole="button"
                  accessibilityLabel="Keep watching in a small player while you browse"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' })}
                >
                  <ArrowsInSimple size={22} color="#fff" />
                </Pressable>
              ) : null}
              {videoUrl && isPictureInPictureSupported() ? (
                <Pressable
                  onPress={() => void videoViewRef.current?.startPictureInPicture().catch(() => {})}
                  hitSlop={space.xs}
                  accessibilityRole="button"
                  accessibilityLabel="Picture in picture, float the video over other apps"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' })}
                >
                  <PictureInPicture size={22} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Below-canvas panel */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
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
                  onPress={() => router.replace(ROUTES.student.subscriptionPlans)}
                />
              }
              style={{ marginTop: space.md }}
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: space.md }}>
                <Text style={[type['type/h2'], { color: color('text/primary'), flex: 1 }]}>
                  {content?.title || 'Loading...'}
                </Text>
                <BookmarkToggle type="content" id={content?.id} />
              </View>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                Video Lesson{content?.author_name ? ` · By ${content.author_name}` : ''}
              </Text>
              {pdfs && (pdfs.has_notes_pdf || pdfs.has_annotated_pdf) ? (
                <LecturePdfDownloads pdfs={pdfs} title={content?.title ?? 'Lecture'} />
              ) : null}
              {id ? (
                <VideoNotesPanel
                  contentId={String(id)}
                  currentTime={currentTime}
                  onPause={() => player.pause()}
                  onSeek={(t) => {
                    player.currentTime = t;
                  }}
                />
              ) : null}
              <Text
                style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.lg, marginBottom: space.sm }]}
              >
                MORE IN THIS CHAPTER
              </Text>
              <View style={{ gap: space.xs }}>
                {siblings.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.replace({ pathname: ROUTES.student.videoPlayer, params: { id: s.id } })}
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
        </ScrollView>
      </View>
    </Screen>
  );
}


const styles = StyleSheet.create({
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
  floatControls: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

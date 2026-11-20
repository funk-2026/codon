import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { isPictureInPictureSupported, VideoView, VideoTrack } from 'expo-video';
import { useVideoSession } from '@/src/video/VideoSession';
import { VideoNotesPanel } from '@/src/video/VideoNotesPanel';
import { track } from '@/src/analytics/track';
import { CaretLeft, PictureInPicture, ArrowsInSimple, WarningCircle, LockSimple, ArrowClockwise, ArrowCounterClockwise, Play, Pause, FlagBanner, Exam, DownloadSimple, CheckCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getContentItem, ContentItem, sendHeartbeat, setLectureCompleted, type LecturePDFs } from '@/src/api/content';
import { submitFeedback } from '@/src/api/feedback';
import { PLAYBACK_SPEEDS, speedLabel } from '@/src/video/lectureState';
import { LecturePdfDownloads } from '@/src/content/LecturePdfDownloads';
import { downloadVideo, listDownloads, mp4Url } from '@/src/video/downloads';
import { MediaImage } from '@/src/rich';

const WATCHED_FRACTION = 0.9;
const pdfsOf = (r: LecturePDFs): LecturePDFs => ({
  has_notes_pdf: r.has_notes_pdf, notes_pdf_url: r.notes_pdf_url,
  has_annotated_pdf: r.has_annotated_pdf, annotated_pdf_url: r.annotated_pdf_url, annotated_pdf_locked: r.annotated_pdf_locked,
  has_fourth_book_pdf: r.has_fourth_book_pdf, fourth_book_pdf_url: r.fourth_book_pdf_url,
  has_board_questions_pdf: r.has_board_questions_pdf, board_questions_pdf_url: r.board_questions_pdf_url,
});
import { ApiError } from '@/src/api/client';
import { BottomSheet, ConfirmDialog, EmptyState, InputField, PrimaryButton, SkeletonBlock, TextButton, Screen, useToast } from '@/src/components';
import { ROUTES } from '@/src/navigation/routes';
import { useSafeBack } from '@/src/navigation/useSafeBack';
import { shadow } from '@/src/theme/elevation';




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
  type Meta = { subject?: string; chapter?: string; qbank?: string; completed: boolean };
  const [cover, setCover] = useState<import('@/src/rich/ast').MediaView | undefined>();
  const [dl, setDl] = useState<{ state: 'idle' | 'busy' | 'done'; pct: number }>({ state: 'idle', pct: 0 });
  const [meta, setMeta] = useState<Meta>({ completed: false });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [reporting, setReporting] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const { show } = useToast();
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
        setCover(res.chapter_cover);
        void listDownloads().then((all) => setDl(all.some((d) => d.id === String(id)) ? { state: 'done', pct: 1 } : { state: 'idle', pct: 0 }));
        setMeta({ subject: res.subject_name, chapter: res.chapter_name, qbank: res.related_qbank_test_id, completed: !!res.is_completed });
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
  const [speedIdx, setSpeedIdx] = useState(PLAYBACK_SPEEDS.indexOf(1));
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
      if (d > 0) sendHeartbeat(id, Math.floor(timeRef.current), timeRef.current >= d * WATCHED_FRACTION, d).catch(() => {});
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
    player.playbackRate = PLAYBACK_SPEEDS[i];
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
            <View style={{ width: '100%', height: 200, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {cover ? <MediaImage media={cover} variant="display" maxHeight={200} /> : null}
            </View>
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
              {videoUrl && mp4Url(videoUrl) ? (
                <Pressable
                  disabled={dl.state !== 'idle'}
                  onPress={() => {
                    setDl({ state: 'busy', pct: 0 });
                    downloadVideo({ id: String(id), title: content?.title ?? 'Lecture', subject: meta?.subject, chapter: meta?.chapter, hlsUrl: videoUrl }, (f) => setDl({ state: 'busy', pct: f }))
                      .then(() => { setDl({ state: 'done', pct: 1 }); show('Downloaded. Find it under Video › Downloaded Videos.', 'success'); })
                      .catch(() => { setDl({ state: 'idle', pct: 0 }); show('Couldn’t download this lecture. It may not be available offline.', 'error'); });
                  }}
                  hitSlop={space.xs}
                  accessibilityRole="button"
                  accessibilityLabel={dl.state === 'done' ? 'Downloaded' : dl.state === 'busy' ? `Downloading, ${Math.round(dl.pct * 100)} percent` : 'Download this lecture'}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, minWidth: 40, height: 40, paddingHorizontal: dl.state === 'busy' ? 10 : 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 })}
                >
                  {dl.state === 'done' ? <CheckCircle size={22} color="#fff" weight="fill" /> : <DownloadSimple size={22} color="#fff" />}
                  {dl.state === 'busy' ? <Text style={{ color: '#fff', fontSize: 12 }}>{Math.round(dl.pct * 100)}%</Text> : null}
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
              description="Couldn’t load this lesson. Check your connection and try again."
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
              {/* 15-second seeks and play or pause, then the eight speeds */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, marginTop: space.md }}>
                <Pressable onPress={() => { player.currentTime = Math.max(0, player.currentTime - 15); }} accessibilityRole="button" accessibilityLabel="Back 15 seconds" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color('bg/surface'), alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowCounterClockwise size={26} color={color('text/primary')} />
                </Pressable>
                <Pressable onPress={togglePlay} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color('action/primary'), alignItems: 'center', justifyContent: 'center' }}>
                  {isPlaying ? <Pause size={28} color={color('action/on-primary')} weight="fill" /> : <Play size={28} color={color('action/on-primary')} weight="fill" />}
                </Pressable>
                <Pressable onPress={() => { player.currentTime = Math.min(duration || Infinity, player.currentTime + 15); }} accessibilityRole="button" accessibilityLabel="Forward 15 seconds" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color('bg/surface'), alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowClockwise size={26} color={color('text/primary')} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, marginTop: space.sm }} accessibilityRole="radiogroup">
                {PLAYBACK_SPEEDS.map((sp, i) => {
                  const on = i === speedIdx;
                  return (
                    <Pressable key={sp} onPress={() => selectSpeed(i)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Speed ${speedLabel(sp)}`} style={{ minHeight: 36, minWidth: 52, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}>
                      <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{speedLabel(sp)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Subject, then chapter, then the teacher */}
              <View style={{ marginTop: space.lg, gap: 2 }}>
                {meta.subject ? <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>{meta.subject}</Text> : null}
                {meta.chapter ? <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>{meta.chapter}</Text> : null}
                <Text style={[type['type/h2'], { color: color('text/primary') }]}>{content?.title || 'Loading...'}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{content?.author_name ?? ''}</Text>
              </View>

              {pdfs ? <LecturePdfDownloads pdfs={pdfs} title={content?.title ?? 'Lecture'} /> : null}

              <View style={{ marginTop: space.md }}>
                <Pressable onPress={() => setReportOpen(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                  <FlagBanner size={20} color={color('text/secondary')} />
                  <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Report a problem with this lecture</Text>
                </Pressable>
              </View>

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

              {/* The QBank module of this same chapter, matched by chapter id */}
              {meta.qbank ? (
                <Pressable
                  onPress={() => router.push({ pathname: ROUTES.student.testPreStart, params: { id: meta.qbank } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
                >
                  <Exam size={26} color={color('accent/default')} weight="duotone" />
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>Practice this chapter</Text>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{meta.chapter ? `${meta.chapter} · QBank` : 'QBank'}</Text>
                  </View>
                  <CaretLeft size={18} color={color('text/tertiary')} style={{ transform: [{ rotate: '180deg' }] }} />
                </Pressable>
              ) : null}

              <View style={{ marginTop: space.lg }}>
                <PrimaryButton
                  label={meta.completed ? 'Completed. Tap to undo' : 'Mark complete'}
                  onPress={async () => {
                    if (meta.completed) return setConfirmUndo(true);
                    try {
                      await setLectureCompleted(String(id), true);
                      setMeta((m) => ({ ...m, completed: true }));
                      show('Marked complete', 'success');
                    } catch {
                      show('Couldn’t update. Try again.', 'error');
                    }
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <ConfirmDialog
        visible={confirmUndo}
        title="Mark as not completed?"
        message="This lecture will count as not finished again."
        confirmLabel="Mark not completed"
        onCancel={() => setConfirmUndo(false)}
        onConfirm={async () => {
          setConfirmUndo(false);
          try {
            await setLectureCompleted(String(id), false);
            setMeta((m) => ({ ...m, completed: false }));
          } catch {
            show('Couldn’t update. Try again.', 'error');
          }
        }}
      />
      <BottomSheet visible={reportOpen} onClose={() => !reporting && setReportOpen(false)} title="Report a problem" dismissable={!reporting}>
        <View style={{ gap: space.md, paddingBottom: space.lg }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Tell us what went wrong with this lecture. We note the lecture and the moment you were at.</Text>
          <InputField label="What happened?" value={reportNote} onChangeText={setReportNote} multiline maxLength={800} />
          <PrimaryButton
            label="Send"
            loading={reporting}
            disabled={reportNote.trim().length < 5}
            onPress={async () => {
              setReporting(true);
              try {
                const at = Math.floor(currentTime);
                await submitFeedback({ category: 'Lecture problem', message: `${reportNote.trim()}\n\nLecture: ${content?.title ?? ''} (${id}) at ${Math.floor(at / 60)}:${String(at % 60).padStart(2, '0')}` });
                show('Sent. Thank you.', 'success');
                setReportOpen(false);
                setReportNote('');
              } catch {
                show('Couldn’t send. Try again.', 'error');
              } finally {
                setReporting(false);
              }
            }}
          />
        </View>
      </BottomSheet>
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

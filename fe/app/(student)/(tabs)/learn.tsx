import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useQueries, useQuery } from '@tanstack/react-query';
import { DownloadSimple, MonitorPlay, PlayCircle } from 'phosphor-react-native';
import { CollapsingHeader, EmptyState, ErrorBanner, ProgressLink, SearchBar, ShortcutCard, SkeletonBlock, SubjectCard, SUBJECT_SKELETON_HEIGHT, TextButton, useCollapsingHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getCurriculum } from '@/src/api/courses';
import { subjectOrder } from '@/src/bookmarks/logic';
import { ROUTES } from '@/src/navigation/routes';
import { listSubjectVideos } from '@/src/api/content';
import { lectureState } from '@/src/video/lectureState';
import { TabHeaderActions } from '@/src/components/TabHeaderActions';
import { usePullRefresh, RefreshPill } from '@/src/components/PullRefresh';

/** Video: the analytics entry, then exactly Biology, Chemistry and Physics. A subject opens its own page of lectures. */
export default function VideoTabRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const header = useCollapsingHeader(64);
  const pull = usePullRefresh(header.maxHeight);
  const cur = useQuery({ queryKey: ['curriculum', user?.selected_course_id], queryFn: () => getCurriculum(String(user?.selected_course_id)), enabled: !!user?.selected_course_id, staleTime: 10 * 60_000 });
  const subjects = subjectOrder(cur.data?.course.subjects ?? []);
  // Lectures watched per subject: the same lists the subject page uses, so opening a subject is instant.
  const lectures = useQueries({ queries: subjects.map((s) => ({ queryKey: ['subject-videos', s.id], queryFn: () => listSubjectVideos(s.id), staleTime: 60_000 })) });

  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>Video</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Watch chapter by chapter</Text>
            </View>
            <TabHeaderActions size="large" />
          </View>
        }
        compact={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>Video</Text><TabHeaderActions size="small" /></View>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        refreshControl={pull.control}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        <SearchBar placeholder="Search video lectures" onPress={() => router.push(ROUTES.student.search)} />
        <ProgressLink title="My video progress" onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: 'video' } })} />

        {cur.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={SUBJECT_SKELETON_HEIGHT} radius={radius.lg} />)
        ) : cur.isError ? (
          <ErrorBanner onRetry={() => void cur.refetch()} />
        ) : subjects.length === 0 ? (
          <EmptyState icon={<MonitorPlay size={32} color={color('text/tertiary')} />} title="No subjects yet" description="Video classes will appear here as they are published." action={<TextButton label="Refresh" onPress={() => void cur.refetch()} />} />
        ) : (
          subjects.map((s, i) => {
            const vids = lectures[i]?.data?.videos;
            const progress = vids ? { done: vids.filter((v) => lectureState(v) === 'completed').length, total: vids.length, unit: 'lectures' } : undefined;
            return (
              <SubjectCard
                key={s.id}
                icon={<MonitorPlay size={28} color={color('accent/default')} weight="duotone" />}
                name={s.name}
                progress={progress}
                label={progress ? `${s.name}. ${progress.done} of ${progress.total} lectures watched` : `${s.name}. Open lectures`}
                onPress={() => router.push({ pathname: ROUTES.student.videoSubject, params: { subjectId: s.id, name: s.name } })}
              />
            );
          })
        )}

        <ShortcutCard icon={<DownloadSimple size={26} color={color('accent/default')} weight="duotone" />} title="Downloaded videos" caption="Watch without a connection" onPress={() => router.push(ROUTES.student.downloads)} />
        <ShortcutCard icon={<PlayCircle size={26} color={color('accent/default')} weight="duotone" />} title="Free videos" caption="Open to everyone, no plan needed" onPress={() => router.push(ROUTES.student.freeVideos)} />
      </Animated.ScrollView>
      <RefreshPill visible={pull.refreshing} top={header.maxHeight} />
    </View>
  );
}

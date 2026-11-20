import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MonitorPlay } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, FilterPills, ProgressStrip, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listSubjectVideos } from '@/src/api/content';
import { MediaImage } from '@/src/rich';
import { LectureRow } from '@/src/video/LectureRow';
import { groupByChapter, LECTURE_FILTERS, lectureLength, lectureState, matchesFilter, type LectureFilter } from '@/src/video/lectureState';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';

/** One subject's lectures as a vertical list, grouped by chapter, with the five-state filter (All is selected first). */
export default function VideoSubjectRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  const [filter, setFilter] = useState<LectureFilter>('all');
  const q = useQuery({ queryKey: ['subject-videos', subjectId], queryFn: () => listSubjectVideos(String(subjectId)), enabled: !!subjectId });
  useRefetchOnFocus(() => void q.refetch());
  const all = q.data?.videos ?? [];
  const done = all.filter((v) => lectureState(v) === 'completed').length;
  const groups = groupByChapter((q.data?.videos ?? []).filter((v) => matchesFilter(v, filter)));

  return (
    <Screen>
      <ScreenHeader title={name ?? 'Video'} />
      {q.data ? <ProgressStrip line={`${done} / ${all.length} lectures completed`} fraction={all.length ? done / all.length : 0} /> : null}
      <FilterPills options={LECTURE_FILTERS} value={filter} onChange={setFilter} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.lg} />)
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<MonitorPlay size={32} color={color('text/tertiary')} />} title={filter === 'all' ? 'No lectures yet' : 'Nothing here'} description={filter === 'all' ? 'Lectures appear as they are published.' : 'No lectures match this filter.'} action={filter !== 'all' ? <TextButton label="Show all" onPress={() => setFilter('all')} /> : undefined} />
        ) : (
          groups.map((g) => (
            <View key={g.chapterId} style={{ gap: space.xs }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.xs }]}>{g.name.toUpperCase()}</Text>
              {g.videos.map((v) => {
                const st = lectureState(v);
                const len = lectureLength(v.duration_seconds);
                const pct = v.duration_seconds > 0 ? Math.min(100, Math.round((v.progress_seconds / v.duration_seconds) * 100)) : 0;
                const cover = q.data?.covers[v.chapter_id] && q.data.media[q.data.covers[v.chapter_id]] ? <MediaImage media={q.data.media[q.data.covers[v.chapter_id]]} variant="thumb" maxHeight={56} /> : undefined;
                return (
                  <LectureRow
                    key={v.id}
                    title={v.title}
                    detail={[len, v.requires_subscription ? 'Plan' : 'Free'].filter(Boolean).join(' · ')}
                    cover={cover}
                    state={st}
                    locked={v.locked}
                    progressPct={pct}
                    label={`${v.title}. ${len}. ${v.locked ? 'Needs a plan' : st === 'completed' ? 'Completed' : st === 'paused' ? 'Paused' : 'Not started'}`}
                    onPress={() => (v.locked ? router.push(ROUTES.student.subscriptionPlans) : router.push({ pathname: ROUTES.student.videoPlayer, params: { id: v.id } }))}
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

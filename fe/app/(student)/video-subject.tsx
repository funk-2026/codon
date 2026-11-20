import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Lock, MonitorPlay, PauseCircle } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listSubjectVideos } from '@/src/api/content';
import { MediaImage } from '@/src/rich';
import { groupByChapter, LECTURE_FILTERS, lectureLength, lectureState, matchesFilter, type LectureFilter } from '@/src/video/lectureState';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** One subject's lectures as a vertical list, grouped by chapter, with the five-state filter (All is selected first). */
export default function VideoSubjectRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  const [filter, setFilter] = useState<LectureFilter>('all');
  const q = useQuery({ queryKey: ['subject-videos', subjectId], queryFn: () => listSubjectVideos(String(subjectId)), enabled: !!subjectId });
  useRefetchOnFocus(() => void q.refetch());
  const groups = groupByChapter((q.data?.videos ?? []).filter((v) => matchesFilter(v, filter)));

  return (
    <Screen>
      <ScreenHeader title={name ?? 'Video'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        {LECTURE_FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}>
              <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => (v.locked ? router.push(ROUTES.student.subscriptionPlans) : router.push({ pathname: ROUTES.student.videoPlayer, params: { id: v.id } }))}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.title}. ${len}. ${v.locked ? 'Needs a plan' : st === 'completed' ? 'Completed' : st === 'paused' ? 'Paused' : 'Not started'}`}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
                  >
                    <View style={{ width: 88, height: 56, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {q.data?.covers[v.chapter_id] && q.data.media[q.data.covers[v.chapter_id]] ? (
                        <MediaImage media={q.data.media[q.data.covers[v.chapter_id]]} variant="thumb" maxHeight={56} />
                      ) : (
                        <MonitorPlay size={26} color={color('accent/default')} weight="duotone" />
                      )}
                      {st === 'paused' && pct > 0 ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: color('bg/sunken') }}><View style={{ width: `${pct}%`, height: 3, backgroundColor: color('accent/default') }} /></View> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{v.title}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{[len, v.requires_subscription ? 'Plan' : 'Free'].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {v.locked ? <Lock size={20} color={color('text/tertiary')} weight="fill" /> : st === 'completed' ? <CheckCircle size={22} color={color('semantic/success')} weight="fill" /> : st === 'paused' ? <PauseCircle size={22} color={color('semantic/warning')} weight="fill" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

import { LectureRow } from '@/src/video/LectureRow';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MonitorPlay } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listFreeVideos } from '@/src/api/content';
import { lectureLength } from '@/src/video/lectureState';
import { ROUTES } from '@/src/navigation/routes';

/** Every lecture that is free to watch, Biology first, chapter by chapter. */
export default function FreeVideosRoute() {
  const { color, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['free-videos', user?.selected_course_id], queryFn: () => listFreeVideos(user?.selected_course_id ?? undefined) });
  return (
    <Screen>
      <ScreenHeader title="Free videos" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.lg} />) : q.isError ? <ErrorBanner onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon={<MonitorPlay size={32} color={color('text/tertiary')} />} title="No free videos yet" description="Free lectures appear here when they are published." />
        ) : (
          (q.data ?? []).map((v) => (
            <LectureRow
              key={v.id}
              title={v.title}
              detail={[v.subject_name, v.chapter_name, lectureLength(v.duration_seconds)].filter(Boolean).join(' · ')}
              state={v.is_completed ? 'completed' : undefined}
              label={`${v.title}. Free`}
              onPress={() => router.push({ pathname: ROUTES.student.videoPlayer, params: { id: v.id } })}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

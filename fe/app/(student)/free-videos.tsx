import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, MonitorPlay } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listFreeVideos } from '@/src/api/content';
import { lectureLength } from '@/src/video/lectureState';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** Every lecture that is free to watch, Biology first, chapter by chapter. */
export default function FreeVideosRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['free-videos', user?.selected_course_id], queryFn: () => listFreeVideos(user?.selected_course_id ?? undefined) });
  return (
    <Screen>
      <ScreenHeader title="Free videos" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? <SkeletonBlock height={72} radius={radius.lg} /> : q.isError ? <ErrorBanner onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon={<MonitorPlay size={32} color={color('text/tertiary')} />} title="No free videos yet" description="Free lectures appear here when they are published." />
        ) : (
          (q.data ?? []).map((v) => (
            <Pressable key={v.id} onPress={() => router.push({ pathname: ROUTES.student.videoPlayer, params: { id: v.id } })} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, minHeight: 64, opacity: pressed ? 0.94 : 1 }, shadow()]}>
              <MonitorPlay size={28} color={color('accent/default')} weight="duotone" />
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{v.title}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{[v.subject_name, v.chapter_name, lectureLength(v.duration_seconds)].filter(Boolean).join(' · ')}</Text>
              </View>
              {v.is_completed ? <CheckCircle size={22} color={color('semantic/success')} weight="fill" /> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

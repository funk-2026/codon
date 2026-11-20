import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { CaretRight, ChartLineUp, MagnifyingGlass, MonitorPlay } from 'phosphor-react-native';
import { CollapsingHeader, EmptyState, ErrorBanner, SkeletonBlock, TextButton, useCollapsingHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getCurriculum } from '@/src/api/courses';
import { subjectOrder } from '@/src/bookmarks/logic';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** Video: the analytics entry, then exactly Biology, Chemistry and Physics. A subject opens its own page of lectures. */
export default function VideoTabRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const header = useCollapsingHeader(64);
  const cur = useQuery({ queryKey: ['curriculum', user?.selected_course_id], queryFn: () => getCurriculum(String(user?.selected_course_id)), enabled: !!user?.selected_course_id, staleTime: 10 * 60_000 });
  const subjects = subjectOrder(cur.data?.course.subjects ?? []);

  const search = (
    <Pressable onPress={() => router.push(ROUTES.student.search)} accessibilityRole="button" accessibilityLabel="Search" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <MagnifyingGlass size={24} color={color('header/text')} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>Video</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Video classes, chapter by chapter</Text>
            </View>
            {search}
          </View>
        }
        compact={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>Video</Text>{search}</View>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: 'video' } })}
          accessibilityRole="button"
          style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }]}
        >
          <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>Check detailed analysis</Text>
          <CaretRight size={18} color={color('accent/default')} />
        </Pressable>

        {cur.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.lg} />)
        ) : cur.isError ? (
          <ErrorBanner onRetry={() => void cur.refetch()} />
        ) : subjects.length === 0 ? (
          <EmptyState icon={<MonitorPlay size={32} color={color('text/tertiary')} />} title="No subjects yet" description="Video classes will appear here as they are published." action={<TextButton label="Refresh" onPress={() => void cur.refetch()} />} />
        ) : (
          subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: ROUTES.student.videoSubject, params: { subjectId: s.id, name: s.name } })}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}. Open lectures`}
              style={({ pressed }) => [{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
            >
              <MonitorPlay size={28} color={color('accent/default')} weight="duotone" />
              <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

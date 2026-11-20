import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BookmarkSimple, CaretRight, ChartLineUp, Folder } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getQBankOverview } from '@/src/api/qbank';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { progressFraction } from './logic';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** The QBank tab body: Bookmarks, the analysis entry, then Biology, Chemistry and Physics with their progress. */
export function QBankPanel() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['qbank-overview', user?.selected_course_id], queryFn: () => getQBankOverview(user?.selected_course_id ?? undefined) });
  useRefetchOnFocus(() => void q.refetch());

  return (
    <View style={{ gap: space.sm }}>
      <Pressable onPress={() => router.push(ROUTES.student.bookmarks)} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}>
        <BookmarkSimple size={26} color={color('accent/default')} weight="duotone" />
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>Bookmarks</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Saved questions</Text>
        </View>
        <CaretRight size={18} color={color('text/tertiary')} />
      </Pressable>

      <Pressable onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: 'qbank' } })} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }]}>
        <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
        <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>Check detailed analysis</Text>
        <CaretRight size={18} color={color('accent/default')} />
      </Pressable>

      {q.isPending ? (
        [0, 1, 2].map((i) => <SkeletonBlock key={i} height={80} radius={radius.lg} />)
      ) : q.isError ? (
        <ErrorBanner onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Folder size={32} color={color('text/tertiary')} />} title="No QBank yet" description="Chapters appear here as they are published." action={<TextButton label="Refresh" onPress={() => void q.refetch()} />} />
      ) : (
        q.data.map((s) => (
          <Pressable
            key={s.subject_id}
            onPress={() => router.push({ pathname: ROUTES.student.qbankSubject, params: { subjectId: s.subject_id } })}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}. ${s.completed} of ${s.total} modules`}
            style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs, opacity: pressed ? 0.94 : 1 }, shadow()]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Folder size={28} color={color('accent/default')} weight="duotone" />
              <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
              <CaretRight size={18} color={color('text/tertiary')} />
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
              <View style={{ width: `${Math.round(progressFraction(s) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: color('semantic/success') }} />
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{s.completed} / {s.total} modules</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

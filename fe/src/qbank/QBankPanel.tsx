import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BookmarkSimple, Folder } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, ProgressLink, ShortcutCard, SkeletonBlock, SubjectCard, SUBJECT_SKELETON_HEIGHT, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getQBankOverview } from '@/src/api/qbank';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';

/** The QBank tab body: Bookmarks, the analysis entry, then Biology, Chemistry and Physics with their progress. */
export function QBankPanel() {
  const { color, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['qbank-overview', user?.selected_course_id], queryFn: () => getQBankOverview(user?.selected_course_id ?? undefined) });
  useRefetchOnFocus(() => void q.refetch());

  return (
    <View style={{ gap: space.sm }}>
      <ShortcutCard icon={<BookmarkSimple size={26} color={color('accent/default')} weight="duotone" />} title="Bookmarks" caption="Saved questions" onPress={() => router.push(ROUTES.student.bookmarks)} />
      <ProgressLink title="My QBank progress" onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: 'qbank' } })} />

      {q.isPending ? (
        [0, 1, 2].map((i) => <SkeletonBlock key={i} height={SUBJECT_SKELETON_HEIGHT} radius={radius.lg} />)
      ) : q.isError ? (
        <ErrorBanner onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Folder size={32} color={color('text/tertiary')} />} title="No QBank yet" description="Chapters appear here as they are published." action={<TextButton label="Refresh" onPress={() => void q.refetch()} />} />
      ) : (
        q.data.map((s) => (
          <SubjectCard
            key={s.subject_id}
            icon={<Folder size={28} color={color('accent/default')} weight="duotone" />}
            name={s.name}
            progress={{ done: s.completed, total: s.total, unit: 'modules' }}
            label={`${s.name}. ${s.completed} of ${s.total} modules`}
            onPress={() => router.push({ pathname: ROUTES.student.qbankSubject, params: { subjectId: s.subject_id } })}
          />
        ))
      )}
    </View>
  );
}

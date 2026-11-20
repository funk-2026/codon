import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Lock, PauseCircle } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, FilterPills, ProgressStrip, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getQBankOverview } from '@/src/api/qbank';
import { moduleMatches, moduleTitle, progressFraction, progressLine, QBANK_FILTERS, solvedLine, type QBankFilter } from '@/src/qbank/logic';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** One subject: how many modules are done, the five-state filter, then the chapters as numbered cards. */
export default function QBankSubjectRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const q = useQuery({ queryKey: ['qbank-overview', user?.selected_course_id], queryFn: () => getQBankOverview(user?.selected_course_id ?? undefined) });
  const [filter, setFilter] = useState<QBankFilter>('all');
  const subject = q.data?.find((s) => s.subject_id === subjectId);
  const mods = (subject?.modules ?? []).map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => moduleMatches(m, filter));

  return (
    <Screen>
      <ScreenHeader title={subject?.name ?? 'QBank'} />
      {subject ? <ProgressStrip line={progressLine(subject)} fraction={progressFraction(subject)} /> : null}
      <FilterPills options={QBANK_FILTERS} value={filter} onChange={setFilter} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.lg} />)
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : mods.length === 0 ? (
          <EmptyState icon={<CheckCircle size={32} color={color('text/tertiary')} />} title={filter === 'all' ? 'No chapters yet' : 'Nothing here'} description={filter === 'all' ? 'Chapters appear as they are published.' : 'No chapters match this filter.'} action={filter !== 'all' ? <TextButton label="Show all" onPress={() => setFilter('all')} /> : undefined} />
        ) : (
          mods.map(({ m, n }) => (
            <Pressable
              key={m.test_id}
              onPress={() => router.push({ pathname: ROUTES.student.qbankChapter, params: { testId: m.test_id } })}
              accessibilityRole="button"
              accessibilityLabel={`${n}. ${moduleTitle(m)}. ${m.mcq_count} MCQs. ${solvedLine(m)}`}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, borderWidth: m.state === 'completed' ? 1.5 : 0, borderColor: color('semantic/success'), opacity: pressed ? 0.94 : 1 }, shadow()]}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: color('border/strong'), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h3'], { color: m.state === 'completed' ? color('semantic/success') : color('text/primary') }]}>{moduleTitle(m)}</Text>
                {solvedLine(m) ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{solvedLine(m)}</Text> : null}
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{m.mcq_count} MCQs</Text>
              </View>
              {m.locked ? <Lock size={20} color={color('text/tertiary')} weight="fill" /> : m.state === 'completed' ? <CheckCircle size={24} color={color('semantic/success')} weight="fill" /> : m.state === 'paused' ? <PauseCircle size={24} color={color('semantic/warning')} weight="fill" /> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

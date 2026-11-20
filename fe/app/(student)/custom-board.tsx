import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorBanner, PrimaryButton, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { rememberCustomCode } from '@/src/api/attempts';
import { getModuleBoard } from '@/src/api/customTests';
import { CodeCard } from '@/src/custom/CodeCard';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** One module in Challenges: my rank and percentage, my previous score, the top five, and its code. Answers can't be reviewed from here. */
export default function CustomBoardRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['custom-board', id], queryFn: () => getModuleBoard(String(id)), enabled: !!id });
  const b = q.data;
  return (
    <Screen>
      <ScreenHeader title={b?.title ?? 'Module'} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }}>
        {q.isPending ? <SkeletonBlock height={200} radius={radius.lg} /> : q.isError || !b ? <ErrorBanner onRetry={() => void q.refetch()} /> : (
          <>
            {b.mine.rank != null ? (
              <View>
                <Text style={[type['type/h2'], { color: color('accent/default') }]}>Your rank: {b.mine.rank}   Percentage: {b.mine.pct}%</Text>
                {b.mine.previous_pct != null ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Previous score: {b.mine.previous_pct}%</Text> : null}
              </View>
            ) : <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>You have not solved this module yet.</Text>}
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>TOP 5 LEADERBOARD</Text>
            {b.top.length === 0 ? <EmptyState title="No leaderboard yet" description="Nobody has attempted this module." /> : b.top.map((t) => (
              <View key={t.rank} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: t.me ? color('accent/tint') : color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}>
                <Text style={[type['type/body-m-medium'], { color: color('text/tertiary'), width: 24 }]}>{t.rank}</Text>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{t.me ? 'You' : t.name}</Text>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{t.pct}%</Text>
              </View>
            ))}
            <CodeCard code={b.code} />
            <PrimaryButton label="Solve again with the code" onPress={() => { rememberCustomCode(String(id), b.code); router.push({ pathname: ROUTES.student.testPreStart, params: { id: String(id) } }); }} />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>To review the answers, solve the module again by entering its code. A second attempt never changes the leaderboard.</Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

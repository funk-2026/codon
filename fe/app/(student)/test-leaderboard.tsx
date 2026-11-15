import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Lock, Trophy, WarningCircle } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { getLeaderboard } from '@/src/api/exams';
import { shadow } from '@/src/theme/elevation';

const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** The top ten with your own position. School tests show only your position. Hide your name in Edit profile. */
export default function TestLeaderboardRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['leaderboard', id], queryFn: () => getLeaderboard(id as string), enabled: !!id, retry: false });
  const pending = q.error instanceof ApiError && q.error.code === 'results_pending';
  const d = q.data;

  return (
    <Screen>
      <ScreenHeader title="Leaderboard" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {q.isPending ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={56} radius={radius.md} />)
        ) : pending ? (
          <EmptyState icon={<Lock size={32} color={color('text/tertiary')} />} title="Not out yet" description="The leaderboard opens when results are released." />
        ) : q.isError || !d ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load the leaderboard" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => void q.refetch()} />} />
        ) : d.locked ? (
          <EmptyState icon={<Lock size={32} color={color('text/tertiary')} />} title="Ranks are for subscribers" description="Subscribe to see where you stand among everyone who took this test." />
        ) : (
          <>
            {d.me ? (
              <View style={[{ backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md }]}>
                <Text style={[type['type/overline'], { color: color('accent/default') }]}>YOU</Text>
                <Text style={[type['type/h2'], { color: color('text/primary') }]}>{d.me.estimated ? 'Estimated rank' : 'Rank'} {d.me.rank} of {d.me.total}</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Score {n(d.me.score)}</Text>
              </View>
            ) : null}
            {!d.public ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>This test has no public leaderboard. Only you can see your position.</Text>
            ) : d.entries.length === 0 ? (
              <EmptyState icon={<Trophy size={32} color={color('text/tertiary')} />} title="No one on the board yet" description="Scores appear here once students finish." />
            ) : (
              d.entries.map((e, i) => (
                <View key={`${e.rank}-${i}`} style={[{ backgroundColor: e.is_me ? color('accent/tint') : color('bg/surface'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }, shadow()]}>
                  <Text style={[type['type/h3'], { color: color('text/primary'), width: 36 }]}>{e.rank}</Text>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{e.name}{e.is_me ? ' (you)' : ''}</Text>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{n(e.score)}</Text>
                </View>
              ))
            )}
            {d.public ? <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center', marginTop: space.sm }]}>You can hide your name from boards in Edit profile.</Text> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

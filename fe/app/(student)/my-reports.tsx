import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlagBanner, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useReportReasons } from '@/src/config/AppConfigContext';
import { useMyReports } from '@/src/queries/discover';

const STATUS: Record<string, { label: string; tone: 'semantic/warning' | 'semantic/success' | 'text/tertiary' }> = {
  open: { label: 'Under review', tone: 'semantic/warning' },
  fixed: { label: 'Fixed — thank you!', tone: 'semantic/success' },
  no_change: { label: 'Reviewed — no change needed', tone: 'text/tertiary' },
  dismissed: { label: 'Closed', tone: 'text/tertiary' },
};

export default function MyReportsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reasons = useReportReasons();
  const list = useMyReports();
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const loading = list.isPending;
  const error = list.isError;
  const load = () => void list.refetch();
  const more = list.isFetchingNextPage;
  const loadMore = () => void list.fetchNextPage();

  const label = (k: string) => reasons.find((r) => r.key === k)?.label ?? k.replace(/_/g, ' ');

  return (
    <Screen>
      <ScreenHeader title="My reports" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={80} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load your reports" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<FlagBanner size={32} color={color('text/tertiary')} />} title="No reports yet" description="If you spot a wrong answer or a typo in a question, use the flag icon to tell us. You’ll see what happened here." />
        ) : (
          <>
            {rows.map((r) => {
              const s = STATUS[r.status] ?? STATUS.open;
              return (
                <View key={r.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{label(String(r.reason))}</Text>
                    <Text style={[type['type/caption'], { color: color(s.tone) }]}>{s.label}</Text>
                  </View>
                  {r.note ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]} numberOfLines={3}>“{r.note}”</Text> : null}
                  {r.resolution_note ? <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Reply: {r.resolution_note}</Text> : null}
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{new Date(r.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
              );
            })}
            {list.hasNextPage ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

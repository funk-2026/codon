import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PencilSimpleLine, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listTeacherCorrections, type CorrectionQueueRow } from '@/src/api/moderation';
import { plainText } from '@/src/rich';
import { useCursorList } from '@/src/queries/useCursorList';

const TONE = { pending: { label: 'Waiting for review', tone: 'semantic/warning' }, approved: { label: 'Approved', tone: 'semantic/success' }, rejected: { label: 'Rejected', tone: 'semantic/danger' } } as const;

export default function TeacherCorrectionsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useCursorList<CorrectionQueueRow, Awaited<ReturnType<typeof listTeacherCorrections>>>(
    ['teacher', 'corrections'],
    (cursor) => listTeacherCorrections({ limit: 20, cursor }),
    (r) => r.items,
  );
  const { rows, loading, error, load } = list;
  const cursor = list.hasMore ? 'more' : null;


  return (
    <Screen>
      <ScreenHeader title="My corrections" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={90} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load your corrections" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<PencilSimpleLine size={32} color={color('text/tertiary')} />} title="No corrections yet" description="When you fix a live question, the change is reviewed first. You can follow it here." />
        ) : (
          <>
            {rows.map((r) => {
              const t = TONE[r.status] ?? TONE.pending;
              return (
                <View key={r.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 4 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={[type['type/body-m-medium'], { color: color(t.tone), flex: 1 }]}>{t.label}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{new Date(r.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  {r.question ? <Text style={[type['type/body-m'], { color: color('text/primary') }]} numberOfLines={2}>{plainText((r.question as any).question_text, (r.question as any).content_format)}</Text> : null}
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Your reason: {r.reason}</Text>
                  {r.review_note ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Reviewer: {r.review_note}</Text> : null}
                </View>
              );
            })}
            {cursor ? <SecondaryButton label="Load more" onPress={() => void list.loadMore()} loading={list.more} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

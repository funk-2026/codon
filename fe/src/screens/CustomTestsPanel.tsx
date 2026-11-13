import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, Sliders, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { listCustomTests, type CustomTestRow, type CustomTestState } from '@/src/api/customTests';
import { getModule } from '@/src/modules/registry';
import { ROUTES } from '@/src/navigation/routes';
import { useCursorList } from '@/src/queries/useCursorList';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

export type CustomStateFilter = CustomTestState | 'all';
export const CUSTOM_STATE_CHIPS: { key: CustomStateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'not_started', label: 'Not started' },
  { key: 'completed', label: 'Completed' },
];

const badgeFor = (r: CustomTestRow) => {
  const la = r.last_attempt;
  return r.state === 'in_progress' ? 'In progress' : r.state === 'completed' && la?.total_marks ? `${la.score ?? 0}/${la.total_marks}` : r.state === 'completed' ? 'Done' : 'New';
};

/**
 * The Custom segment of Practice: build a test, then your saved tests in the same list layout
 * as Q Bank. Renaming, deleting and templates stay on the full "My custom tests" screen.
 */
export function CustomTestsPanel({ query, state }: { query: string; state: CustomStateFilter }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const list = useCursorList<CustomTestRow, Awaited<ReturnType<typeof listCustomTests>>>(
    ['custom-tests', state],
    (cursor) => listCustomTests({ state: state === 'all' ? undefined : state, limit: 20, cursor }),
    (r) => r.items,
  );
  // Coming back from a test changes its state (New → In progress → score).
  useRefetchOnFocus(list.load);

  const q = query.trim().toLowerCase();
  const rows = q ? list.rows.filter((r) => r.test.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)) : list.rows;

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        onPress={() => router.push(ROUTES.student.customBuilder)}
        accessibilityRole="button"
        style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
      >
        <View style={{ width: 40, height: 40, backgroundColor: color('accent/tint'), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }}>
          <Sliders size={22} color={color('accent/default')} weight="duotone" />
        </View>
        <View style={{ flex: 1, marginLeft: space.sm }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>Build a custom test</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>{getModule('custom').descriptor}</Text>
        </View>
        <CaretRight size={20} color={color('text/tertiary')} />
      </Pressable>

      {list.loading ? (
        <>
          <SkeletonBlock height={64} radius={radius.md} />
          <SkeletonBlock height={64} radius={radius.md} />
        </>
      ) : list.error ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load your custom tests"
          description="Check your connection and try again."
          action={<TextButton label="Retry" onPress={list.load} />}
        />
      ) : rows.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: space['2xl'], gap: space.xs }}>
          <Sliders size={28} color={color('text/tertiary')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>
            {q ? `No matches for ‘${query}’` : state === 'all' ? 'No custom tests yet' : 'Nothing here'}
          </Text>
          {!q && state === 'all' ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
              Build one from exactly the topics and difficulty you want.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          {rows.map((r) => {
            const badge = badgeFor(r);
            return (
              <Pressable
                key={r.test.id}
                onPress={() => router.push({ pathname: ROUTES.student.testPreStart, params: { id: r.test.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${r.test.title}. ${r.summary}. ${badge}`}
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{r.test.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>{r.summary}</Text>
                </View>
                <View style={{ backgroundColor: r.state === 'in_progress' ? color('semantic/warning-tint') : color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 }}>
                  <Text style={[type['type/caption'], { color: r.state === 'in_progress' ? color('semantic/warning') : color('accent/default') }]}>{badge}</Text>
                </View>
              </Pressable>
            );
          })}
          {list.hasMore ? <SecondaryButton label={list.more ? 'Loading…' : 'Load more'} onPress={() => void list.loadMore()} loading={list.more} /> : null}
        </>
      )}

      <TextButton label="Manage tests and templates" onPress={() => router.push(ROUTES.student.customTests)} />
    </View>
  );
}

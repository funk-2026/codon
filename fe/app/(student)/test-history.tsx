import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClockCounterClockwise, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAttemptHistory, type Attempt } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { visibleModules } from '@/src/modules/registry';
import { useFlag } from '@/src/config/AppConfigContext';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';




const GROUPS: Attempt['group'][] = ['Today', 'This Week', 'Earlier'];

function scoreTone(pct: number): 'semantic/success' | 'semantic/warning' | 'semantic/danger' {
  if (pct >= 60) return 'semantic/success';
  if (pct >= 35) return 'semantic/warning';
  return 'semantic/danger';
}

export default function TestHistoryRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customOn = useFlag('custom_test.enabled');
  const FILTERS = ['All', ...visibleModules((f) => (f === 'custom_test.enabled' ? customOn : false)).map((m) => m.label)];
  const [filter, setFilter] = useState<string>('All');
  
  const history = useAttemptHistory();
  const attempts = history.data ?? [];
  const loading = history.isPending;
  const loadError = history.isError;
  const load = () => void history.refetch();
  useRefetchOnFocus(history.refetch);

  const filtered = attempts.filter((a) => filter === 'All' || a.module === filter);
  const isEmptyOverall = attempts.length === 0;

  return (
    <Screen>
      <ScreenHeader title="Test History" />

      {!isEmptyOverall ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, marginTop: space.md }}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  {
                    borderRadius: radius.pill,
                    paddingHorizontal: space.md,
                    backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                    borderWidth: 1,
                    borderColor: active ? color('accent/default') : color('border/subtle'),
                  },
                ]}
              >
                <Text
                  style={[
                    type['type/body-m-medium'],
                    { color: active ? color('accent/default') : color('text/primary') },
                  ]}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: space.sm }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} height={72} radius={radius.md} />
            ))}
          </View>
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load your test history"
            description="Something went wrong fetching your attempts."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : isEmptyOverall ? (
          <EmptyState
            icon={<ClockCounterClockwise size={32} color={color('text/tertiary')} />}
            title="No attempts yet"
            description="Head to Practice to get started."
            action={<TextButton label="Go to Practice" onPress={() => router.push(ROUTES.student.practice)} />}
          />
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            {filter === 'All' ? 'No attempts yet.' : `No ${filter} attempts yet.`}
          </Text>
        ) : (
          GROUPS.map((group) => {
            const rows = filtered.filter((a) => a.group === group);
            if (rows.length === 0) return null;
            return (
              <View key={group} style={{ marginBottom: space.lg }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
                  {group.toUpperCase()}
                </Text>
                <View style={{ gap: space.sm }}>
                  {rows.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() =>
                        a.status === 'submitted'
                          ? router.push({ pathname: ROUTES.student.testResult, params: { id: a.id, fromHistory: '1' } })
                          : router.push({ pathname: ROUTES.student.testQuestion, params: { id: a.testId } })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                        shadow(),
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                          {a.breadcrumb}
                        </Text>
                      </View>
                      {a.status === 'submitted' ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: a.scorePct == null ? color('semantic/warning') : color(scoreTone(a.scorePct)), borderRadius: radius.pill },
                          ]}
                        >
                          <Text style={[type['type/caption'], { color: color('text/inverse') }]}>{a.score}</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: color('semantic/warning'), borderRadius: radius.pill },
                          ]}
                        >
                          <Text style={[type['type/caption'], { color: color('text/primary') }]}>In Progress</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
});

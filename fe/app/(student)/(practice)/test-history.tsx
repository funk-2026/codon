import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, ClockCounterClockwise } from 'phosphor-react-native';
import { EmptyState, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type ModuleType = 'All' | 'Q Bank' | 'Test Series' | 'Practice';
type Attempt = {
  id: string;
  title: string;
  breadcrumb: string;
  module: Exclude<ModuleType, 'All'>;
  group: 'Today' | 'This Week' | 'Earlier';
  status: 'completed' | 'in_progress';
  score?: string;
  scorePct?: number;
};

const ATTEMPTS: Attempt[] = [
  { id: '1', title: 'Thermodynamics — Practice Set 3', breadcrumb: 'Physics › Thermodynamics', module: 'Practice', group: 'Today', status: 'in_progress' },
  { id: '2', title: 'Mechanics Full Chapter Test', breadcrumb: 'Physics › Mechanics', module: 'Test Series', group: 'Today', status: 'completed', score: '18/20', scorePct: 90 },
  { id: '3', title: 'Optics Concept Check', breadcrumb: 'Physics › Optics', module: 'Q Bank', group: 'This Week', status: 'completed', score: '14/20', scorePct: 70 },
  { id: '4', title: 'Modern Physics Quick Set', breadcrumb: 'Physics › Modern Physics', module: 'Practice', group: 'This Week', status: 'completed', score: '9/10', scorePct: 90 },
  { id: '5', title: 'Organic Chemistry Basics', breadcrumb: 'Chemistry › Organic', module: 'Q Bank', group: 'Earlier', status: 'completed', score: '6/20', scorePct: 30 },
  { id: '6', title: 'Full Mock Test 3', breadcrumb: 'NEET UG › Test Series', module: 'Test Series', group: 'Earlier', status: 'completed', score: '11/20', scorePct: 55 },
];

const FILTERS: ModuleType[] = ['All', 'Q Bank', 'Test Series', 'Practice'];
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
  const [filter, setFilter] = useState<ModuleType>('All');

  const filtered = ATTEMPTS.filter((a) => filter === 'All' || a.module === filter);
  const isEmptyOverall = ATTEMPTS.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Test History
        </Text>
      </View>

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
        {isEmptyOverall ? (
          <EmptyState
            icon={<ClockCounterClockwise size={32} color={color('text/tertiary')} />}
            title="No attempts yet"
            description="Head to Practice to get started."
            action={<TextButton label="Go to Practice" onPress={() => router.push('/(student)/(practice)')} />}
          />
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            No {filter} attempts yet.
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
                        a.status === 'completed'
                          ? router.push({ pathname: '/(student)/(practice)/test-review', params: { id: a.id } })
                          : router.push({ pathname: '/(student)/(practice)/test-question', params: { id: a.id } })
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
                      {a.status === 'completed' ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: color(scoreTone(a.scorePct ?? 0)), borderRadius: radius.pill },
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
    </SafeAreaView>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
});

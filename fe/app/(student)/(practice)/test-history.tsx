import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, ClockCounterClockwise } from 'phosphor-react-native';
import { EmptyState, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttempts } from '@/src/api/profile';
import type { StudentAttempt } from '@/src/api/attempts';

type ModuleType = 'All' | 'Q Bank' | 'Test Series' | 'Practice';
type Attempt = {
  id: string;
  title: string;
  breadcrumb: string;
  module: Exclude<ModuleType, 'All'>;
  group: 'Today' | 'This Week' | 'Earlier';
  status: 'submitted' | 'in_progress';
  score?: string;
  scorePct?: number;
};



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
  
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAttempts();
        const now = new Date();
        const mapped = res.attempts.map((a: StudentAttempt): Attempt => {
          const startedAt = new Date(a.started_at);
          const diffMs = now.getTime() - startedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          let group: Attempt['group'] = 'Earlier';
          if (diffDays < 1) group = 'Today';
          else if (diffDays < 7) group = 'This Week';
          
          let module: Exclude<ModuleType, 'All'> = 'Practice';
          if (a.test?.module_type === 'test_series') module = 'Test Series';
          if (a.test?.module_type === 'qbank') module = 'Q Bank';

          return {
            id: a.id,
            title: a.test?.title || 'Unknown Test',
            breadcrumb: a.test?.subject?.name ? `${a.test.subject.name} › ${a.test.chapter?.name || 'General'}` : (a.test?.course?.name || 'General'),
            module,
            group,
            status: a.status,
            score: a.status === 'submitted' ? `${a.score || 0}/${a.total_marks || 0}` : undefined,
            scorePct: a.status === 'submitted' && (a.total_marks || 0) > 0 ? ((a.score || 0) / (a.total_marks || 1)) * 100 : undefined,
          };
        });
        setAttempts(mapped);
      } catch (err) {
        console.error('Failed to load history', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = attempts.filter((a) => filter === 'All' || a.module === filter);
  const isEmptyOverall = attempts.length === 0;

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
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Loading history...</Text>
          </View>
        ) : isEmptyOverall ? (
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
                        a.status === 'submitted'
                          ? router.push({ pathname: '/(student)/(practice)/test-result', params: { id: a.id, fromHistory: '1' } })
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
                      {a.status === 'submitted' ? (
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

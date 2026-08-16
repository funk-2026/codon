import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListTests } from '@/src/api/admin';

type ModuleType = 'All' | 'Q Bank' | 'Test Series' | 'Practice';
type TestItem = {
  id: string;
  title: string;
  breadcrumb: string;
  questionCount: number;
  module: Exclude<ModuleType, 'All'>;
  teacher: string;
  submitted: string;
};


const FILTERS: ModuleType[] = ['All', 'Q Bank', 'Test Series', 'Practice'];

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function ModerationTestsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ModuleType>('All');
  const [items, setItems] = useState<TestItem[]>([]);

  useEffect(() => {
    adminListTests('pending_review').then(res => {
       const mapped: TestItem[] = res.tests.map(t => {
          const moduleMap: Record<string, Exclude<ModuleType, 'All'>> = {
            'qbank': 'Q Bank',
            'test_series': 'Test Series',
            'practice': 'Practice'
          };
          const b = [t.course?.title, t.subject?.title].filter(Boolean).join(' · ');
          
          return {
            id: t.id,
            title: t.title,
            breadcrumb: b || 'Unknown', 
            questionCount: t.total_questions || 0, 
            module: moduleMap[t.module_type] || 'Practice', 
            teacher: t.creator?.name || t.creator?.phone_number || 'Unknown Teacher', 
            submitted: new Date(t.created_at || Date.now()).toLocaleDateString(),
          };
       });
       setItems(mapped);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => filter === 'All' || i.module === filter);

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
          Test Approvals
        </Text>
      </View>
      <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingHorizontal: space.md, marginTop: space['2xs'] }]}>
        {filtered.length} pending.
      </Text>

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
              <Text style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom, gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height={92} radius={radius.md} />)
        ) : filtered.length === 0 ? (
          <EmptyState title="All clear" description="No tests waiting on review." />
        ) : (
          filtered.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({ pathname: '/(admin)/(review)/content-preview-detail', params: { id: item.id, type: 'test' } })
              }
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                shadow(),
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{item.title}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {item.breadcrumb} · {item.questionCount} questions
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.moduleBadge, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.xs }]}>
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{item.module}</Text>
                  </View>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
                    {item.teacher} · {item.submitted}
                  </Text>
                </View>
              </View>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  moduleBadge: { paddingVertical: 2 },
});

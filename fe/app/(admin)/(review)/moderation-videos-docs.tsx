import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight, PlayCircle, FileText, Lightbulb } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type ContentType = 'All' | 'Videos' | 'Documents' | 'Brain Hacks';
type ContentItem = {
  id: string;
  title: string;
  breadcrumb: string | null;
  type: Exclude<ContentType, 'All'>;
  teacher: string;
  submitted: string;
};

const ITEMS: ContentItem[] = [
  { id: 'c1', title: 'Laws of Thermodynamics — Explained', breadcrumb: 'NEET UG · Physics · Thermodynamics', type: 'Videos', teacher: 'Kavya Iyer', submitted: '1 day ago' },
  { id: 'c2', title: 'Entropy — Chapter Notes', breadcrumb: 'NEET UG · Physics · Thermodynamics', type: 'Documents', teacher: 'Devika Rao', submitted: '4 hours ago' },
  { id: 'c3', title: "The 2-minute recall trick", breadcrumb: null, type: 'Brain Hacks', teacher: 'Kavya Iyer', submitted: '2 hours ago' },
];

const FILTERS: ContentType[] = ['All', 'Videos', 'Documents', 'Brain Hacks'];

const TYPE_ICON: Record<Exclude<ContentType, 'All'>, React.ComponentType<{ size: number; color: string }>> = {
  Videos: PlayCircle,
  Documents: FileText,
  'Brain Hacks': Lightbulb,
};

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function ModerationVideosDocsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentType>('All');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const filtered = ITEMS.filter((i) => filter === 'All' || i.type === filter);

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
          Content Approvals
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
          <EmptyState title="All clear" description="No content waiting on review." />
        ) : (
          filtered.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({ pathname: '/(admin)/(review)/content-preview-detail', params: { id: item.id, type: item.type } })
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
                    {item.breadcrumb ?? 'Brain Hack'}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.typeBadge, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.xs }]}>
                      <Icon size={12} color={color('text/secondary')} />
                      <Text style={[type['type/caption'], { color: color('text/secondary'), marginLeft: 4 }]}>
                        {item.type}
                      </Text>
                    </View>
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
                      {item.teacher} · {item.submitted}
                    </Text>
                  </View>
                </View>
                <CaretRight size={18} color={color('text/tertiary')} />
              </Pressable>
            );
          })
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
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
});

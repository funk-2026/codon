import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight, PlayCircle, FileText, Lightbulb, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListContent } from '@/src/api/admin';

type ContentType = 'All' | 'Videos' | 'Documents' | 'Brain Hacks';
type ContentItem = {
  id: string;
  title: string;
  breadcrumb: string | null;
  type: Exclude<ContentType, 'All'>;
  teacher: string;
  submitted: string;
};



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
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<ContentType>('All');

  const [items, setItems] = useState<ContentItem[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    adminListContent('pending_review').then(res => {
       const mapped: ContentItem[] = res.content.map(c => {
          const typeMap: Record<string, Exclude<ContentType, 'All'>> = {
            'video': 'Videos',
            'document': 'Documents',
            'brain_hack': 'Brain Hacks'
          };
          const b = [c.course?.name, c.chapter?.name].filter(Boolean).join(' · ');

          return {
            id: c.id,
            title: c.title,
            breadcrumb: b || null,
            type: typeMap[c.content_type] || 'Documents',
            teacher: c.uploader?.name || c.uploader?.phone_number || 'Unknown Teacher',
            submitted: new Date(c.created_at || Date.now()).toLocaleDateString(),
          };
       });
       setItems(mapped);
       setLoadError(false);
    }).catch(() => setLoadError(true))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => filter === 'All' || i.type === filter);

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
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load content"
            description="Something went wrong fetching content pending review."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="All clear" description="No content waiting on review." />
        ) : (
          filtered.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/(review)/content-preview-detail',
                    params: {
                      id: item.id,
                      type: item.type,
                      title: item.title,
                      breadcrumb: item.breadcrumb ?? '',
                      teacher: item.teacher,
                      submitted: item.submitted,
                    },
                  })
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

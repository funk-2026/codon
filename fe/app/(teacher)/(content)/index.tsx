import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  MagnifyingGlass,
  Plus,
  ClipboardText,
  PlayCircle,
  FileText,
  Lightbulb,
  X,
} from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, StatusBadge, type BadgeStatus } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listTeacherContent, listTeacherTests } from '@/src/api/teacher';

type ContentType = 'Test' | 'Video' | 'Document' | 'Brain Hack';
type TypeFilter = 'All' | 'Tests' | 'Videos & Docs' | 'Brain Hacks';
type Status = 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
type StatusFilter = 'All Statuses' | 'Draft' | 'In Review' | 'Approved' | 'Live' | 'Changes Needed';

type ContentItem = {
  id: string;
  title: string;
  breadcrumb: string | null;
  type: ContentType;
  status: Status;
};



const TYPE_FILTERS: TypeFilter[] = ['All', 'Tests', 'Videos & Docs', 'Brain Hacks'];
const STATUS_FILTERS: StatusFilter[] = ['All Statuses', 'Draft', 'In Review', 'Approved', 'Live', 'Changes Needed'];

const STATUS_FILTER_TO_STATUS: Record<StatusFilter, Status | null> = {
  'All Statuses': null,
  Draft: 'draft',
  'In Review': 'pending',
  Approved: 'approved',
  Live: 'published',
  'Changes Needed': 'rejected',
};

const TYPE_FILTER_TO_TYPES: Record<TypeFilter, ContentType[] | null> = {
  All: null,
  Tests: ['Test'],
  'Videos & Docs': ['Video', 'Document'],
  'Brain Hacks': ['Brain Hack'],
};

const TYPE_ICON: Record<ContentType, React.ComponentType<{ size: number; color: string }>> = {
  Test: ClipboardText,
  Video: PlayCircle,
  Document: FileText,
  'Brain Hack': Lightbulb,
};

function taxonomyBadge(status: Status): { badgeStatus: BadgeStatus; label: string } {
  const map: Record<Status, { badgeStatus: BadgeStatus; label: string }> = {
    draft: { badgeStatus: 'draft', label: 'Draft' },
    pending: { badgeStatus: 'pending', label: 'In Review' },
    approved: { badgeStatus: 'approved', label: 'Approved' },
    rejected: { badgeStatus: 'rejected', label: 'Changes Needed' },
    published: { badgeStatus: 'published', label: 'Live' },
  };
  return map[status];
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

export default function MyContentListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All Statuses');
  const [fabOpen, setFabOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    Promise.all([listTeacherContent(), listTeacherTests()])
      .then(([cRes, tRes]) => {
        const out: ContentItem[] = [];
        (tRes.tests || []).forEach(t => {
          out.push({
            id: t.id,
            title: t.title,
            breadcrumb: 'Test',
            type: 'Test',
            status: t.status as Status,
          });
        });
        (cRes.content || []).forEach(c => {
          out.push({
            id: c.id,
            title: c.title,
            breadcrumb: 'Content',
            type: c.content_type === 'video' ? 'Video' : 'Document',
            status: c.status as Status,
          });
        });
        setItems(out);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const fabProgress = useSharedValue(0);
  useEffect(() => {
    fabProgress.value = withTiming(fabOpen ? 1 : 0, { duration: 220 });
  }, [fabOpen, fabProgress]);

  const filtered = items.filter((item) => {
    const types = TYPE_FILTER_TO_TYPES[typeFilter];
    if (types && !types.includes(item.type)) return false;
    const status = STATUS_FILTER_TO_STATUS[statusFilter];
    if (status && item.status !== status) return false;
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const isEmptyOverall = items.length === 0;

  const openItem = (item: ContentItem) => {
    if (item.status === 'rejected') {
      router.push({ pathname: '/(teacher)/(content)/rejected-content-detail', params: { id: item.id } });
    } else {
      router.push({ pathname: '/(teacher)/(content)/content-preview', params: { id: item.id, type: item.type } });
    }
  };

  const useMenuStyle = (index: number) =>
    useAnimatedStyle(() => ({
      opacity: fabProgress.value,
      transform: [
        { translateY: -((index + 1) * 60) * fabProgress.value },
        { scale: 0.6 + 0.4 * fabProgress.value },
      ],
    }));
  const menuStyle0 = useMenuStyle(0);
  const menuStyle1 = useMenuStyle(1);
  const menuStyle2 = useMenuStyle(2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>My Content</Text>
        <Pressable
          onPress={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery('');
          }}
          hitSlop={space.xs}
        >
          <MagnifyingGlass size={22} color={color('text/primary')} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
          <View
            style={[
              styles.searchRow,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm },
            ]}
          >
            <MagnifyingGlass size={18} color={color('text/tertiary')} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by title"
              placeholderTextColor={color('text/tertiary')}
              autoFocus
              style={[type['type/body-m'], { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm }]}
            />
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, marginTop: space.md }}
      >
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setTypeFilter(f)}
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
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, marginTop: space.xs }}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setStatusFilter(f)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  paddingHorizontal: space.sm,
                  backgroundColor: active ? color('bg/sunken') : color('bg/surface'),
                  borderWidth: 1,
                  borderColor: active ? color('border/strong') : color('border/subtle'),
                },
              ]}
            >
              <Text style={[type['type/caption'], { color: active ? color('text/primary') : color('text/secondary') }]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + 72, gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : isEmptyOverall ? (
          <EmptyState title="Nothing here yet" description="You haven't created anything yet — tap + to start." />
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            Nothing matches these filters.
          </Text>
        ) : (
          filtered.map((item) => {
            const Icon = TYPE_ICON[item.type];
            const badge = taxonomyBadge(item.status);
            return (
              <Pressable
                key={item.id}
                onPress={() => openItem(item)}
                style={({ pressed }) => [
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={styles.row}>
                  <Icon size={22} color={color('text/secondary')} />
                  <Text
                    style={[type['type/h3'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
                <View style={[styles.metaRow, { marginTop: space.xs }]}>
                  <Text
                    style={[type['type/caption'], { color: color('text/tertiary'), flex: 1, marginRight: space.sm }]}
                    numberOfLines={1}
                  >
                    {item.breadcrumb ?? 'Brain Hack'}
                  </Text>
                  <StatusBadge status={badge.badgeStatus} label={badge.label} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {fabOpen ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setFabOpen(false)} />
      ) : null}

      <View style={[styles.fabWrap, { right: space.lg, bottom: space.lg }]} pointerEvents="box-none">
        <Animated.View style={[styles.fabMenuItem, menuStyle2]} pointerEvents={fabOpen ? 'auto' : 'none'}>
          <FabMenuItem
            label="New Brain Hack"
            onPress={() => {
              setFabOpen(false);
              router.push('/(teacher)/(upload)/create-brain-hack');
            }}
          />
        </Animated.View>
        <Animated.View style={[styles.fabMenuItem, menuStyle1]} pointerEvents={fabOpen ? 'auto' : 'none'}>
          <FabMenuItem
            label="New Video/Document"
            onPress={() => {
              setFabOpen(false);
              router.push('/(teacher)/(upload)/create-content');
            }}
          />
        </Animated.View>
        <Animated.View style={[styles.fabMenuItem, menuStyle0]} pointerEvents={fabOpen ? 'auto' : 'none'}>
          <FabMenuItem
            label="New Test"
            onPress={() => {
              setFabOpen(false);
              router.push('/(teacher)/(upload)/create-test');
            }}
          />
        </Animated.View>

        <Pressable
          onPress={() => setFabOpen((v) => !v)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: pressed ? color('accent/pressed') : color('accent/default'), borderRadius: 28 },
            shadow(),
          ]}
        >
          {fabOpen ? (
            <X size={24} color={color('accent/on-accent')} weight="bold" />
          ) : (
            <Plus size={24} color={color('accent/on-accent')} weight="bold" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FabMenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fabMenuButton,
        { backgroundColor: color('bg/surface'), borderRadius: radius.pill, paddingHorizontal: space.md, opacity: pressed ? 0.92 : 1 },
        shadow(),
      ]}
    >
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fabWrap: { position: 'absolute', alignItems: 'flex-end' },
  fab: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  fabMenuItem: { position: 'absolute', right: 0, bottom: 0 },
  fabMenuButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
});

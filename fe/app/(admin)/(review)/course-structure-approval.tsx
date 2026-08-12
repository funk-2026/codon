import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CaretLeft, Check, X, CheckCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Level = 'Subject' | 'Chapter' | 'Sub-chapter';
type LevelFilter = 'All' | 'Subjects' | 'Chapters' | 'Sub-chapters';
type StructureNode = {
  id: string;
  name: string;
  path: string;
  level: Level;
  teacher: string;
};

const LEVEL_TO_FILTER: Record<Level, LevelFilter> = {
  Subject: 'Subjects',
  Chapter: 'Chapters',
  'Sub-chapter': 'Sub-chapters',
};

const INITIAL: StructureNode[] = [
  { id: 's1', name: '[new] Thermodynamics', path: 'NEET UG · Physics', level: 'Chapter', teacher: 'Kavya Iyer' },
  { id: 's2', name: '[new] First Law of Thermodynamics', path: 'NEET UG · Physics · Thermodynamics', level: 'Sub-chapter', teacher: 'Kavya Iyer' },
  { id: 's3', name: '[new] Zoology', path: 'NEET UG', level: 'Subject', teacher: 'Devika Rao' },
];

const FILTERS: LevelFilter[] = ['All', 'Subjects', 'Chapters', 'Sub-chapters'];

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function NodeRow({
  node,
  onOpen,
  onApprove,
  onReject,
}: {
  node: StructureNode;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  const opacity = useSharedValue(1);
  const flashStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={flashStyle}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.96 : 1 },
          shadow(),
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>{node.name}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {node.path}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.levelBadge, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.xs }]}>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{node.level}</Text>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
              {node.teacher}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              opacity.value = withTiming(0, { duration: 200 });
              setTimeout(onApprove, 200);
            }}
            hitSlop={space.xs}
            style={[styles.iconBtn, { backgroundColor: color('semantic/success'), borderRadius: 22 }]}
          >
            <Check size={20} color={color('text/inverse')} weight="bold" />
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onReject();
            }}
            hitSlop={space.xs}
            style={[styles.iconBtn, { backgroundColor: color('semantic/danger'), borderRadius: 22 }]}
          >
            <X size={20} color={color('text/inverse')} weight="bold" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function CourseStructureApprovalRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<StructureNode[]>(INITIAL);
  const [filter, setFilter] = useState<LevelFilter>('All');
  const [rejectTarget, setRejectTarget] = useState<StructureNode | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const filtered = nodes.filter((n) => filter === 'All' || LEVEL_TO_FILTER[n.level] === filter);

  const approve = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    show('Approved', 'success');
  };

  const confirmReject = () => {
    if (!rejectTarget || reason.trim().length === 0) return;
    setNodes((prev) => prev.filter((n) => n.id !== rejectTarget.id));
    setRejectTarget(null);
    setReason('');
    show('Rejected', 'success');
  };

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
          Course Structure
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
          Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} height={92} radius={radius.md} />)
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />}
            title="All clear"
            description="No structure changes waiting on review."
          />
        ) : (
          filtered.map((n) => (
            <NodeRow
              key={n.id}
              node={n}
              onOpen={() =>
                router.push({ pathname: '/(admin)/(review)/content-preview-detail', params: { id: n.id, type: n.level } })
              }
              onApprove={() => approve(n.id)}
              onReject={() => setRejectTarget(n)}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={!!rejectTarget} transparent animationType="slide" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.sheetScrim}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: color('bg/surface'), borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.lg + insets.bottom },
            ]}
          >
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Why is this being rejected?</Text>
            <InputField
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Duplicate chapter, or doesn't fit the course structure."
              containerStyle={{ marginTop: space.md }}
            />
            <PrimaryButton
              label="Confirm Rejection"
              onPress={confirmReject}
              disabled={reason.trim().length === 0}
              style={{ marginTop: space.lg }}
            />
          </View>
        </View>
      </Modal>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  levelBadge: { paddingVertical: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

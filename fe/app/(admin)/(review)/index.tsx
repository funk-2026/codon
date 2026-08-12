import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check, X, CheckCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type KycEntry = {
  id: string;
  name: string;
  phone: string;
  idType: 'Aadhaar' | 'PAN';
  submitted: string;
};

const INITIAL: KycEntry[] = [
  { id: 'k1', name: 'Meera Pillai', phone: '+91 90XXXXXX15', idType: 'Aadhaar', submitted: '2 days ago' },
  { id: 'k2', name: 'Arjun Das', phone: '+91 91XXXXXX32', idType: 'PAN', submitted: '1 day ago' },
  { id: 'k3', name: 'Nisha Kumar', phone: '+91 92XXXXXX54', idType: 'Aadhaar', submitted: '6 hours ago' },
  { id: 'k4', name: 'Vikram Singh', phone: '+91 93XXXXXX67', idType: 'Aadhaar', submitted: '2 hours ago' },
];

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function QueueRow({
  entry,
  onOpen,
  onApprove,
  onReject,
}: {
  entry: KycEntry;
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
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>{entry.name}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {entry.phone}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[styles.idBadge, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.xs }]}
            >
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{entry.idType}</Text>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
              {entry.submitted}
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

export default function KycReviewQueueRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<KycEntry[]>(INITIAL);
  const [rejectTarget, setRejectTarget] = useState<KycEntry | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const approve = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    show('Approved', 'success');
  };

  const confirmReject = () => {
    if (!rejectTarget || reason.trim().length === 0) return;
    setEntries((prev) => prev.filter((e) => e.id !== rejectTarget.id));
    setRejectTarget(null);
    setReason('');
    show('Rejected', 'success');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>KYC Review</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
          {entries.length} pending.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom, gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height={92} radius={radius.md} />)
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />}
            title="All caught up"
            description="No pending KYC reviews."
          />
        ) : (
          entries.map((e) => (
            <QueueRow
              key={e.id}
              entry={e}
              onOpen={() => router.push({ pathname: '/(admin)/(review)/kyc-review-detail', params: { id: e.id, from: 'queue' } })}
              onApprove={() => approve(e.id)}
              onReject={() => setRejectTarget(e)}
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
              placeholder="e.g. Document photo is blurry, or ID number doesn't match."
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
  row: { flexDirection: 'row', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  idBadge: { paddingVertical: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

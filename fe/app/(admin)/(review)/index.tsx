import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check, X, CheckCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListKYC, adminApproveKYC, adminRejectKYC } from '@/src/api/admin';
import type { KYCRecord } from '@/src/api/kyc';

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
  entry: KYCRecord;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  const opacity = useSharedValue(1);
  const flashStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const displayName = entry.user?.name || 'Unknown User';
  const displayPhone = entry.user?.phone_number || 'No Phone';
  const displayDate = new Date(entry.submitted_at).toLocaleDateString();

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
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>{displayName}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {displayPhone}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[styles.idBadge, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.xs }]}
            >
              <Text style={[type['type/caption'], { color: color('text/secondary'), textTransform: 'capitalize' }]}>{entry.id_type}</Text>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
              {displayDate}
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
  const [entries, setEntries] = useState<KYCRecord[]>([]);
  const [rejectTarget, setRejectTarget] = useState<KYCRecord | null>(null);
  const [reason, setReason] = useState('');

  const fetchRecords = () => {
    adminListKYC('pending')
      .then(res => setEntries(res.records || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const approve = async (id: string) => {
    try {
      await adminApproveKYC(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      show('Approved', 'success');
    } catch (e) {
      show('Failed to approve', 'error');
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget || reason.trim().length === 0) return;
    try {
      await adminRejectKYC(rejectTarget.id, reason.trim());
      setEntries((prev) => prev.filter((e) => e.id !== rejectTarget.id));
      show('Rejected', 'success');
    } catch (e) {
      show('Failed to reject', 'error');
    } finally {
      setRejectTarget(null);
      setReason('');
    }
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

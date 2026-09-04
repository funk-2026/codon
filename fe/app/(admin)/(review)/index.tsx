import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check, X, CheckCircle, WarningCircle, Shield, ClipboardText, PlayCircle, CaretRight } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListKYC, adminApproveKYC, adminRejectKYC, getAdminDashboardSummary } from '@/src/api/admin';
import type { KYCRecord } from '@/src/api/kyc';

function shadowCard(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function ApprovalNavCard({
  icon,
  label,
  count,
  current,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  current?: boolean;
  onPress?: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.navCard,
        {
          backgroundColor: color('bg/surface'),
          borderRadius: radius.md,
          padding: space.sm,
          opacity: pressed ? 0.94 : 1,
          borderWidth: current ? 1 : 0,
          borderColor: color('accent/default'),
        },
        shadowCard(),
      ]}
    >
      {icon}
      <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginTop: space.xs }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.navCardFooter, { marginTop: 2 }]}>
        <Text style={[type['type/caption'], { color: count ? color('semantic/warning') : color('text/tertiary') }]}>
          {count != null ? `${count} pending` : current ? 'Viewing' : ''}
        </Text>
        {onPress ? <CaretRight size={14} color={color('text/tertiary')} /> : null}
      </View>
    </Pressable>
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
  const [loadError, setLoadError] = useState(false);
  const [entries, setEntries] = useState<KYCRecord[]>([]);
  const [rejectTarget, setRejectTarget] = useState<KYCRecord | null>(null);
  const [reason, setReason] = useState('');
  const [otherCounts, setOtherCounts] = useState<{ tests?: number; content?: number }>({});

  useEffect(() => {
    getAdminDashboardSummary()
      .then(res => setOtherCounts({ tests: res.pending_test_reviews, content: res.pending_content_reviews }))
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    adminListKYC('pending')
      .then(res => {
        setEntries(res.records || []);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Approvals</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
          Everything waiting on your review, in one place.
        </Text>
      </View>

      <View style={[styles.navCardRow, { paddingHorizontal: space.md, marginTop: space.md, gap: space.sm }]}>
        <ApprovalNavCard
          icon={<Shield size={22} color={color('accent/default')} weight="duotone" />}
          label="KYC Review"
          count={entries.length > 0 ? entries.length : undefined}
          current
        />
        <ApprovalNavCard
          icon={<ClipboardText size={22} color={color('accent/default')} weight="duotone" />}
          label="Test Approvals"
          count={otherCounts.tests}
          onPress={() => router.push('/(admin)/(review)/moderation-tests')}
        />
        <ApprovalNavCard
          icon={<PlayCircle size={22} color={color('accent/default')} weight="duotone" />}
          label="Content Approvals"
          count={otherCounts.content}
          onPress={() => router.push('/(admin)/(review)/moderation-videos-docs')}
        />
      </View>

      <Text
        style={[
          type['type/overline'],
          { color: color('text/tertiary'), paddingHorizontal: space.md, marginTop: space.xl },
        ]}
      >
        KYC REVIEW — {entries.length} PENDING
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space['3xl'] + insets.bottom, gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height={92} radius={radius.md} />)
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load KYC queue"
            description="Something went wrong fetching pending reviews."
            action={<TextButton label="Retry" onPress={fetchRecords} />}
          />
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
  navCardRow: { flexDirection: 'row' },
  navCard: { flex: 1 },
  navCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  idBadge: { paddingVertical: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

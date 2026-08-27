import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, IdentificationCard } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListKYC, adminApproveKYC, adminRejectKYC } from '@/src/api/admin';
import type { KYCRecord } from '@/src/api/kyc';

const ID_TYPE_LABEL: Record<KYCRecord['id_type'], string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
};

export default function KycReviewDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const fromQueue = from === 'queue' || from === 'user-detail';

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<KYCRecord | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // There's no "get KYC record by id" endpoint — the list is filtered by
    // status, so look across all three to find the record we were sent here for.
    Promise.all([adminListKYC('pending'), adminListKYC('approved'), adminListKYC('rejected')])
      .then(([pending, approved, rejected]) => {
        if (cancelled) return;
        setPendingCount(pending.records.length);
        const found = [...pending.records, ...approved.records, ...rejected.records].find((r) => r.id === id);
        setRecord(found ?? null);
      })
      .catch(() => {
        if (!cancelled) show('Failed to load KYC record', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const advance = async () => {
    if (from !== 'queue') {
      router.back();
      return;
    }
    try {
      const res = await adminListKYC('pending');
      const next = res.records[0];
      if (next) {
        router.replace({ pathname: '/(admin)/(review)/kyc-review-detail', params: { id: next.id, from: 'queue' } });
      } else {
        router.replace('/(admin)/(review)/kyc-queue');
      }
    } catch {
      router.replace('/(admin)/(review)/kyc-queue');
    }
  };

  const displayName = record?.user?.name || 'Unknown User';

  const handleApprove = async () => {
    if (!record) return;
    setSubmitting(true);
    try {
      await adminApproveKYC(record.id);
      show(`Approved — ${displayName} now has verified access.`, 'success');
      await advance();
    } catch (e) {
      show('Failed to approve', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!record || reason.trim().length === 0) return;
    setSubmitting(true);
    try {
      await adminRejectKYC(record.id, reason.trim());
      setRejectOpen(false);
      setReason('');
      show(`Rejected — ${displayName} has been notified.`, 'success');
      await advance();
    } catch (e) {
      show('Failed to reject', 'error');
    } finally {
      setSubmitting(false);
    }
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
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          Review KYC
        </Text>
        {fromQueue && pendingCount > 0 ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
            {pendingCount} pending
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: space.md, paddingTop: space.lg, gap: space.sm }}>
          <SkeletonBlock height={72} radius={radius.md} />
          <SkeletonBlock height={220} radius={radius.lg} />
          <SkeletonBlock height={120} radius={radius.md} />
        </View>
      ) : !record ? (
        <EmptyState
          title="Record not found"
          description="This KYC record may have already been reviewed."
          style={{ marginTop: space.xl }}
        />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.userRow,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: color('accent/tint') }]}>
                <Text style={[type['type/h3'], { color: color('accent/default') }]}>
                  {displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ marginLeft: space.sm }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{displayName}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {record.user?.phone_number}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setZoomOpen(true)}
              style={[
                styles.docViewer,
                { backgroundColor: color('bg/sunken'), borderRadius: radius.lg, marginTop: space.lg },
              ]}
            >
              <IdentificationCard size={48} color={color('text/tertiary')} />
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                Tap to view full document
              </Text>
            </Pressable>

            <View
              style={[
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
              ]}
            >
              <DetailRow label="ID Type" value={ID_TYPE_LABEL[record.id_type]} />
              <Divider />
              <DetailRow label="ID Number" value={record.id_number} />
              <Divider />
              <DetailRow label="Submitted" value={new Date(record.submitted_at).toLocaleDateString()} />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: space.md, marginBottom: space.lg, gap: space.sm }}>
            <PrimaryButton label="Approve" onPress={handleApprove} loading={submitting} disabled={record.status !== 'pending'} />
            <SecondaryButton
              label="Reject"
              variant="danger"
              onPress={() => setRejectOpen(true)}
              disabled={submitting || record.status !== 'pending'}
            />
          </View>
        </>
      )}

      <Modal visible={zoomOpen} transparent animationType="fade" onRequestClose={() => setZoomOpen(false)}>
        <Pressable style={styles.zoomScrim} onPress={() => setZoomOpen(false)}>
          <View style={[styles.zoomDoc, { backgroundColor: color('bg/sunken'), borderRadius: radius.md }]}>
            <IdentificationCard size={96} color={color('text/tertiary')} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
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
              loading={submitting}
              style={{ marginTop: space.lg }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{label}</Text>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { color, space } = useTheme();
  return <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.xs }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  docViewer: { height: 220, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zoomScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  zoomDoc: { width: '85%', aspectRatio: 0.7, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {},
});

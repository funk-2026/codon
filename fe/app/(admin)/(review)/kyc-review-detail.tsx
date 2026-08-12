import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, IdentificationCard } from 'phosphor-react-native';
import { InputField, PrimaryButton, SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type KycEntry = {
  id: string;
  name: string;
  phone: string;
  course: string;
  idType: 'Aadhaar' | 'PAN';
  idNumber: string;
  submitted: string;
};

const QUEUE: KycEntry[] = [
  { id: 'k1', name: 'Meera Pillai', phone: '+91 90XXXXXX15', course: 'NEET UG', idType: 'Aadhaar', idNumber: 'XXXX XXXX 4821', submitted: '16 Jul 2026' },
  { id: 'k2', name: 'Arjun Das', phone: '+91 91XXXXXX32', course: '10th Standard', idType: 'PAN', idNumber: 'ABCDE1234F', submitted: '17 Jul 2026' },
  { id: 'k3', name: 'Nisha Kumar', phone: '+91 92XXXXXX54', course: 'NEET UG', idType: 'Aadhaar', idNumber: 'XXXX XXXX 7710', submitted: '18 Jul 2026' },
  { id: 'k4', name: 'Vikram Singh', phone: '+91 93XXXXXX67', course: 'NEET UG', idType: 'Aadhaar', idNumber: 'XXXX XXXX 3392', submitted: '18 Jul 2026' },
];

export default function KycReviewDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const fromQueue = from === 'queue';

  const index = Math.max(0, QUEUE.findIndex((e) => e.id === id));
  const entry = QUEUE[index] ?? QUEUE[0];

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const advance = () => {
    const next = QUEUE[index + 1];
    if (fromQueue && next) {
      router.replace({ pathname: '/(admin)/(review)/kyc-review-detail', params: { id: next.id, from: 'queue' } });
    } else if (fromQueue) {
      router.replace('/(admin)/(review)');
    } else {
      router.back();
    }
  };

  const handleApprove = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      show(`Approved — ${entry.name} now has verified access.`, 'success');
      advance();
    }, 500);
  };

  const confirmReject = () => {
    if (reason.trim().length === 0) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setRejectOpen(false);
      setReason('');
      show(`Rejected — ${entry.name} has been notified.`, 'success');
      advance();
    }, 500);
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
        {fromQueue ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
            {index + 1} of {QUEUE.length} pending
          </Text>
        ) : null}
      </View>

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
              {entry.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
            </Text>
          </View>
          <View style={{ marginLeft: space.sm }}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{entry.name}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
              {entry.phone} · {entry.course}
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
          <DetailRow label="ID Type" value={entry.idType} />
          <Divider />
          <DetailRow label="ID Number" value={entry.idNumber} />
          <Divider />
          <DetailRow label="Submitted" value={entry.submitted} />
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg, gap: space.sm }}>
        <PrimaryButton label="Approve" onPress={handleApprove} loading={submitting} />
        <SecondaryButton label="Reject" variant="danger" onPress={() => setRejectOpen(true)} disabled={submitting} />
      </View>

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

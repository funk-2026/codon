import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getPayment } from '@/src/api/admin';
import type { UserProfile } from '@/src/api/profile';

type Status = 'created' | 'captured' | 'failed' | 'refunded';

type PaymentRecord = {
  id: string;
  user_id: string;
  user?: UserProfile;
  subscription?: { plan?: { name: string } };
  amount_paise: number;
  status: Status;
  created_at: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  failure_reason?: string;
  refund_reason?: string;
  refunded_at?: string;
};

const STATUS_TOKEN: Record<Status, 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning'> = {
  captured: 'semantic/success',
  created: 'text/tertiary',
  failed: 'semantic/danger',
  refunded: 'semantic/warning',
};

export default function PaymentDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [p, setPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!id) return;
    getPayment(id)
      .then(res => setPayment(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !p) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <View style={{ padding: space.md, alignItems: 'center' }}>
          <SkeletonBlock height={72} radius={36} style={{ width: 72 }} />
        </View>
      </SafeAreaView>
    );
  }

  const displayAmount = `₹${(p.amount_paise / 100).toLocaleString('en-IN')}`;
  const userName = p.user?.name || 'Unknown User';
  const userPhone = p.user?.phone_number || 'No Phone';
  const planName = p.subscription?.plan?.name || 'Unknown Plan';
  const displayDate = new Date(p.created_at).toLocaleDateString();

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
          Payment Detail
        </Text>
        <View
          style={[
            styles.statusBadge,
            { borderColor: color(STATUS_TOKEN[p.status] || 'text/tertiary'), borderRadius: radius.pill, paddingHorizontal: space.xs },
          ]}
        >
          <Text style={[type['type/caption'], { color: color(STATUS_TOKEN[p.status] || 'text/tertiary'), textTransform: 'capitalize' }]}>{p.status}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Text style={[type['type/numeral-display'], { color: color('text/primary') }]}>
            {displayAmount}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>INR</Text>
        </View>

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          <Pressable
            onPress={() => router.push({ pathname: '/(admin)/(users)/user-detail', params: { id: p.user_id } })}
            style={styles.userRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>User</Text>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginTop: 2 }]}>
                {userName} · {userPhone}
              </Text>
            </View>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
          <Divider />
          <DetailRow label="Plan" value={planName} />
          <Divider />
          <DetailRow label="Razorpay Order ID" value={p.razorpay_order_id} />
          {p.razorpay_payment_id ? (
            <>
              <Divider />
              <DetailRow label="Razorpay Payment ID" value={p.razorpay_payment_id} />
            </>
          ) : null}
          <Divider />
          <DetailRow label="Status" value={p.status.toUpperCase()} />
          <Divider />
          <DetailRow label="Date & Time" value={displayDate} />
          {p.status === 'refunded' ? (
            <>
              <Divider />
              <DetailRow label="Refund Reason" value={p.refund_reason ?? '—'} />
              <Divider />
              <DetailRow label="Refunded On" value={p.refunded_at ? new Date(p.refunded_at).toLocaleDateString() : '—'} />
            </>
          ) : null}
        </View>

        {p.status === 'failed' ? (
          <View style={[styles.failureCallout, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={{ padding: space.md }}>
              <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>FAILURE REASON</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>
                {p.failure_reason}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{label}</Text>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { color, space } = useTheme();
  return <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.xs }} />;
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderWidth: 1, paddingVertical: 3 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  failureCallout: { overflow: 'hidden' },
});

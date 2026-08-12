import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

type Status = 'Captured' | 'Created' | 'Failed' | 'Refunded';

const PAYMENTS: Record<string, {
  user: string;
  phone: string;
  plan: string;
  amount: number;
  status: Status;
  orderId: string;
  paymentId?: string;
  date: string;
  failureReason?: string;
  refundReason?: string;
  refundedOn?: string;
}> = {
  p1: { user: 'Aarav Sharma', phone: '+91 98XXXXXX10', plan: '3 Months', amount: 2999, status: 'Captured', orderId: 'order_NKj29fPz8x', paymentId: 'pay_NKj2AqR3Lm', date: '18 Jul 2026, 10:24 AM' },
  p3: { user: 'Rohan Mehta', phone: '+91 99XXXXXX41', plan: '3 Months', amount: 2999, status: 'Failed', orderId: 'order_NKh81gQa2w', date: '17 Jul 2026, 8:44 PM', failureReason: 'Your card issuer declined this transaction. Please try another payment method.' },
  p4: { user: 'Meera Pillai', phone: '+91 90XXXXXX15', plan: '3 Months', amount: 2999, status: 'Refunded', orderId: 'order_NKf03bXn7v', paymentId: 'pay_NKf04sTz9q', date: '15 Jul 2026, 2:10 PM', refundReason: 'Failed or duplicate transaction', refundedOn: '16 Jul 2026' },
  p5: { user: 'Arjun Das', phone: '+91 91XXXXXX32', plan: '12 Months', amount: 8999, status: 'Created', orderId: 'order_NKk92mLp4d', date: '18 Jul 2026, 11:01 AM' },
};

const STATUS_TOKEN: Record<Status, 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning'> = {
  Captured: 'semantic/success',
  Created: 'text/tertiary',
  Failed: 'semantic/danger',
  Refunded: 'semantic/warning',
};

export default function PaymentDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const p = (id && PAYMENTS[id]) || PAYMENTS.p1;

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
            { borderColor: color(STATUS_TOKEN[p.status]), borderRadius: radius.pill, paddingHorizontal: space.xs },
          ]}
        >
          <Text style={[type['type/caption'], { color: color(STATUS_TOKEN[p.status]) }]}>{p.status}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Text style={[type['type/numeral-display'], { color: color('text/primary') }]}>
            ₹{p.amount.toLocaleString('en-IN')}
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
            onPress={() => router.push('/(admin)/(users)/user-detail')}
            style={styles.userRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>User</Text>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginTop: 2 }]}>
                {p.user} · {p.phone}
              </Text>
            </View>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
          <Divider />
          <DetailRow label="Plan" value={p.plan} />
          <Divider />
          <DetailRow label="Razorpay Order ID" value={p.orderId} />
          {p.paymentId ? (
            <>
              <Divider />
              <DetailRow label="Razorpay Payment ID" value={p.paymentId} />
            </>
          ) : null}
          <Divider />
          <DetailRow label="Status" value={p.status} />
          <Divider />
          <DetailRow label="Date & Time" value={p.date} />
          {p.status === 'Refunded' ? (
            <>
              <Divider />
              <DetailRow label="Refund Reason" value={p.refundReason ?? '—'} />
              <Divider />
              <DetailRow label="Refunded On" value={p.refundedOn ?? '—'} />
            </>
          ) : null}
        </View>

        {p.status === 'Failed' ? (
          <View style={[styles.failureCallout, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={{ padding: space.md }}>
              <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>FAILURE REASON</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>
                {p.failureReason}
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

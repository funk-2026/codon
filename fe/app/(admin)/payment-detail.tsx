import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretRight, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { UserProfile } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useAdminPayment } from '@/src/queries/admin';

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
  
  const paymentQuery = useAdminPayment(id);
  const loading = paymentQuery.isPending;
  const loadError = paymentQuery.isError;
  const p: PaymentRecord | null = paymentQuery.data ?? null;
  const load = () => void paymentQuery.refetch();


  if (loading || loadError || !p) {
    return (
      <Screen>
        <ScreenHeader title="Payment Detail" />

        {loading ? (
          <View style={{ paddingHorizontal: space.md }}>
            <View style={{ alignItems: 'center', marginTop: space.xl }}>
              <SkeletonBlock height={36} width={140} radius={radius.sm} />
            </View>
            <View
              style={[
                { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl, gap: space.sm },
                shadow(),
              ]}
            >
              <SkeletonBlock height={20} />
              <SkeletonBlock height={20} />
              <SkeletonBlock height={20} />
              <SkeletonBlock height={20} />
              <SkeletonBlock height={20} />
            </View>
          </View>
        ) : (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load this payment"
            description="Something went wrong fetching the payment details."
            action={<TextButton label="Retry" onPress={load} />}
          />
        )}
      </Screen>
    );
  }

  const displayAmount = `₹${(p.amount_paise / 100).toLocaleString('en-IN')}`;
  const userName = p.user?.name || 'Unknown User';
  const userPhone = p.user?.phone_number || 'No Phone';
  const planName = p.subscription?.plan?.name || 'Unknown Plan';
  const displayDate = new Date(p.created_at).toLocaleDateString();

  return (
    <Screen>
      <ScreenHeader title="Payment Detail" right={<>
<View
          style={[
            styles.statusBadge,
            { borderColor: color(STATUS_TOKEN[p.status] || 'text/tertiary'), borderRadius: radius.pill, paddingHorizontal: space.xs },
          ]}
        >
          <Text style={[type['type/caption'], { color: color(STATUS_TOKEN[p.status] || 'text/tertiary'), textTransform: 'capitalize' }]}>{p.status}</Text>
        </View>
</>} />

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
            onPress={() => router.push({ pathname: ROUTES.admin.userDetail, params: { id: p.user_id } })}
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
    </Screen>
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


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderWidth: 1, paddingVertical: 3 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  failureCallout: { overflow: 'hidden' },
});

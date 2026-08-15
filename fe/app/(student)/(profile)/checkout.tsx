import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, DeviceMobile, CreditCard, Wallet, Lock } from 'phosphor-react-native';
import { PrimaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listPlans, checkout, verifyPayment } from '@/src/api/subscriptions';
import { SubscriptionPlan } from '@/src/api/profile';



export default function CheckoutRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'summary' | 'launching' | 'verifying'>('summary');
  const { show } = useToast();

  useEffect(() => {
    listPlans()
      .then((res) => {
        const found = res.plans.find((p) => p.id === planId) || res.plans[0];
        setPlan(found);
      })
      .catch(() => show('Failed to load plan details.', 'error'))
      .finally(() => setLoading(false));
  }, [planId, show]);

  const handlePay = async () => {
    if (!plan) return;
    setStage('launching');
    
    try {
      const order = await checkout({ plan_id: plan.id });
      setStage('verifying');
      
      // Simulate Razorpay SDK UI flow and success callback
      await verifyPayment({
        razorpay_order_id: order.razorpay_order_id,
        razorpay_payment_id: 'mock_pay_' + Math.floor(Math.random() * 100000),
        razorpay_signature: 'mock_signature',
      });
      
      router.replace({
        pathname: '/(student)/(profile)/payment-success',
        params: { planName: plan.name, amount: String(plan.price_paise / 100) },
      });
    } catch (err) {
      setStage('summary');
      show('Payment failed or cancelled', 'error');
    }
  };

  if (stage === 'verifying') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <View style={styles.centered}>
          <OrbitPulse color={color('accent/default')} />
          <Text style={[type['type/body-m-medium'], { color: color('text/secondary'), marginTop: space.lg }]}>
            Confirming your payment…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          Confirm &amp; Pay
        </Text>
      </View>

      <View style={{ paddingHorizontal: space.md, flex: 1 }}>
        {loading || !plan ? (
          <SkeletonBlock height={200} radius={radius.lg} style={{ marginTop: space.xl }} />
        ) : (
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
              shadow(),
            ]}
          >
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{plan.name}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
              {Math.round(plan.duration_days / 30)} months · NEET UG Pro
            </Text>
            <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.md }} />
            <View style={styles.totalRow}>
              <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Total</Text>
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>
                ₹{(plan.price_paise / 100).toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'], textAlign: 'right' }]}>
              Inclusive of all taxes
            </Text>
          </View>
        )}

        <View style={{ marginTop: space.lg }}>
          <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
            Pay securely via Razorpay
          </Text>
          <View style={[styles.methodsRow, { gap: space.md }]}>
            <DeviceMobile size={24} color={color('text/tertiary')} />
            <CreditCard size={24} color={color('text/tertiary')} />
            <Wallet size={24} color={color('text/tertiary')} />
          </View>
        </View>

        <View style={[styles.trustRow, { marginTop: space.md, gap: space.xs }]}>
          <Lock size={14} color={color('text/tertiary')} />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), flex: 1 }]}>
            Your payment details are handled directly by Razorpay. Codon never stores your card or bank information.
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label={`Pay ₹${plan ? (plan.price_paise / 100).toLocaleString('en-IN') : '...'}`}
          onPress={handlePay}
          loading={stage === 'launching' || loading}
        />
      </View>
    </SafeAreaView>
  );
}

function OrbitPulse({ color: ink }: { color: string }) {
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: ink,
        opacity: 0.6,
      }}
    />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodsRow: { flexDirection: 'row', alignItems: 'center' },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, DeviceMobile, CreditCard, Wallet, Lock } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const PLANS: Record<string, { name: string; price: number; durationLabel: string }> = {
  p3: { name: '3 Months', price: 2999, durationLabel: '3 months' },
  p12: { name: '12 Months', price: 8999, durationLabel: '12 months' },
};

export default function CheckoutRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const plan = (planId && PLANS[planId]) || PLANS.p3;

  const [stage, setStage] = useState<'summary' | 'launching' | 'verifying'>('summary');

  const handlePay = () => {
    setStage('launching');
    setTimeout(() => {
      setStage('verifying');
      setTimeout(() => {
        router.replace({
          pathname: '/(student)/(profile)/payment-success',
          params: { planName: plan.name, amount: String(plan.price) },
        });
      }, 1000);
    }, 600);
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
        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>{plan.name}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {plan.durationLabel} · NEET UG Pro
          </Text>
          <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.md }} />
          <View style={styles.totalRow}>
            <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Total</Text>
            <Text style={[type['type/h2'], { color: color('text/primary') }]}>
              ₹{plan.price.toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'], textAlign: 'right' }]}>
            Inclusive of all taxes
          </Text>
        </View>

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
          label={`Pay ₹${plan.price.toLocaleString('en-IN')}`}
          onPress={handlePay}
          loading={stage === 'launching'}
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

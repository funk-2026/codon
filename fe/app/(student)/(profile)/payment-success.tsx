import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CheckCircle } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function PaymentSuccessRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { planName, amount, validUntil } = useLocalSearchParams<{ planName?: string; amount?: string; validUntil?: string }>();

  const resolvedPlan = planName ?? '3 Months';
  const resolvedAmount = amount ? Number(amount) : 2999;
  const resolvedValidUntil = (() => {
    if (!validUntil) return null;
    const d = new Date(validUntil);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  const markScale = useSharedValue(0.6);
  const markOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(12);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 300 });
    markScale.value = withTiming(1, { duration: 400 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    contentY.value = withDelay(300, withTiming(0, { duration: 300 }));
  }, [markOpacity, markScale, contentOpacity, contentY]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.body, { paddingHorizontal: space.md }]}>
        <View style={[styles.markGlow, { backgroundColor: color('semantic/success'), opacity: 0.1 }]}>
          <Animated.View
            style={[
              styles.markCircle,
              { backgroundColor: color('bg/canvas'), borderRadius: 48 },
              markStyle,
            ]}
          >
            <CheckCircle size={64} color={color('semantic/success')} weight="fill" />
          </Animated.View>
        </View>

        <Animated.View style={[{ alignItems: 'center', marginTop: space.lg }, contentStyle]}>
          <Text style={[type['type/display'], { color: color('text/primary'), textAlign: 'center' }]}>
            You&apos;re all set.
          </Text>
          <Text
            style={[type['type/body-l'], { color: color('text/secondary'), marginTop: space.xs, textAlign: 'center' }]}
          >
            Your {resolvedPlan} plan is active.
          </Text>

          <View
            style={[
              styles.receiptCard,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.xl },
            ]}
          >
            <ReceiptRow label="Plan" value={`NEET UG Pro (${resolvedPlan})`} />
            <Divider />
            <ReceiptRow label="Amount Paid" value={`₹${resolvedAmount.toLocaleString('en-IN')}`} />
            {resolvedValidUntil ? (
              <>
                <Divider />
                <ReceiptRow label="Valid Until" value={resolvedValidUntil} />
              </>
            ) : null}
          </View>
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.xl }}>
        <PrimaryButton label="Start Learning" onPress={() => router.replace('/(student)/(home)')} />
      </View>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.receiptRow}>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markGlow: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCircle: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  receiptCard: { width: '100%' },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

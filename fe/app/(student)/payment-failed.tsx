import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WarningCircle } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';

const DEFAULT_REASON = "Your payment didn't complete. This is usually resolved by trying a different payment method.";

export default function PaymentFailedRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [retrying, setRetrying] = useState(false);

  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
  }, [opacity, scale]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      setRetrying(false);
      router.replace(ROUTES.student.checkout);
    }, 600);
  };

  return (
    <Screen>
      <View style={[styles.body, { paddingHorizontal: space.md }]}>
        <Animated.View style={markStyle}>
          <WarningCircle size={80} color={color('semantic/warning')} weight="regular" />
        </Animated.View>

        <Text
          style={[type['type/h1'], { color: color('text/primary'), marginTop: space.lg, textAlign: 'center' }]}
        >
          Payment didn&apos;t go through.
        </Text>
        <Text
          style={[type['type/body-l'], { color: color('text/secondary'), marginTop: space.xs, textAlign: 'center' }]}
        >
          {reason || DEFAULT_REASON}
        </Text>
        <Text
          style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.md, textAlign: 'center' }]}
        >
          You haven&apos;t been charged.
        </Text>
      </View>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.xl, gap: space.sm }}>
        <PrimaryButton label="Try Again" onPress={handleRetry} loading={retrying} />
        <SecondaryButton
          label="Choose a Different Plan"
          onPress={() => router.replace(ROUTES.student.subscriptionPlans)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

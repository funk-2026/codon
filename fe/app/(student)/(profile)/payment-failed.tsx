import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WarningCircle } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const REASON = 'Your bank declined this transaction. This is usually resolved by trying a different payment method.';

export default function PaymentFailedRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
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
      router.replace('/(student)/(profile)/checkout');
    }, 600);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
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
          {REASON}
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
          onPress={() => router.replace('/(student)/(profile)/subscription-plans')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

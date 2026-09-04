import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';
import { Text } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth, type Role } from '@/src/auth/AuthContext';

const ROLE_HOME: Record<Role, Href> = {
  student: '/(student)/(home)',
  teacher: '/(teacher)/(tabs)/(home)',
  admin: '/(admin)/(home)',
};

const ENTER_MS = 900;
const MIN_DISPLAY_MS = 1200;

function OrbitMark({ size, color, opacity = 1 }: { size: number; color: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={opacity}>
      {[0, 60, 120].map((angle) => (
        <G key={angle} transform={`rotate(${angle} 50 50)`}>
          <Ellipse cx={50} cy={50} rx={42} ry={15} stroke={color} strokeWidth={2.5} fill="none" />
          <Circle cx={8} cy={50} r={4} fill={color} />
          <Circle cx={92} cy={50} r={4} fill={color} />
        </G>
      ))}
      <Circle cx={50} cy={50} r={8} fill={color} />
    </Svg>
  );
}

function PulseDot({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 450, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
  }, [delay, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function SplashRoute() {
  const { color, type, space } = useTheme();
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  useEffect(() => {
    if (auth.status === 'loading') return; // still reading keychain
    const timer = setTimeout(() => {
      if (auth.status === 'authenticated') {
        router.replace(ROLE_HOME[auth.user.role]);
      } else {
        router.replace('/onboarding');
      }
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [auth, router]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View pointerEvents="none" style={styles.backdrop}>
        <OrbitMark size={520} color={color('accent/default')} opacity={0.05} />
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.brand, enterStyle]}>
          <OrbitMark size={96} color={color('accent/default')} />
          <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.md }]}>
            Codon
          </Text>
          <Text
            style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.sm }]}
          >
            Study better. Feel stronger.
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.dots, { bottom: insets.bottom + space['2xl'] }]}>
        <PulseDot delay={0} color={color('accent/default')} />
        <PulseDot delay={150} color={color('accent/default')} />
        <PulseDot delay={300} color={color('accent/default')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  backdrop: {
    position: 'absolute',
    top: -160,
    left: -120,
    right: -120,
    alignItems: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center' },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

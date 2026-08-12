import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '').slice(-10);
  if (clean.length < 10) return `+91 ${clean}`;
  return `+91 ${clean.slice(0, 2)}XXXXXX${clean.slice(8)}`;
}

function LogoMark({ color: ink }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={48} fill={ink} opacity={0.08} />
      {Array.from({ length: 3 }).map((_, i) => {
        const angle = i * 60;
        return (
          <G key={angle} transform={`rotate(${angle} 60 60)`}>
            <Circle
              cx={60}
              cy={60}
              r={42}
              stroke={ink}
              strokeWidth={2.5}
              fill="none"
              opacity={0.85}
            />
          </G>
        );
      })}
      <Circle cx={60} cy={60} r={8} fill={ink} />
      <Path
        d="M60 60 L92 60 M60 60 L60 28"
        stroke={ink}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Staggered({
  delayMs,
  children,
}: {
  delayMs: number;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const shownSV = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setShown(true);
      shownSV.value = withTiming(1, { duration: 320 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shownSV]);
  const style = useAnimatedStyle(() => ({
    opacity: shownSV.value,
    transform: [{ translateY: (1 - shownSV.value) * 12 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function PhoneEntryRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const shakeX = useSharedValue(0);
  const buttonOpacity = useSharedValue(0.6);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clean = phone.replace(/\D/g, '');
  const isValid = clean.length === 10;
  const formatError = touched && !isValid && phone.length > 0 && !submitting;
  const rateLimited = cooldown > 0;

  useEffect(() => {
    buttonOpacity.value = withTiming(isValid && !submitting && !rateLimited ? 1 : 0.6, {
      duration: 180,
    });
  }, [isValid, submitting, rateLimited, buttonOpacity]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-3, { duration: 45 }),
      withTiming(3, { duration: 90 }),
      withTiming(0, { duration: 45 }),
    );
  };

  const handleSubmit = () => {
    if (submitting || rateLimited) return;
    setTouched(true);
    if (!isValid) {
      triggerShake();
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      // First request: success -> OTP verify. Repeated requests simulate rate limit.
      // (Mock: flip to rate-limited after the first send to exercise the cooldown UI.)
      setCooldown(5 * 60);
      router.push({ pathname: '/otp-verify', params: { phone: clean } });
    }, 900);
  };

  const handleBlur = () => {
    setTouched(true);
    if (!isValid && phone.length > 0) triggerShake();
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const buttonAnimStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.body, { marginHorizontal: space.md }]}>
        <Staggered delayMs={0}>
          <View style={{ marginTop: space['3xl'], alignItems: 'center' }}>
            <LogoMark color={color('text/primary')} />
          </View>
        </Staggered>

        <Staggered delayMs={80}>
          <Text
            style={[
              type['type/h1'],
              { color: color('text/primary'), marginTop: space.xl },
            ]}
          >
            Let&apos;s get you signed in
          </Text>
        </Staggered>

        <Staggered delayMs={160}>
          <Text
            style={[
              type['type/body-m'],
              { color: color('text/secondary'), marginTop: space['2xs'] },
            ]}
          >
            We&apos;ll text you a one-time code. No passwords to remember.
          </Text>
        </Staggered>

        <Animated.View style={[shakeStyle, { marginTop: space.xl }]}>
          <Staggered delayMs={240}>
            <View style={styles.row}>
              <View
                style={[
                  styles.codeChip,
                  {
                    backgroundColor: color('bg/sunken'),
                    borderRadius: radius.sm,
                    paddingHorizontal: space.sm,
                    marginRight: space.xs,
                  },
                ]}
              >
                <Text style={[type['type/body-l'], { color: color('text/secondary') }]}>
                  IN +91
                </Text>
              </View>
              <TextInput
                ref={inputRef}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                onBlur={handleBlur}
                keyboardType="number-pad"
                placeholder="10-digit mobile number"
                placeholderTextColor={color('text/tertiary')}
                editable={!submitting}
                style={[
                  type['type/body-l'],
                  {
                    flex: 1,
                    color: color('text/primary'),
                    backgroundColor: color('bg/sunken'),
                    borderRadius: radius.sm,
                    borderWidth: formatError ? 2 : 1,
                    borderColor: formatError
                      ? color('semantic/danger')
                      : color('border/subtle'),
                    paddingHorizontal: space.sm,
                    paddingVertical: space.sm,
                    minHeight: 48,
                  },
                ]}
              />
            </View>
            {formatError ? (
              <Text
                style={[
                  type['type/caption'],
                  { color: color('semantic/danger'), marginTop: space['2xs'] },
                ]}
              >
                Enter a valid 10-digit mobile number.
              </Text>
            ) : rateLimited ? (
              <Text
                style={[
                  type['type/caption'],
                  { color: color('semantic/danger'), marginTop: space['2xs'] },
                ]}
              >
                Too many attempts. Try again in a few minutes.
              </Text>
            ) : null}
          </Staggered>
        </Animated.View>

        <Staggered delayMs={320}>
          <Animated.View style={buttonAnimStyle}>
            <PrimaryButton
              label={rateLimited ? `Try again in ${mm(cooldown)}` : 'Send OTP'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={(!isValid && !rateLimited) || rateLimited || submitting}
              style={{ marginTop: space.lg }}
            />
          </Animated.View>
        </Staggered>

        <Staggered delayMs={400}>
          <Text
            style={[
              type['type/caption'],
              {
                color: color('text/tertiary'),
                textAlign: 'center',
                marginTop: space.md,
              },
            ]}
          >
            By continuing, you agree to Codon&apos;s{' '}
            <Text style={{ color: color('accent/default') }}>Terms of Service</Text> and{' '}
            <Text style={{ color: color('accent/default') }}>Privacy Policy</Text>.
          </Text>
        </Staggered>

        <Staggered delayMs={460}>
          <Pressable
            hitSlop={space.xs}
            onPress={() => router.push('/preview-mode')}
            style={({ pressed }) => [
              styles.devLink,
              { marginTop: space.lg, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
              Dev: preview as a role →
            </Text>
          </Pressable>
        </Staggered>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  codeChip: { height: 48, justifyContent: 'center' },
  devLink: { alignSelf: 'center' },
});

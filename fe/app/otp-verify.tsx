import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { maskPhone } from './phone-entry';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components';
import { useAuth } from '@/src/auth/AuthContext';
import { verifyOTP, sendOTP } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function OtpVerifyRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { show } = useToast();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const phoneDisplay = maskPhone(typeof phone === 'string' ? phone : '');

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [expired, setExpired] = useState(false);

  const refs = useRef<(TextInput | null)[]>([]);
  const pulse = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => {
      setResendIn((r) => {
        const next = r - 1;
        if (next <= 0) {
          setExpired(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const submit = async (code: string) => {
    setVerifying(true);
    setError(null);
    pulse.value = withSequence(
      withTiming(1.04, { duration: 120 }),
      withTiming(1, { duration: 160 }),
    );

    const cleanPhone = typeof phone === 'string' ? phone : '';
    const deviceId = `${Platform.OS}-${Date.now()}`;
    const deviceInfo = `${Platform.OS} ${Platform.Version}`;

    try {
      const res = await verifyOTP(cleanPhone, code, deviceId, deviceInfo);
      await signIn(res.access_token, res.user);
      const role = res.user.role;

      const isProfileComplete = res.user.name && res.user.selected_course_id;

      if (!isProfileComplete) {
        router.replace('/profile-setup');
      } else if (role === 'admin') {
        router.replace('/(admin)/(home)');
      } else if (role === 'teacher') {
        router.replace('/(teacher)/(home)');
      } else {
        router.replace('/(student)/(home)');
      }
    } catch (err) {
      setVerifying(false);
      const msg = err instanceof ApiError ? err.message : 'Verification failed';
      setError(msg);
      shakeX.value = withSequence(
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 100 }),
        withTiming(0, { duration: 50 }),
      );
      // Clear digits so user can re-enter
      setDigits(Array(CODE_LENGTH).fill(''));
      setActive(0);
      refs.current[0]?.focus();
    }
  };

  const setDigit = (i: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError(null);
    if (i < CODE_LENGTH - 1) {
      refs.current[i + 1]?.focus();
      setActive(i + 1);
    }
    if (next.every((d) => d !== '')) submit(next.join(''));
  };

  const handleBackspace = (i: number) => {
    if (digits[i] !== '') {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    if (i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
      setActive(i - 1);
    }
  };

  const handleChange = (i: number, val: string) => {
    if (val === '') handleBackspace(i);
    else setDigit(i, val);
  };

  const resend = async () => {
    const cleanPhone = typeof phone === 'string' ? phone : '';
    try {
      await sendOTP(cleanPhone);
      show('New code sent');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to resend';
      setError(msg);
    }
    setResendIn(RESEND_SECONDS);
    setExpired(false);
    setDigits(Array(CODE_LENGTH).fill(''));
    setActive(0);
    refs.current[0]?.focus();
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const resendAvailable = resendIn <= 0 || expired;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ height: 44, paddingLeft: space.md, justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          hitSlop={space.xs}
          onPress={() => router.replace('/phone-entry')}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={24} color={color('text/primary')} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={[styles.body, { marginHorizontal: space.md }]}>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.xl }]}>
          Enter the code.
        </Text>
        <Text
          style={[
            type['type/body-m'],
            { color: color('text/secondary'), marginTop: space['2xs'] },
          ]}
        >
          We sent a 6-digit code to{' '}
          <Text style={{ color: color('text/primary') }}>{phoneDisplay}</Text>.
        </Text>

        <Animated.View style={[shakeStyle, { marginTop: space.xl }]}>
          <Animated.View style={[pulseStyle, styles.boxRow]}>
            {digits.map((d, i) => {
              const filled = d !== '';
              const border = error
                ? color('semantic/danger')
                : i === active && !verifying
                  ? color('accent/default')
                  : filled
                    ? color('border/strong')
                    : color('border/subtle');
              const bw = i === active && !error && !verifying ? 2 : 1;
              return (
                <TextInput
                  key={i}
                  ref={(r) => {
                    refs.current[i] = r;
                  }}
                  value={d}
                  onChangeText={(v) => handleChange(i, v)}
                  onKeyPress={(e) => {
                    if (e.nativeEvent.key === 'Backspace') handleBackspace(i);
                  }}
                  onFocus={() => setActive(i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!verifying}
                  style={[
                    type['type/h1'],
                    {
                      width: 48,
                      height: 56,
                      backgroundColor: color('bg/sunken'),
                      borderRadius: radius.sm,
                      borderWidth: bw,
                      borderColor: border,
                      textAlign: 'center',
                      color: color('text/primary'),
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
        </Animated.View>

        {error ? (
          <Text
            style={[
              type['type/caption'],
              { color: color('semantic/danger'), marginTop: space.sm, textAlign: 'center' },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: space.md, alignItems: 'center' }}>
          {resendAvailable ? (
            <Pressable
              accessibilityRole="link"
              hitSlop={space.xs}
              onPress={resend}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[type['type/body-m'], { color: color('accent/default') }]}>
                Resend code
              </Text>
            </Pressable>
          ) : (
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              Didn&apos;t get a code? Resend in {formatTime(resendIn)}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="link"
          hitSlop={space.xs}
          onPress={() => router.replace('/phone-entry')}
          style={({ pressed }) => [
            styles.changeNumber,
            { marginTop: space.xl, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            Change number
          </Text>
        </Pressable>
      </View>

      <View style={{ height: insets.bottom + space.md }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  boxRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  changeNumber: { alignSelf: 'center' },
});

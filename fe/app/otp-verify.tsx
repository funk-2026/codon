import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
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

  // One hidden input holds the whole code; the six boxes only display it. Autofill, paste
  // and typing all land in one field, so a pasted code never flashes in the first box.
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [expired, setExpired] = useState(false);

  const inputRef = useRef<TextInputInstance>(null);
  const pulse = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    inputRef.current?.focus();
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
        router.replace('/role-picker' as any);
      } else if (role === 'teacher') {
        router.replace('/(teacher)/(tabs)/(home)');
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
      setCode('');
      inputRef.current?.focus();
    }
  };

  const onCodeChange = (val: string) => {
    const next = val.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) {
      inputRef.current?.blur();
      submit(next);
    }
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
    setCode('');
    inputRef.current?.focus();
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
            <Pressable
              onPress={() => inputRef.current?.focus()}
              accessible={false}
              style={[styles.boxRow, { gap: 8 }]}
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const d = code[i] ?? '';
                const active = focused && !verifying && i === Math.min(code.length, CODE_LENGTH - 1);
                const border = error
                  ? color('semantic/danger')
                  : active
                    ? color('accent/default')
                    : d
                      ? color('border/strong')
                      : color('border/subtle');
                return (
                  <View
                    key={i}
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      width: 48,
                      height: 56,
                      backgroundColor: color('bg/sunken'),
                      borderRadius: radius.sm,
                      borderWidth: active && !error ? 2 : 1,
                      borderColor: border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[type['type/h1'], { color: color('text/primary') }]}>{d}</Text>
                  </View>
                );
              })}
            </Pressable>
            {/* The real input: covers the boxes, invisible text and caret. */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onCodeChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              editable={!verifying}
              caretHidden
              contextMenuHidden={false}
              selectionColor="transparent"
              accessibilityLabel={`Verification code, ${CODE_LENGTH} digits`}
              accessibilityValue={{ text: code.split('').join(' ') || 'empty' }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', backgroundColor: 'transparent', fontSize: 1 }}
            />
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

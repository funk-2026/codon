import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Warning } from 'phosphor-react-native';
import { PrimaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function TestSubmitConfirmRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const isExpired = expired === '1';

  const answered = 18;
  const unanswered: number = 2;
  const total = 20;
  const timed = true;
  const timeLeft = '6:18';

  const [submitting, setSubmitting] = useState(false);
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withTiming(1, { duration: 260 });
  }, [rise]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * 400 }],
  }));

  const title = isExpired
    ? 'Time\u2019s up.'
    : unanswered === 0
      ? 'All done \u2014 ready to submit?'
      : 'Ready to submit?';

  const confirm = () => {
    setSubmitting(true);
    setTimeout(() => {
      router.replace('/(student)/(practice)/test-result');
    }, 700);
  };

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: color('bg/surface'),
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.lg,
            paddingBottom: space.lg + insets.bottom,
          },
          sheetStyle,
        ]}
      >
        <View style={styles.handle} />
        <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.md }]}>
          {title}
        </Text>

        <View style={[styles.tileRow, { gap: space.sm, marginTop: space.lg }]}>
          <StatTile
            label="Answered"
            value={answered}
            ink={color('semantic/success')}
          />
          <StatTile
            label="Unanswered"
            value={unanswered}
            ink={unanswered > 0 ? color('semantic/warning') : color('text/secondary')}
          />
          {timed ? <StatTile label="Time Left" valueText={timeLeft} ink={color('text/primary')} /> : null}
        </View>

        {unanswered > 0 ? (
          <View
            style={[
              styles.callout,
              {
                backgroundColor: color('semantic/warning'),
                borderRadius: radius.sm,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                marginTop: space.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
              },
            ]}
          >
            <Warning size={18} color={color('text/inverse')} weight="fill" />
            <Text style={[type['type/body-m'], { color: color('text/inverse'), flex: 1 }]}>
              You have {unanswered} unanswered questions. They\u2019ll score zero.
            </Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={space.xs}
            >
              <Text style={[type['type/body-m-medium'], { color: color('text/inverse'), textDecorationLine: 'underline' }]}>
                Review them
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <PrimaryButton
            label="Confirm & Submit"
            onPress={confirm}
            loading={submitting}
          />
          {!isExpired ? (
            <View style={{ alignItems: 'center' }}>
              <TextButton label="Go Back" onPress={() => router.back()} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function StatTile({
  label,
  value,
  valueText,
  ink,
}: {
  label: string;
  value?: number;
  valueText?: string;
  ink: string;
}) {
  const { color, type } = useTheme();
  const display = useSharedValue(0);
  useEffect(() => {
    display.value = withTiming(1, { duration: 200 });
  }, [display]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color('bg/sunken'),
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
      }}
    >
      <Text style={[type['type/h2'], { color: ink }]}>{valueText ?? value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CFCCC3',
    alignSelf: 'center',
  },
  tileRow: { flexDirection: 'row' },
  callout: {},
});

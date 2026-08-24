import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  PencilSimple,
  ClockCounterClockwise,
  ChartLineUp,
  Shield,
  GearSix,
  DeviceMobile,
  ChatCircleText,
  Info,
  CaretRight,
} from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getMe, getProgress } from '@/src/api/profile';
import type { Subscription } from '@/src/api/profile';

type SubState = 'active' | 'none';
type KycState = 'not_started' | 'pending' | 'verified' | 'action_needed' | null;

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
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

export default function ProfileHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [stats, setStats] = useState({ attempts: 0, avg: 0 });
  const [kycRequired, setKycRequired] = useState(false);

  const name = user?.name || 'Student';
  // Note: we'd ideally resolve selected_course_id to a name, but for now we just show a generic label or fetch it
  const courseChip = user?.selected_course_id ? 'Enrolled' : 'No Course';
  
  const kycState = (user?.kyc_status as KycState) || 'not_started';

  const load = useCallback(async () => {
    try {
      const [me, prog] = await Promise.all([getMe(), getProgress()]);
      if (me.active_subscription) setSub(me.active_subscription);
      setKycRequired(me.kyc_required);
      setStats({ attempts: prog.attempted_count, avg: prog.avg_score });
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load profile', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kycConfig: Record<Exclude<KycState, null>, { label: string; token: 'text/tertiary' | 'semantic/warning' | 'semantic/success' | 'semantic/danger' }> = {
    not_started: { label: 'Not Started', token: 'text/tertiary' },
    pending: { label: 'Pending', token: 'semantic/warning' },
    verified: { label: 'Verified', token: 'semantic/success' },
    action_needed: { label: 'Action Needed', token: 'semantic/danger' },
  };

  const initials = name
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={{ marginTop: space.lg, alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <View
                style={[
                  styles.avatar,
                  {
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: color('accent/tint'),
                  },
                ]}
              >
                <Text style={[type['type/h1'], { color: color('accent/default') }]}>
                  {initials}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(student)/(profile)/edit-profile')}
                hitSlop={space.xs}
                style={({ pressed }) => [
                  styles.editBadge,
                  {
                    backgroundColor: color('accent/default'),
                    borderColor: color('bg/canvas'),
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <PencilSimple size={14} color={color('accent/on-accent')} weight="bold" />
              </Pressable>
            </View>
            <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]}>
              {name}
            </Text>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.pill,
                  paddingHorizontal: space.sm,
                  marginTop: space['2xs'],
                },
              ]}
            >
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                {courseChip}
              </Text>
            </View>
          </View>
        </Stagger>

        {loadError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={load} />
          </View>
        ) : null}

        <Stagger delayMs={80}>
          <View style={{ marginTop: space.xl }}>
            {loading ? (
              <SkeletonBlock height={76} radius={radius.lg} />
            ) : (
              <Pressable
                onPress={() => router.push('/(student)/(profile)/subscription-plans')}
                style={({ pressed }) => [
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.lg,
                    padding: space.lg,
                    opacity: pressed ? 0.94 : 1,
                  },
                  shadow(),
                ]}
              >
                {sub ? (
                  <>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                      {sub.plan?.name || 'Pro Subscription'}
                    </Text>
                    <Text
                      style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}
                    >
                      Active until {new Date(sub.end_date).toLocaleDateString()}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                      You&apos;re on Free access
                    </Text>
                    <Text
                      style={[type['type/body-m-medium'], { color: color('accent/default'), marginTop: space.xs }]}
                    >
                      View Plans
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </Stagger>

        <Stagger delayMs={160}>
          <View style={[styles.statRow, { gap: space.xs, marginTop: space.lg }]}>
            {loading ? (
              <>
                <SkeletonBlock height={72} radius={radius.md} style={{ flex: 1 }} />
                <SkeletonBlock height={72} radius={radius.md} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => router.push('/(student)/(practice)/test-history')}
                  style={({ pressed }) => [
                    styles.statTile,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  <ClockCounterClockwise size={20} color={color('accent/default')} weight="duotone" />
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginTop: space.xs }]}>
                    Test History
                  </Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                    {stats.attempts} attempts
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(student)/(profile)/progress-detail')}
                  style={({ pressed }) => [
                    styles.statTile,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  <ChartLineUp size={20} color={color('accent/default')} weight="duotone" />
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginTop: space.xs }]}>
                    Progress
                  </Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                    {Math.round(stats.avg)}% avg
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Stagger>

        {kycRequired ? (
          <Stagger delayMs={240}>
            <View style={{ marginTop: space.lg }}>
              <Pressable
                onPress={() =>
                  router.push(
                    kycState && kycState !== 'not_started'
                      ? '/(student)/(profile)/kyc-status'
                      : '/(student)/(profile)/kyc-submission'
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <Shield size={20} color={color('text/secondary')} weight="regular" />
                <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
                  Identity Verification
                </Text>
                <Text
                  style={[
                    type['type/caption'],
                    { color: color(kycConfig[kycState ?? 'not_started'].token), marginRight: space.xs },
                  ]}
                >
                  {kycConfig[kycState ?? 'not_started'].label}
                </Text>
                <CaretRight size={18} color={color('text/tertiary')} />
              </Pressable>
            </View>
          </Stagger>
        ) : null}

        <Stagger delayMs={320}>
          <View style={{ marginTop: space.lg, gap: space.md }}>
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md }, shadow()]}>
              <MenuRow
                icon={<GearSix size={20} color={color('text/secondary')} />}
                label="Settings"
                onPress={() => router.push('/(student)/(profile)/settings')}
              />
              <Divider />
              <MenuRow
                icon={<DeviceMobile size={20} color={color('text/secondary')} />}
                label="Manage Devices"
                onPress={() => router.push('/(student)/(profile)/manage-devices')}
                last
              />
            </View>
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md }, shadow()]}>
              <MenuRow
                icon={<ChatCircleText size={20} color={color('text/secondary')} />}
                label="Give Feedback"
                onPress={() => router.push('/(student)/(profile)/give-feedback')}
              />
              <Divider />
              <MenuRow
                icon={<Info size={20} color={color('text/secondary')} />}
                label="About MMM"
                onPress={() => router.push('/(student)/(support)/about-mmm')}
                last
              />
            </View>
          </View>
        </Stagger>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          padding: space.md,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: last ? radius.md : 0,
          borderBottomRightRadius: last ? radius.md : 0,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
        {label}
      </Text>
      <CaretRight size={18} color={color('text/tertiary')} />
    </Pressable>
  );
}

function Divider() {
  const { color } = useTheme();
  return <View style={{ height: 1, backgroundColor: color('border/subtle') }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { paddingVertical: 4 },
  statRow: { flexDirection: 'row' },
  statTile: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  PencilSimple,
  Shield,
  GearSix,
  DeviceMobile,
  ChatCircleText,
  Question,
  Receipt,
  CaretRight,
  ArrowsClockwise,
  BookmarkSimple,
  FlagBanner,
} from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useMe } from '@/src/queries/profile';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import type { Subscription } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useOpenRolePicker } from '@/src/navigation/useOpenRolePicker';

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


export default function ProfileHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const openRolePicker = useOpenRolePicker();
  const { user } = useAuth();
  
  const meQuery = useMe();
  const loading = meQuery.isPending;
  const loadError = meQuery.isError;
  const load = () => void meQuery.refetch();
  useRefetchOnFocus(load);

  const sub: Subscription | null = meQuery.data?.active_subscription ?? null;
  const kycRequired = meQuery.data?.kyc_required ?? false;

  const name = user?.name || 'Student';
  // Note: we'd ideally resolve selected_course_id to a name, but for now we just show a generic label or fetch it
  const courseChip = user?.selected_course_id ? 'Enrolled' : 'No Course';

  const kycState = (user?.kyc_status as KycState) || 'not_started';

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
    <Screen edges={TAB_EDGES}>
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
                onPress={() => router.push(ROUTES.student.editProfile)}
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
                onPress={() => router.push(ROUTES.student.subscriptionPlans)}
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

        {kycRequired ? (
          <Stagger delayMs={240}>
            <View style={{ marginTop: space.lg }}>
              <Pressable
                onPress={() =>
                  router.push(
                    kycState && kycState !== 'not_started'
                      ? ROUTES.student.kycStatus
                      : ROUTES.student.kycSubmission
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
                icon={<BookmarkSimple size={20} color={color('text/secondary')} />}
                label="Bookmarks"
                onPress={() => router.push(ROUTES.student.bookmarks)}
              />
              <Divider />
              <MenuRow
                icon={<FlagBanner size={20} color={color('text/secondary')} />}
                label="My reports"
                onPress={() => router.push(ROUTES.student.myReports)}
              />
              <Divider />
              <MenuRow
                icon={<Receipt size={20} color={color('text/secondary')} />}
                label="Payments"
                onPress={() => router.push(ROUTES.student.payments)}
              />
              <Divider />
              <MenuRow
                icon={<GearSix size={20} color={color('text/secondary')} />}
                label="Settings"
                onPress={() => router.push(ROUTES.student.settings)}
              />
              {user?.role === 'admin' ? (
                <>
                  <Divider />
                  <MenuRow
                    icon={<ArrowsClockwise size={20} color={color('accent/default')} weight="duotone" />}
                    label="Switch Role"
                    onPress={async () => {
                      const { clearAdminActiveRole } = await import('@/src/auth/tokenStore');
                      await clearAdminActiveRole();
                      openRolePicker();
                    }}
                  />
                </>
              ) : null}
              <Divider />
              <MenuRow
                icon={<DeviceMobile size={20} color={color('text/secondary')} />}
                label="Manage Devices"
                onPress={() => router.push(ROUTES.student.manageDevices)}
                last
              />
            </View>
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md }, shadow()]}>
              <MenuRow
                icon={<ChatCircleText size={20} color={color('text/secondary')} />}
                label="Give Feedback"
                onPress={() => router.push(ROUTES.student.giveFeedback)}
              />
              <Divider />
              <MenuRow
                icon={<Question size={20} color={color('text/secondary')} />}
                label="Help and support"
                onPress={() => router.push(ROUTES.student.help)}
                last
              />
            </View>
          </View>
        </Stagger>
      </ScrollView>
    </Screen>
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

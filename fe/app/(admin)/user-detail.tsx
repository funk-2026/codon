import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretRight, DeviceMobile, Shield, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, ConfirmDialog, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, StatusBadge, TextButton, useToast, type BadgeStatus } from '@/src/components';
import { ReasonSheet } from '@/src/admin/ReasonSheet';
import { getUserActivity, grantAccess, purgePersonalData, reactivateUser, revokeAllUserSessions, revokeUserSession, suspendUser } from '@/src/api/adminOps';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { adminListAllContent, adminListAllTests, adminListKYC, adminListSubscriptionPlans, getUser, getUserSessions, getUserSubscription, listPaymentsPage, updateTeacherPermissions, updateUserRole } from '@/src/api/admin';
import { allPages } from '@/src/api/paginate';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type Role = 'student' | 'teacher' | 'admin';
const ROLES: Role[] = ['student', 'teacher', 'admin'];
const ROLE_TEXT: Record<Role, string> = {
  student: 'Learns and practises. This is how everyone starts.',
  teacher: 'Creates tests, lessons, Brain Hacks and flashcards, and submits them for review.',
  admin: 'Full control: approves content, manages users, payments and settings.',
};

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * A user as a support view: who they are, what they pay for, where they're signed in, and, for
 * teachers, what they've made. Changing a role is rare and consequential, so it sits last.
 */
export default function UserDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth();
  const queryClient = useQueryClient();

  const userQuery = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => getUser(id), enabled: !!id });
  const user = userQuery.data ?? null;
  const role = (user?.role ?? 'student') as Role;
  const isMe = me.status === 'authenticated' && me.user.id === user?.id;

  const subscription = useQuery({ queryKey: ['admin', 'user', id, 'subscription'], queryFn: () => getUserSubscription(id), enabled: !!id && role === 'student' });
  const sessions = useQuery({ queryKey: ['admin', 'user', id, 'sessions'], queryFn: () => getUserSessions(id), enabled: !!id });
  // Their four most recent payments (the server filters by user), so history isn't cut off by a long list.
  const paymentsQuery = useQuery({ queryKey: ['admin', 'user', id, 'payments'], queryFn: () => listPaymentsPage({ user_id: id, limit: 4 }), enabled: !!id && role === 'student' });
  const payments = (paymentsQuery.data?.payments ?? []).filter((p) => p.user_id === id);
  const made = useQuery({
    queryKey: ['admin', 'user', id, 'made'],
    enabled: !!id && role === 'teacher',
    queryFn: async () => {
      // Every page of both lists, then keep this teacher's items (the server filter narrows it where supported).
      const [t, c] = await Promise.all([
        allPages((cursor) => adminListAllTests({ cursor, limit: 200, creator_id: id }).then((r) => ({ items: r.tests, next: r.next_cursor }))).catch(() => ({ items: [] as Awaited<ReturnType<typeof adminListAllTests>>['tests'] })),
        allPages((cursor) => adminListAllContent({ cursor, limit: 200, uploader_id: id }).then((r) => ({ items: r.content, next: r.next_cursor }))).catch(() => ({ items: [] as Awaited<ReturnType<typeof adminListAllContent>>['content'] })),
      ]);
      const mine = [...t.items.filter((x) => x.creator?.id === id), ...c.items.filter((x) => x.uploader?.id === id)];
      const norm = (st: string) => (st === 'pending_review' ? 'pending' : st);
      return { total: mine.length, live: mine.filter((x) => norm(x.status) === 'published').length, waiting: mine.filter((x) => norm(x.status) === 'pending').length };
    },
  });

  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [signOutAll, setSignOutAll] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [days, setDays] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);

  const activity = useQuery({ queryKey: ['admin', 'user', id, 'activity'], queryFn: () => getUserActivity(id), enabled: !!id, retry: false });
  const plansQuery = useQuery({ queryKey: ['admin', 'plans', 'active'], queryFn: () => adminListSubscriptionPlans().then((r) => r.plans.filter((p) => p.is_active)), enabled: grantOpen });

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] });

  // Run an admin action, then refresh what it changes. Errors show the server's reason when there is one.
  const act = async (fn: () => Promise<unknown>, done: string, after?: () => void) => {
    setActionBusy(true);
    try {
      await fn();
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      show(done, 'success');
      after?.();
    } catch (e) {
      show(e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const changeRole = async () => {
    if (!pendingRole || !user) return;
    setBusy(true);
    try {
      await updateUserRole(user.id, pendingRole);
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      show('Role updated', 'success');
    } catch {
      show('Failed to update role', 'error');
    } finally {
      setBusy(false);
      setPendingRole(null);
    }
  };

  const togglePermission = async (value: boolean) => {
    if (!user || permBusy) return;
    setPermBusy(true);
    queryClient.setQueryData(['admin', 'user', id], { ...user, can_manage_all_content: value });
    try {
      await updateTeacherPermissions(user.id, value);
    } catch {
      queryClient.setQueryData(['admin', 'user', id], user);
      show('Failed to update permission', 'error');
    } finally {
      setPermBusy(false);
    }
  };

  const openKyc = async () => {
    if (!user || kycBusy) return;
    setKycBusy(true);
    try {
      // No "KYC record by user" endpoint exists, so look across the three statuses.
      const [p, a, r] = await Promise.all([adminListKYC('pending'), adminListKYC('approved'), adminListKYC('rejected')]);
      const record = [...p.records, ...a.records, ...r.records].find((x) => x.user_id === user.id);
      if (!record) return show('No KYC record found for this user', 'error');
      router.push({ pathname: ROUTES.admin.kycReviewDetail, params: { id: record.id, from: 'user-detail' } });
    } catch {
      show('Failed to load KYC record', 'error');
    } finally {
      setKycBusy(false);
    }
  };

  if (userQuery.isPending) {
    return (
      <Screen>
        <ScreenHeader title="User" />
        <View style={{ padding: space.md, gap: space.sm }}>
          <SkeletonBlock height={96} radius={radius.lg} />
          <SkeletonBlock height={120} radius={radius.md} />
        </View>
      </Screen>
    );
  }
  if (userQuery.isError || !user) {
    return (
      <Screen>
        <ScreenHeader title="User" />
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn't load this user"
          description="Something went wrong fetching this user's details."
          action={<TextButton label="Retry" onPress={() => void userQuery.refetch()} />}
        />
      </Screen>
    );
  }

  const name = user.name || 'Unknown user';
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const sub = subscription.data?.subscription ?? null;
  const card = [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()];
  const label = (t: string) => <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>{t}</Text>;

  return (
    <Screen>
      <ScreenHeader title="User" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom, gap: space.lg }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[type['type/h1'], { color: color('accent/default') }]}>{initials}</Text>
          </View>
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]}>{name}</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]}>{user.phone_number}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2, textTransform: 'capitalize' }]}>
            {role} · member since {when(user.created_at)}
          </Text>
        </View>

        {user.suspended_at ? (
          <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
            <Text style={[type['type/h3'], { color: color('semantic/danger') }]}>Suspended</Text>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
              {user.suspended_reason || 'No reason recorded.'} Since {when(user.suspended_at)}. They can’t sign in.
            </Text>
            <SecondaryButton label="Reactivate account" onPress={() => void act(() => reactivateUser(user.id), 'Account reactivated')} loading={actionBusy} />
          </View>
        ) : null}

        {role === 'student' ? (
          <View>
            {label('SUBSCRIPTION')}
            <View style={card}>
              {subscription.isPending ? (
                <SkeletonBlock height={44} radius={radius.sm} />
              ) : sub ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{sub.plan?.name ?? 'Plan'}</Text>
                    <StatusBadge status={sub.status === 'active' ? 'published' : 'pending'} label={sub.status === 'active' ? 'Active' : sub.status} />
                  </View>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                    Until {when(sub.end_date)}{sub.auto_renew ? ' · renews automatically' : ''}
                  </Text>
                </>
              ) : (
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No active subscription.</Text>
              )}
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}>
                Course: {user.selected_course?.name || 'none selected'}
              </Text>
            </View>
            {payments.length > 0 ? (
              <View style={{ marginTop: space.xs, gap: space.xs }}>
                {payments.slice(0, 3).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push({ pathname: ROUTES.admin.paymentDetail, params: { id: p.id } })}
                    accessibilityRole="button"
                    style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{rupees(p.amount_paise)} · {p.subscription?.plan?.name ?? 'Payment'}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{when(p.created_at)}</Text>
                    </View>
                    <Text style={[type['type/caption'], { color: color(p.status === 'captured' ? 'semantic/success' : p.status === 'failed' ? 'semantic/danger' : 'text/tertiary'), textTransform: 'capitalize', marginRight: space.xs }]}>{p.status}</Text>
                    <CaretRight size={16} color={color('text/tertiary')} />
                  </Pressable>
                ))}
                {payments.length > 3 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Older payments are in the Payments tab.</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {role === 'student' ? (
          <SecondaryButton label="Give or extend access" onPress={() => { setPlanId(null); setDays(''); setGrantReason(''); setGrantOpen(true); }} />
        ) : null}

        {role === 'student' ? (
          <View>
            {label('VERIFICATION')}
            <Pressable onPress={openKyc} disabled={kycBusy} accessibilityRole="button" style={({ pressed }) => [card, { flexDirection: 'row', alignItems: 'center', opacity: pressed || kycBusy ? 0.8 : 1 }]}>
              <Shield size={20} color={color('text/secondary')} />
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>Identity verification</Text>
              {user.kyc_status && user.kyc_status !== 'not_required' ? (
                <StatusBadge status={(user.kyc_status === 'approved' || user.kyc_status === 'rejected' ? user.kyc_status : 'pending') as BadgeStatus} />
              ) : (
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Not required</Text>
              )}
              <CaretRight size={18} color={color('text/tertiary')} style={{ marginLeft: space.xs }} />
            </Pressable>
          </View>
        ) : null}

        {role === 'teacher' ? (
          <View>
            {label('THEIR WORK')}
            <View style={card}>
              {made.isPending ? (
                <SkeletonBlock height={40} radius={radius.sm} />
              ) : (
                <Pressable onPress={() => router.push({ pathname: ROUTES.admin.review, params: { segment: 'content' } })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>{made.data?.total ?? 0} test{made.data?.total === 1 ? '' : 's'} and lessons</Text>
                    <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{made.data?.live ?? 0} live · {made.data?.waiting ?? 0} waiting for review</Text>
                  </View>
                  <CaretRight size={18} color={color('text/tertiary')} />
                </Pressable>
              )}
              <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.sm }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Can manage all content</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>Lets them edit and review other teachers’ content, not just their own.</Text>
                </View>
                <Switch value={!!user.can_manage_all_content} onValueChange={togglePermission} disabled={permBusy} trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />
              </View>
            </View>
          </View>
        ) : null}

        {activity.data ? (
          <View>
            {label('ACTIVITY')}
            <View style={[card, { gap: space.xs }]}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 22 }]}>{activity.data.tests_submitted}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Tests finished</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 22 }]}>{activity.data.avg_score_pct != null ? `${Math.round(activity.data.avg_score_pct)}%` : '—'}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Average score</Text>
                </View>
              </View>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                Last signed in {when(activity.data.last_login_at)} · last test {when(activity.data.last_attempt_at)}
              </Text>
            </View>
          </View>
        ) : null}

        <View>
          {label('DEVICES')}
          <View style={card}>
            {sessions.isPending ? (
              <SkeletonBlock height={40} radius={radius.sm} />
            ) : sessions.isError ? (
              <TextButton label="Couldn’t load devices. Retry" onPress={() => void sessions.refetch()} />
            ) : (sessions.data?.sessions ?? []).length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Not signed in on any device.</Text>
            ) : (
              <View style={{ gap: space.sm }}>
                {(sessions.data?.sessions ?? []).map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <DeviceMobile size={22} color={color('text/secondary')} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{s.device_info || 'Unknown device'}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Last used {when(s.last_used_at)}</Text>
                    </View>
                    <TextButton
                      label="Sign out"
                      onPress={() => void act(() => revokeUserSession(user.id, s.id).then(() => sessions.refetch()), 'Signed out')}
                      disabled={actionBusy}
                    />
                  </View>
                ))}
                {(sessions.data?.sessions ?? []).length > 1 ? <TextButton label="Sign out everywhere" onPress={() => setSignOutAll(true)} disabled={actionBusy} /> : null}
              </View>
            )}
          </View>
        </View>

        <View>
          {label('ADVANCED')}
          <View style={card}>
            <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Role</Text>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{ROLE_TEXT[role]}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3, marginTop: space.sm, opacity: isMe ? 0.5 : 1 }}>
              {ROLES.map((r) => {
                const active = role === r;
                return (
                  <Pressable
                    key={r}
                    disabled={isMe}
                    onPress={() => { if (r !== role) setPendingRole(r); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{ flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: active ? color('accent/default') : 'transparent' }}
                  >
                    <Text style={[type['type/body-m-medium'], { color: active ? color('accent/on-accent') : color('text/secondary'), textTransform: 'capitalize' }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            {isMe ? <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>You can’t change your own role.</Text> : null}
          </View>
          <View style={[card, { marginTop: space.xs, gap: space.xs }]}>
            <TextButton label="See what admins changed on this account" onPress={() => router.push({ pathname: ROUTES.admin.auditLog, params: { target: `user:${user.id}` } })} />
            {!isMe && !user.suspended_at ? <TextButton label="Suspend account" onPress={() => setSuspendOpen(true)} /> : null}
            {!isMe ? <TextButton label="Erase personal data" onPress={() => setPurgeOpen(true)} /> : null}
          </View>
        </View>
      </ScrollView>

      <ReasonSheet
        visible={suspendOpen}
        title={`Suspend ${name}?`}
        description="They’re signed out everywhere and can’t sign in until you reactivate the account."
        confirmLabel="Suspend"
        busy={actionBusy}
        onClose={() => setSuspendOpen(false)}
        onConfirm={(reason) => void act(() => suspendUser(user.id, reason), 'Account suspended', () => setSuspendOpen(false))}
      />
      <BottomSheet visible={grantOpen} onClose={() => setGrantOpen(false)} title="Give or extend access" dismissable={!actionBusy}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No payment is recorded. Extends their current plan if they have one, otherwise starts it.</Text>
          {plansQuery.isPending ? (
            <SkeletonBlock height={44} radius={radius.sm} />
          ) : (
            <View style={{ gap: space.xs }}>
              {(plansQuery.data ?? []).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPlanId(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: planId === p.id }}
                  style={{ padding: space.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: planId === p.id ? color('accent/default') : color('border/subtle'), backgroundColor: planId === p.id ? color('accent/tint') : color('bg/surface') }}
                >
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{p.name}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{p.duration_days} days</Text>
                </Pressable>
              ))}
            </View>
          )}
          <InputField label="Days to add (blank = the plan’s length)" value={days} onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} />
          <InputField label="Reason (kept in the audit log)" value={grantReason} onChangeText={setGrantReason} multiline maxLength={500} />
          <PrimaryButton
            label="Give access"
            loading={actionBusy}
            disabled={!planId || grantReason.trim().length < 3}
            onPress={() => void act(() => grantAccess(user.id, { plan_id: planId as string, days: days ? Number(days) : undefined, reason: grantReason.trim() }).then(() => subscription.refetch()), 'Access updated', () => setGrantOpen(false))}
          />
        </View>
      </BottomSheet>
      <ConfirmDialog
        visible={signOutAll}
        title={`Sign ${name} out everywhere?`}
        confirmLabel="Sign out"
        loading={actionBusy}
        onConfirm={() => void act(() => revokeAllUserSessions(user.id).then(() => sessions.refetch()), 'Signed out everywhere', () => setSignOutAll(false))}
        onCancel={() => setSignOutAll(false)}
      />
      <ConfirmDialog
        visible={purgeOpen}
        title={`Erase ${name}’s personal data?`}
        message="This removes their personal details for a privacy request. It can’t be undone."
        confirmLabel="Erase"
        tone="danger"
        loading={actionBusy}
        onConfirm={() => void act(() => purgePersonalData(user.id), 'Personal data erased', () => setPurgeOpen(false))}
        onCancel={() => setPurgeOpen(false)}
      />
      <ConfirmDialog
        visible={!!pendingRole}
        title={`Make ${name} a ${pendingRole}?`}
        message={pendingRole ? `${ROLE_TEXT[pendingRole]}${pendingRole === 'admin' ? ' This gives them access to everything, including other people’s accounts.' : ''}` : undefined}
        confirmLabel={pendingRole === 'admin' ? 'Make admin' : 'Confirm'}
        tone={pendingRole === 'admin' ? 'danger' : 'default'}
        loading={busy}
        onConfirm={changeRole}
        onCancel={() => setPendingRole(null)}
      />
    </Screen>
  );
}

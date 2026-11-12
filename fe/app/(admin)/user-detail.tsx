import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretRight, Shield, WarningCircle } from 'phosphor-react-native';
import { EmptyState, StatusBadge, TextButton, useToast, SkeletonBlock, type BadgeStatus, ScreenHeader, Screen, ConfirmDialog } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getUser, updateUserRole, updateTeacherPermissions, adminListKYC } from '@/src/api/admin';
import type { UserProfile } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Role = 'student' | 'teacher' | 'admin';

const SEGMENTS: Role[] = ['student', 'teacher', 'admin'];

export default function UserDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [permUpdating, setPermUpdating] = useState(false);
  const [kycNavLoading, setKycNavLoading] = useState(false);

  const queryClient = useQueryClient();
  const loadQuery = useQuery({
    queryKey: ['app-admin-user-detail-tsx', id],
    queryFn: () =>
      getUser(id).then((res) => {
        
        let user = null;
        let canManageAllContent = false;
        user = res;
        canManageAllContent = res.can_manage_all_content;
        
      
        return { user, canManageAllContent };
      }),
    enabled: !!id,
  });
  const user = loadQuery.data?.user ?? null;
  const canManageAllContent = loadQuery.data?.canManageAllContent ?? false;
  const loading = loadQuery.isPending;
  const loadError = loadQuery.isError;
  const loadUser = () => void loadQuery.refetch();
  const setCanManageAllContent = (u: typeof canManageAllContent | ((p: typeof canManageAllContent) => typeof canManageAllContent)) =>
    queryClient.setQueryData(['app-admin-user-detail-tsx', id], (old: any) => ({ ...(old ?? {}), canManageAllContent: typeof u === 'function' ? u(old?.canManageAllContent ?? false) : u }));
  const setUser = (u: typeof user | ((p: typeof user) => typeof user)) =>
    queryClient.setQueryData(['app-admin-user-detail-tsx', id], (old: any) => ({ ...(old ?? {}), user: typeof u === 'function' ? u(old?.user ?? null) : u }));



  const toggleCanManageAllContent = async (value: boolean) => {
    if (!user || permUpdating) return;
    const previous = canManageAllContent;
    setCanManageAllContent(value);
    setPermUpdating(true);
    try {
      await updateTeacherPermissions(user.id, value);
    } catch (e) {
      setCanManageAllContent(previous);
      show('Failed to update permission', 'error');
    } finally {
      setPermUpdating(false);
    }
  };

  const confirmRoleChange = async () => {
    if (!pendingRole || !user) return;
    setRoleUpdating(true);
    try {
      await updateUserRole(user.id, pendingRole);
      setUser({ ...user, role: pendingRole });
      show('Role updated', 'success');
    } catch (e) {
      show('Failed to update role', 'error');
    } finally {
      setRoleUpdating(false);
      setPendingRole(null);
    }
  };

  const goToKycReview = async () => {
    if (!user || kycNavLoading) return;
    setKycNavLoading(true);
    try {
      // There's no "get KYC record by user id" endpoint — the admin list endpoint
      // is filtered by status, so look across all three to find this user's record.
      const [pending, approved, rejected] = await Promise.all([
        adminListKYC('pending'),
        adminListKYC('approved'),
        adminListKYC('rejected'),
      ]);
      const record = [...pending.records, ...approved.records, ...rejected.records].find(
        (r) => r.user_id === user.id
      );
      if (!record) {
        show('No KYC record found for this user', 'error');
        return;
      }
      router.push({ pathname: ROUTES.admin.kycReviewDetail, params: { id: record.id, from: 'user-detail' } });
    } catch (e) {
      show('Failed to load KYC record', 'error');
    } finally {
      setKycNavLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader />
        <View style={{ padding: space.md, alignItems: 'center' }}>
          <SkeletonBlock height={72} radius={36} style={{ width: 72 }} />
        </View>
      </Screen>
    );
  }

  if (loadError || !user) {
    return (
      <Screen>
        <ScreenHeader />
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn't load this user"
          description="Something went wrong fetching this user's details."
          action={<TextButton label="Retry" onPress={loadUser} />}
        />
      </Screen>
    );
  }

  const displayName = user.name || 'Unknown User';
  const initials = displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';

  return (
    <Screen>
      <ScreenHeader title="User Detail" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <View style={[styles.avatar, { width: 72, height: 72, borderRadius: 36, backgroundColor: color('accent/tint') }]}>
            <Text style={[type['type/h1'], { color: color('accent/default') }]}>{initials}</Text>
          </View>
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]}>{displayName}</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]}>
            {user.phone_number}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            Member since {memberSince}
          </Text>
        </View>

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            ROLE
          </Text>
          <View style={[styles.segmented, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3 }]}>
            {SEGMENTS.map((seg) => {
              const active = user.role === seg;
              return (
                <Pressable
                  key={seg}
                  onPress={() => {
                    if (seg !== user.role) setPendingRole(seg);
                  }}
                  style={[
                    styles.segment,
                    { borderRadius: radius.pill, backgroundColor: active ? color('accent/default') : 'transparent' },
                  ]}
                >
                  <Text
                    style={[
                      type['type/body-m-medium'],
                      { color: active ? color('accent/on-accent') : color('text/secondary'), textTransform: 'capitalize' },
                    ]}
                  >
                    {seg}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {user.role === 'teacher' ? (
          <View
            style={[
              styles.row,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-l'], { color: color('text/primary') }]}>
                Can manage all content
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                Allows editing and reviewing other teachers&apos; content, not just their own.
              </Text>
            </View>
            <Switch
              value={canManageAllContent}
              onValueChange={toggleCanManageAllContent}
              disabled={permUpdating}
              trackColor={{ false: color('border/strong'), true: color('accent/default') }}
              thumbColor={color('bg/surface')}
            />
          </View>
        ) : null}

        {user.role === 'student' ? (
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Course</Text>
            <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: 2 }]}>
              {user.selected_course?.name || 'No course selected'}
            </Text>
            <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.sm }} />
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Subscription</Text>
            <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: 2 }]}>
              Not available in this view yet
            </Text>
          </View>
        ) : null}

        {user.role === 'student' ? (
          <Pressable
            onPress={goToKycReview}
            disabled={kycNavLoading}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg, opacity: pressed || kycNavLoading ? 0.94 : 1 },
            ]}
          >
            <Shield size={20} color={color('text/secondary')} />
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
              Identity Verification
            </Text>
            {user.kyc_status && user.kyc_status !== 'not_required' ? (
              <StatusBadge
                status={
                  (user.kyc_status === 'approved' || user.kyc_status === 'rejected'
                    ? user.kyc_status
                    : 'pending') as BadgeStatus
                }
              />
            ) : null}
            <CaretRight size={18} color={color('text/tertiary')} style={{ marginLeft: space.xs }} />
          </Pressable>
        ) : null}

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
          ]}
        >
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Last login</Text>
          <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: 2 }]}>
            {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
            Active device count isn&apos;t available in this view yet
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={!!pendingRole}
        title={`Change ${displayName}'s role to ${pendingRole}?`}
        confirmLabel="Confirm"
        loading={roleUpdating}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRole(null)}
      />
    </Screen>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

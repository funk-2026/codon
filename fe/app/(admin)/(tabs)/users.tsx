import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, Screen, TAB_EDGES, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listUsersPage } from '@/src/api/admin';
import { inviteTeacher } from '@/src/api/adminOps';
import { downloadAndShareCsv } from '@/src/api/exportCsv';
import { ApiError } from '@/src/api/client';
import { useCursorList } from '@/src/queries/useCursorList';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import type { UserProfile } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { TreeToolbar } from '@/src/screens/CurriculumTree';

type RoleFilter = 'All' | 'student' | 'teacher' | 'admin';

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'admin', label: 'Admins' },
];

const KYC_DOT_COLOR: Record<string, 'semantic/warning' | 'semantic/success' | 'semantic/danger'> = {
  pending: 'semantic/warning',
  approved: 'semantic/success',
  rejected: 'semantic/danger',
};

export default function UserManagementListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const invite = async () => {
    setInviting(true);
    try {
      const u = await inviteTeacher({ phone_number: phone.trim(), name: inviteName.trim() || undefined });
      setInviteOpen(false);
      setPhone('');
      setInviteName('');
      list.load();
      show('Teacher added. They can sign in with this number.', 'success');
      router.push({ pathname: ROUTES.admin.userDetail, params: { id: u.id } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'user_exists' && e.details?.user_id) {
        setInviteOpen(false);
        show('That number already has an account.', 'error');
        router.push({ pathname: ROUTES.admin.userDetail, params: { id: String(e.details.user_id) } });
      } else {
        show(e instanceof Error && e.message ? e.message : 'Couldn’t add the teacher.', 'error');
      }
    } finally {
      setInviting(false);
    }
  };
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Search and role are applied by the server, so any user can be found, not only the newest page.
  const list = useCursorList<UserProfile, Awaited<ReturnType<typeof listUsersPage>>>(
    ['admin', 'users', roleFilter, search],
    (cursor) => listUsersPage({ role: roleFilter === 'All' ? undefined : roleFilter, search: search || undefined, limit: 50, cursor }),
    (r) => r.users,
  );
  const users = list.rows;
  const loading = list.loading;
  const loadError = list.error;
  const load = list.load;
  useRefetchOnFocus(list.load);
  // Until the server applies the filters, also match locally, so results never include the wrong people.
  const needle = search.toLowerCase();
  const filtered = users.filter(
    (u) => (roleFilter === 'All' || u.role === roleFilter) && (!needle || (u.name ?? '').toLowerCase().includes(needle) || (u.phone_number ?? '').includes(search)),
  );

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Users</Text>
          <Pressable
            onPress={() => setInviteOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a teacher"
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space['2xs'], backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'), borderRadius: radius.pill, paddingHorizontal: space.sm, minHeight: 36 }]}
          >
            <Plus size={18} color={color('action/on-primary')} weight="bold" />
            <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>Add teacher</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space['2xs'], minHeight: 28 }}>
          <Text numberOfLines={1} style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]}>
            {loading ? ' ' : `${filtered.length}${list.hasMore ? '+' : ''} ${filtered.length === 1 && !list.hasMore ? 'person' : 'people'}${search || roleFilter !== 'All' ? ' match' : ' on the platform'}`}
          </Text>
          <TextButton label="Export CSV" onPress={() => downloadAndShareCsv('/admin/export/users.csv', 'users.csv').catch((e) => show(e instanceof Error ? e.message : 'Export failed', 'error'))} />
        </View>
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <TreeToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name or phone number"
          chips={{ options: FILTERS, value: roleFilter, onChange: (k) => setRoleFilter(k as RoleFilter) }}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space['3xl'], gap: space.xs }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load users"
            description="Something went wrong fetching the user list."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            No users match &apos;{query}&apos;.
          </Text>
        ) : (
          filtered.map((u) => {
            const displayName = u.name || 'Unknown User';
            const initials = displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
            const isAdmin = u.role === 'admin';
            const kycColor = KYC_DOT_COLOR[u.kyc_status] || 'semantic/warning';
            return (
              <Pressable
                key={u.id}
                onPress={() => router.push({ pathname: ROUTES.admin.userDetail, params: { id: u.id } })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={{ position: 'relative' }}>
                  <View
                    style={[
                      styles.avatar,
                      { width: 40, height: 40, borderRadius: 20, backgroundColor: color('accent/tint') },
                    ]}
                  >
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>{initials}</Text>
                  </View>
                  {u.kyc_status && u.kyc_status !== 'not_required' ? (
                    <View
                      style={[
                        styles.kycDot,
                        { backgroundColor: color(kycColor), borderColor: color('bg/surface') },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{displayName}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {u.phone_number}
                  </Text>
                </View>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isAdmin ? color('accent/tint') : color('bg/sunken'),
                      borderRadius: radius.pill,
                      paddingHorizontal: space.sm,
                    },
                  ]}
                >
                  <Text
                    style={[type['type/caption'], { color: isAdmin ? color('accent/default') : color('text/secondary'), textTransform: 'capitalize' }]}
                  >
                    {u.role}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
        {list.hasMore ? <SecondaryButton label={list.more ? 'Loading…' : 'Load more'} onPress={() => void list.loadMore()} loading={list.more} /> : null}
      </ScrollView>
      <BottomSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} title="Add a teacher" dismissable={!inviting}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Creates the account now. When they sign in with this number, they land in the teacher app.</Text>
          <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={16} />
          <InputField label="Name (optional)" value={inviteName} onChangeText={setInviteName} maxLength={80} />
          <PrimaryButton label="Add teacher" onPress={invite} loading={inviting} disabled={phone.replace(/[^0-9]/g, '').length < 8} />
        </View>
      </BottomSheet>
    </Screen>
  );
}


const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  kycDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  roleBadge: { paddingVertical: 4 },
});

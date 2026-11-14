import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAdminUsers } from '@/src/queries/admin';
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
  const usersQuery = useAdminUsers();
  const users: UserProfile[] = usersQuery.data ?? [];
  const loading = usersQuery.isPending;
  const loadError = usersQuery.isError;
  const load = () => void usersQuery.refetch();
  useRefetchOnFocus(usersQuery.refetch);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');

  const filtered = users.filter((u) => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    const nameMatch = u.name ? u.name.toLowerCase().includes(query.trim().toLowerCase()) : false;
    const phoneMatch = u.phone_number.includes(query.trim());
    if (query.trim() && !nameMatch && !phoneMatch) {
      return false;
    }
    return true;
  });

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Users</Text>
        <Text numberOfLines={1} style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'], minHeight: 22 }]}>
          {loading ? ' ' : `${users.length} ${users.length === 1 ? 'person' : 'people'} on the platform`}
        </Text>
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
      </ScrollView>
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

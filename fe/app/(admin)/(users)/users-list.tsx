import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlass, CaretLeft } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listUsers } from '@/src/api/admin';
import type { UserProfile } from '@/src/api/profile';

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
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');

  useEffect(() => {
    listUsers()
      .then(res => setUsers(res.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: space.sm })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Users</Text>
        </View>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm, marginTop: space.md },
          ]}
        >
          <MagnifyingGlass size={18} color={color('text/tertiary')} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or phone number"
            placeholderTextColor={color('text/tertiary')}
            style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm }]}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, marginTop: space.md }}
      >
        {FILTERS.map((f) => {
          const active = roleFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setRoleFilter(f.key)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  paddingHorizontal: space.md,
                  backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                  borderWidth: 1,
                  borderColor: active ? color('accent/default') : color('border/subtle'),
                },
              ]}
            >
              <Text
                style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
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
                onPress={() => router.push({ pathname: '/(admin)/(users)/user-detail', params: { id: u.id } })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
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
    </SafeAreaView>
  );
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
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

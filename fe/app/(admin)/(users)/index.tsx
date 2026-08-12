import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlass } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Role = 'Student' | 'Teacher' | 'Admin';
type KycState = 'pending' | 'verified' | 'action_needed' | null;
type UserRow = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  kyc: KycState;
};

const USERS: UserRow[] = [
  { id: 'u1', name: 'Aarav Sharma', phone: '+91 98XXXXXX10', role: 'Student', kyc: 'pending' },
  { id: 'u2', name: 'Priya Nair', phone: '+91 97XXXXXX22', role: 'Student', kyc: 'verified' },
  { id: 'u3', name: 'Rohan Mehta', phone: '+91 99XXXXXX41', role: 'Student', kyc: null },
  { id: 'u4', name: 'Kavya Iyer', phone: '+91 96XXXXXX78', role: 'Teacher', kyc: null },
  { id: 'u5', name: 'Devika Rao', phone: '+91 95XXXXXX63', role: 'Teacher', kyc: null },
  { id: 'u6', name: 'Sanjay Gupta', phone: '+91 99XXXXXX99', role: 'Admin', kyc: null },
  { id: 'u7', name: 'Meera Pillai', phone: '+91 90XXXXXX15', role: 'Student', kyc: 'action_needed' },
];

const FILTERS: { key: 'All' | Role; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Student', label: 'Students' },
  { key: 'Teacher', label: 'Teachers' },
  { key: 'Admin', label: 'Admins' },
];

const KYC_DOT_COLOR: Record<Exclude<KycState, null>, 'semantic/warning' | 'semantic/success' | 'semantic/danger'> = {
  pending: 'semantic/warning',
  verified: 'semantic/success',
  action_needed: 'semantic/danger',
};

export default function UserManagementListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const filtered = USERS.filter((u) => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (query.trim() && !u.name.toLowerCase().includes(query.trim().toLowerCase()) && !u.phone.includes(query.trim())) {
      return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Users</Text>
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
            const initials = u.name.split(' ').map((p) => p[0]).join('').slice(0, 2);
            const isAdmin = u.role === 'Admin';
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
                  {u.kyc ? (
                    <View
                      style={[
                        styles.kycDot,
                        { backgroundColor: color(KYC_DOT_COLOR[u.kyc]), borderColor: color('bg/surface') },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{u.name}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {u.phone}
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
                    style={[type['type/caption'], { color: isAdmin ? color('accent/default') : color('text/secondary') }]}
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

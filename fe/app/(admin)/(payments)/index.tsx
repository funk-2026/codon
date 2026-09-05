import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlass, Tag, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listPayments } from '@/src/api/admin';
import type { UserProfile } from '@/src/api/profile';

type Status = 'created' | 'captured' | 'failed' | 'refunded';
type StatusFilter = 'All' | 'created' | 'captured' | 'failed' | 'refunded';

type PaymentRecord = {
  id: string;
  user_id: string;
  user?: UserProfile;
  subscription?: { plan?: { name: string } };
  amount_paise: number;
  status: Status;
  created_at: string;
};

const FILTERS: StatusFilter[] = ['All', 'captured', 'created', 'failed', 'refunded'];

const STATUS_TOKEN: Record<Status, 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning'> = {
  captured: 'semantic/success',
  created: 'text/tertiary',
  failed: 'semantic/danger',
  refunded: 'semantic/warning',
};

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function PaymentRecordsListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    listPayments()
      .then(res => {
        setPayments(res.payments || []);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = payments.filter((p) => {
    if (filter !== 'All' && p.status !== filter) return false;
    const userName = p.user?.name?.toLowerCase() || '';
    if (query.trim() && !userName.includes(query.trim().toLowerCase())) return false;
    return true;
  });

  // Basic totals
  const totalCaptured = payments.filter(p => p.status === 'captured').reduce((acc, p) => acc + (p.amount_paise / 100), 0);
  const totalAmount = `₹${totalCaptured.toLocaleString('en-IN')}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <View style={styles.headerRow}>
          <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Payments</Text>
          <Pressable
            onPress={() => router.push('/(admin)/(payments)/subscription-plan-list')}
            hitSlop={space.xs}
            style={({ pressed }) => [styles.plansLink, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Tag size={18} color={color('accent/default')} />
            <Text style={[type['type/body-m-medium'], { color: color('accent/default'), marginLeft: 4 }]}>
              Plans
            </Text>
          </Pressable>
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
            placeholder="Search by name, phone, or order ID"
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
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
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
              <Text style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
          <SkeletonBlock height={56} radius={radius.md} />
        </View>
      ) : (
        <View
          style={[
            styles.summaryStrip,
            { backgroundColor: color('bg/surface'), borderRadius: radius.md, marginHorizontal: space.md, marginTop: space.md, padding: space.sm },
            shadow(),
          ]}
        >
          <SummaryStat label="Captured" value={totalAmount} />
          <View style={[styles.divider, { backgroundColor: color('border/subtle') }]} />
          <SummaryStat label="All Time" value={totalAmount} />
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} height={76} radius={radius.md} />)
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load payments"
            description="Something went wrong fetching payment records."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            No payments match &apos;{query}&apos;.
          </Text>
        ) : (
          filtered.map((p) => {
            const userName = p.user?.name || 'Unknown User';
            const planName = p.subscription?.plan?.name || 'Unknown Plan';
            const displayAmount = `₹${(p.amount_paise / 100).toLocaleString('en-IN')}`;
            const displayDate = new Date(p.created_at).toLocaleDateString();

            return (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: '/(admin)/(payments)/payment-detail', params: { id: p.id } })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{userName}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {planName} · {displayAmount}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        borderColor: color(STATUS_TOKEN[p.status] || 'text/tertiary'),
                        borderRadius: radius.pill,
                        paddingHorizontal: space.xs,
                      },
                    ]}
                  >
                    <Text style={[type['type/caption'], { color: color(STATUS_TOKEN[p.status] || 'text/tertiary'), textTransform: 'capitalize' }]}>{p.status}</Text>
                  </View>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 4 }]}>{displayDate}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 20 }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  plansLink: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderWidth: 1, paddingVertical: 2 },
});

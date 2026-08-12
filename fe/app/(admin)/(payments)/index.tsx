import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlass } from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Status = 'Captured' | 'Created' | 'Failed' | 'Refunded';
type StatusFilter = 'All' | 'Captured' | 'Failed' | 'Refunded';
type Payment = {
  id: string;
  user: string;
  plan: string;
  amount: number;
  status: Status;
  date: string;
};

const PAYMENTS: Payment[] = [
  { id: 'p1', user: 'Aarav Sharma', plan: '3 Months', amount: 2999, status: 'Captured', date: '18 Jul, 10:24 AM' },
  { id: 'p2', user: 'Priya Nair', plan: '12 Months', amount: 8999, status: 'Captured', date: '18 Jul, 9:02 AM' },
  { id: 'p3', user: 'Rohan Mehta', plan: '3 Months', amount: 2999, status: 'Failed', date: '17 Jul, 8:44 PM' },
  { id: 'p4', user: 'Meera Pillai', plan: '3 Months', amount: 2999, status: 'Refunded', date: '15 Jul, 2:10 PM' },
  { id: 'p5', user: 'Arjun Das', plan: '12 Months', amount: 8999, status: 'Created', date: '18 Jul, 11:01 AM' },
];

const FILTERS: StatusFilter[] = ['All', 'Captured', 'Failed', 'Refunded'];

const STATUS_TOKEN: Record<Status, 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning'> = {
  Captured: 'semantic/success',
  Created: 'text/tertiary',
  Failed: 'semantic/danger',
  Refunded: 'semantic/warning',
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const filtered = PAYMENTS.filter((p) => {
    if (filter !== 'All' && p.status !== filter) return false;
    if (query.trim() && !p.user.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Payments</Text>
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
          <SummaryStat label="Today" value="₹5,998" />
          <View style={[styles.divider, { backgroundColor: color('border/subtle') }]} />
          <SummaryStat label="This Week" value="₹42,986" />
          <View style={[styles.divider, { backgroundColor: color('border/subtle') }]} />
          <SummaryStat label="This Month" value="₹1,68,940" />
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} height={76} radius={radius.md} />)
        ) : filtered.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
            No payments match &apos;{query}&apos;.
          </Text>
        ) : (
          filtered.map((p) => (
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
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{p.user}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {p.plan} · ₹{p.amount.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      borderColor: color(STATUS_TOKEN[p.status]),
                      borderRadius: radius.pill,
                      paddingHorizontal: space.xs,
                    },
                  ]}
                >
                  <Text style={[type['type/caption'], { color: color(STATUS_TOKEN[p.status]) }]}>{p.status}</Text>
                </View>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 4 }]}>{p.date}</Text>
              </View>
            </Pressable>
          ))
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
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1 },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderWidth: 1, paddingVertical: 2 },
});

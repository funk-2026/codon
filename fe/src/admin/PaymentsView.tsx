import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAdminPayments } from '@/src/queries/admin';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type Status = 'created' | 'captured' | 'failed' | 'refunded';
type Filter = 'all' | Status;
type PaymentRecord = {
  id: string;
  user?: { name?: string | null; phone_number?: string | null };
  subscription?: { plan?: { name: string } };
  razorpay_order_id?: string;
  amount_paise: number;
  status: Status;
  created_at: string;
};

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'captured', label: 'Captured' },
  { key: 'created', label: 'Created' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];
const TOKEN: Record<Status, 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning'> = {
  captured: 'semantic/success',
  created: 'text/tertiary',
  failed: 'semantic/danger',
  refunded: 'semantic/warning',
};
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/** Money in. Search by name, phone or order id; the summary counts only payments that actually went through. */
export function PaymentsView() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const query = useAdminPayments();
  useRefetchOnFocus(() => query.refetch());
  const payments = useMemo<PaymentRecord[]>(() => query.data ?? [], [query.data]);

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const captured = payments.filter((p) => p.status === 'captured');
  const capturedPaise = captured.reduce((n, p) => n + p.amount_paise, 0);
  const needle = q.trim().toLowerCase();
  const shown = payments.filter(
    (p) =>
      (filter === 'all' || p.status === filter) &&
      (!needle || [p.user?.name, p.user?.phone_number, p.razorpay_order_id].some((v) => (v ?? '').toLowerCase().includes(needle))),
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <TreeToolbar query={q} onQuery={setQ} placeholder="Search by name, phone or order ID" chips={{ options: CHIPS, value: filter, onChange: (k) => setFilter(k as Filter) }} />
      </View>

      {query.isPending ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.md, gap: space.xs }}>
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={64} radius={radius.md} />
          <SkeletonBlock height={64} radius={radius.md} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space['3xl'], gap: space.xs }} showsVerticalScrollIndicator={false}>
          {query.isError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load payments"
              description="Something went wrong fetching payment records."
              action={<TextButton label="Retry" onPress={() => void query.refetch()} />}
            />
          ) : (
            <>
              <View style={[{ flexDirection: 'row', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }, shadow()]}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 20 }]}>{rupees(capturedPaise)}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>Captured</Text>
                </View>
                <View style={{ width: 1, backgroundColor: color('border/subtle') }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 20 }]}>{captured.length}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>Successful payments</Text>
                </View>
              </View>
              {shown.length === 0 ? (
                <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>
                  {payments.length === 0 ? 'No payments yet.' : 'No payments match.'}
                </Text>
              ) : (
                shown.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push({ pathname: ROUTES.admin.paymentDetail, params: { id: p.id } })}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 },
                      shadow(),
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{p.user?.name || 'Unknown user'}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
                        {p.subscription?.plan?.name || 'Unknown plan'} · {rupees(p.amount_paise)} · {new Date(p.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[type['type/caption'], { color: color(TOKEN[p.status] ?? 'text/tertiary'), textTransform: 'capitalize', marginRight: space.xs }]}>{p.status}</Text>
                    <CaretRight size={16} color={color('text/tertiary')} />
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretRight, Receipt, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { apiFetch } from '@/src/api/client';
import { useCursorList } from '@/src/queries/useCursorList';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type Payment = {
  id: string;
  order_id: string;
  payment_id?: string | null;
  amount_paise: number;
  currency: string;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  plan_name: string;
  created_at: string;
  refunded_at?: string | null;
};

const STATUS: Record<Payment['status'], { label: string; token: 'semantic/success' | 'text/tertiary' | 'semantic/danger' | 'semantic/warning' }> = {
  captured: { label: 'Paid', token: 'semantic/success' },
  created: { label: 'Not completed', token: 'text/tertiary' },
  failed: { label: 'Failed', token: 'semantic/danger' },
  refunded: { label: 'Refunded', token: 'semantic/warning' },
};
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const when = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** What the student has paid, newest first, each with a shareable receipt. */
export default function PaymentsRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [picked, setPicked] = useState<Payment | null>(null);
  const list = useCursorList<Payment, { payments: Payment[]; next_cursor: string | null }>(
    ['me', 'payments'],
    (cursor) => apiFetch<{ payments: Payment[]; next_cursor: string | null }>(`/me/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`).then((r) => ({ payments: r.payments ?? [], next_cursor: r.next_cursor ?? null })),
    (r) => r.payments,
  );
  useRefetchOnFocus(list.load);

  const receiptText = (p: Payment) =>
    [
      'Codon payment receipt',
      `Plan: ${p.plan_name || '—'}`,
      `Amount: ${rupees(p.amount_paise)}`,
      `Status: ${STATUS[p.status].label}`,
      `Date: ${when(p.created_at)}`,
      `Order ID: ${p.order_id}`,
      p.payment_id ? `Payment ID: ${p.payment_id}` : null,
      'This is a payment receipt, not a tax invoice.',
    ].filter(Boolean).join('\n');

  return (
    <Screen>
      <ScreenHeader title="Payments" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xs, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {list.loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={64} radius={radius.md} />)
        ) : list.error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load your payments"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={list.load} />}
          />
        ) : list.rows.length === 0 ? (
          <EmptyState icon={<Receipt size={32} color={color('text/tertiary')} />} title="No payments yet" description="When you buy a plan, the receipt will be here." />
        ) : (
          <>
            {list.rows.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPicked(p)}
                accessibilityRole="button"
                accessibilityLabel={`${p.plan_name || 'Payment'}, ${rupees(p.amount_paise)}, ${STATUS[p.status].label}`}
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{p.plan_name || 'Payment'}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{when(p.created_at)} · {rupees(p.amount_paise)}</Text>
                </View>
                <Text style={[type['type/caption'], { color: color(STATUS[p.status].token), marginRight: space.xs }]}>{STATUS[p.status].label}</Text>
                <CaretRight size={16} color={color('text/tertiary')} />
              </Pressable>
            ))}
            {list.hasMore ? <SecondaryButton label={list.more ? 'Loading…' : 'Load more'} onPress={() => void list.loadMore()} loading={list.more} /> : null}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!picked} onClose={() => setPicked(null)} title="Receipt">
        {picked ? (
          <View style={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>
            {[
              ['Plan', picked.plan_name || '—'],
              ['Amount', rupees(picked.amount_paise)],
              ['Status', STATUS[picked.status].label],
              ['Date', when(picked.created_at)],
              ['Order ID', picked.order_id],
              ...(picked.payment_id ? [['Payment ID', picked.payment_id]] : []),
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{k}</Text>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flexShrink: 1, textAlign: 'right' }]} selectable>{v}</Text>
              </View>
            ))}
            <PrimaryButton label="Share receipt" onPress={() => void Share.share({ message: receiptText(picked) })} />
            <TextButton
              label="Something wrong with this payment?"
              onPress={() => {
                const id = picked.order_id;
                setPicked(null);
                router.push({ pathname: ROUTES.student.help, params: { order: id } });
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

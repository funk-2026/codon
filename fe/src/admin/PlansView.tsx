import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListSubscriptionPlans, updateSubscriptionPlan } from '@/src/api/admin';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useQuery, useQueryClient } from '@tanstack/react-query';


export function PlansView() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const [tab, setTab] = useState<'Active' | 'Inactive'>('Active');

  const queryClient = useQueryClient();
  const loadQuery = useQuery({ queryKey: ['admin','plans'], queryFn: () =>
      adminListSubscriptionPlans().then((res) => {
        return res.plans || [];
      }) });
  const plans = loadQuery.data ?? [];
  const loading = loadQuery.isPending;
  const loadError = loadQuery.isError;
  const load = () => void loadQuery.refetch();
  const setPlans = (u: typeof plans | ((p: typeof plans) => typeof plans)) =>
    queryClient.setQueryData(['admin','plans'], (old: typeof plans | undefined) => (typeof u === 'function' ? u(old ?? []) : u));

  const filtered = plans.filter((p) => (tab === 'Active' ? p.is_active : !p.is_active));

  const toggleActive = (id: string, currentActive: boolean) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: !currentActive } : p))
    );
    updateSubscriptionPlan(id, { is_active: !currentActive })
      .then(() => {
        show(!currentActive ? 'Plan activated' : 'Plan deactivated', 'success');
      })
      .catch(() => {
        // revert on failure
        setPlans((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_active: currentActive } : p))
        );
        show('Failed to update plan', 'error');
      });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {(['Active', 'Inactive'] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
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
                {t}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push(ROUTES.admin.subscriptionPlanEdit)}
          accessibilityRole="button"
          accessibilityLabel="New plan"
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space['2xs'], backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'), borderRadius: radius.pill, paddingHorizontal: space.sm, minHeight: 36 }]}
        >
          <Plus size={18} color={color('action/on-primary')} weight="bold" />
          <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>New plan</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} height={92} radius={radius.md} />)
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load plans"
            description="Something went wrong fetching subscription plans."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No plans yet" description="Tap + to create your first one." />
        ) : (
          filtered.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: ROUTES.admin.subscriptionPlanEdit, params: { id: p.id } })}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: color('bg/surface'),
                  borderRadius: radius.md,
                  padding: space.md,
                  opacity: p.is_active ? (pressed ? 0.94 : 1) : 0.7,
                },
                shadow(),
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{p.name}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {p.duration_days} Days · ₹{(p.price_paise / 100).toLocaleString('en-IN')}
                </Text>
              </View>
              <Switch
                value={p.is_active}
                onValueChange={() => toggleActive(p.id, p.is_active)}
                trackColor={{ false: color('border/strong'), true: color('accent/default') }}
                thumbColor={color('bg/surface')}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

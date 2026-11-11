import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, useToast, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListSubscriptionPlans, updateSubscriptionPlan } from '@/src/api/admin';
import type { SubscriptionPlan } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useQuery, useQueryClient } from '@tanstack/react-query';


export default function SubscriptionPlanListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const [tab, setTab] = useState<'Active' | 'Inactive'>('Active');

  const queryClient = useQueryClient();
  const loadQuery = useQuery({ queryKey: ['app-admin-subscription-plan-list-tsx'], queryFn: () =>
      adminListSubscriptionPlans().then((res) => {
        return res.plans || [];
      }) });
  const plans = loadQuery.data ?? [];
  const loading = loadQuery.isPending;
  const loadError = loadQuery.isError;
  const load = () => void loadQuery.refetch();
  const setPlans = (u: typeof plans | ((p: typeof plans) => typeof plans)) =>
    queryClient.setQueryData(['app-admin-subscription-plan-list-tsx'], (old: typeof plans | undefined) => (typeof u === 'function' ? u(old ?? []) : u));

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
    <Screen>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Subscription Plans</Text>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.md, flexDirection: 'row', gap: space.xs }}>
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
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'], gap: space.sm }}
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
                <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                  — active subscribers
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

      <Pressable
        onPress={() => router.push(ROUTES.admin.subscriptionPlanEdit)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'),
            borderRadius: 28,
            right: space.lg,
            bottom: space.lg,
          },
          shadow(),
        ]}
      >
        <Plus size={24} color={color('accent/on-accent')} weight="bold" />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

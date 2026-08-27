import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, CaretLeft } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListSubscriptionPlans, updateSubscriptionPlan } from '@/src/api/admin';
import type { SubscriptionPlan } from '@/src/api/profile';

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function SubscriptionPlanListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tab, setTab] = useState<'Active' | 'Inactive'>('Active');

  useEffect(() => {
    adminListSubscriptionPlans()
      .then(res => setPlans(res.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: space.sm })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Subscription Plans</Text>
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
        ) : filtered.length === 0 ? (
          <EmptyState title="No plans yet" description="Tap + to create your first one." />
        ) : (
          filtered.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/(admin)/(payments)/subscription-plan-edit', params: { id: p.id } })}
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
        onPress={() => router.push('/(admin)/(payments)/subscription-plan-edit')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? color('accent/pressed') : color('accent/default'),
            borderRadius: 28,
            right: space.lg,
            bottom: space.lg,
          },
          shadow(),
        ]}
      >
        <Plus size={24} color={color('accent/on-accent')} weight="bold" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
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

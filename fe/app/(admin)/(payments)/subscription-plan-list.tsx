import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Plan = {
  id: string;
  name: string;
  course: string;
  duration: string;
  price: number;
  subscribers: number;
  active: boolean;
};

const INITIAL: Plan[] = [
  { id: 'p3', name: '3 Months', course: 'NEET UG', duration: '3 Months', price: 2999, subscribers: 214, active: true },
  { id: 'p12', name: '12 Months', course: 'NEET UG', duration: '12 Months', price: 8999, subscribers: 128, active: true },
  { id: 'p1', name: '1 Month — Trial', course: 'NEET UG', duration: '1 Month', price: 999, subscribers: 12, active: false },
];

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
  const [plans, setPlans] = useState<Plan[]>(INITIAL);
  const [tab, setTab] = useState<'Active' | 'Inactive'>('Active');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const filtered = plans.filter((p) => (tab === 'Active' ? p.active : !p.active));

  const toggleActive = (id: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
    const plan = plans.find((p) => p.id === id);
    show(plan?.active ? 'Plan deactivated' : 'Plan activated', 'success');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
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
                  opacity: p.active ? (pressed ? 0.94 : 1) : 0.7,
                },
                shadow(),
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{p.name}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {p.course} · {p.duration} · ₹{p.price.toLocaleString('en-IN')}
                </Text>
                <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                  {p.subscribers} active subscribers
                </Text>
              </View>
              <Switch
                value={p.active}
                onValueChange={() => toggleActive(p.id)}
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

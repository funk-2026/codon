import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CaretLeft, CheckCircle, Shield } from 'phosphor-react-native';
import { PrimaryButton, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  benefits: string[];
  current?: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'p3',
    name: '3 Months',
    price: 2999,
    durationMonths: 3,
    durationLabel: '3 months',
    benefits: ['Full Test Series access', 'Complete Q Bank', 'All Video Classes', 'Priority doubt support'],
  },
  {
    id: 'p12',
    name: '12 Months',
    price: 8999,
    durationMonths: 12,
    durationLabel: '12 months',
    benefits: [
      'Full Test Series access',
      'Complete Q Bank',
      'All Video Classes',
      'Priority doubt support',
      '2 months free vs. quarterly',
    ],
  },
];

const KYC_REQUIRED = true;

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
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

export default function SubscriptionPlansRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const bestValueId = PLANS.reduce((best, p) => {
    const costPerDay = p.price / (p.durationMonths * 30);
    const bestCostPerDay = best.price / (best.durationMonths * 30);
    return costPerDay < bestCostPerDay ? p : best;
  }, PLANS[0]).id;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Choose Your Plan
        </Text>
      </View>
      <Text
        style={[
          type['type/body-m'],
          { color: color('text/secondary'), paddingHorizontal: space.md, marginTop: space['2xs'] },
        ]}
      >
        Full access to NEET UG Test Series, Q Bank, and Video Classes.
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.xl, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: space.md }}>
            <SkeletonBlock height={220} radius={radius.lg} />
            <SkeletonBlock height={220} radius={radius.lg} />
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            {PLANS.map((p, i) => {
              const bestValue = p.id === bestValueId;
              return (
                <Stagger key={p.id} delayMs={i * 80}>
                  <View
                    style={[
                      { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg },
                      shadow(),
                    ]}
                  >
                    {bestValue ? (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: color('accent/default'), borderRadius: radius.pill, paddingHorizontal: space.sm, marginBottom: space.xs },
                        ]}
                      >
                        <Text style={[type['type/overline'], { color: color('accent/on-accent') }]}>
                          BEST VALUE
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.priceRow}>
                      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{p.name}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 28 }]}>
                          ₹{p.price.toLocaleString('en-IN')}
                        </Text>
                        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                          / {p.durationLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: space.md, gap: space.xs }}>
                      {p.benefits.map((b) => (
                        <View key={b} style={styles.benefitRow}>
                          <CheckCircle size={16} color={color('semantic/success')} weight="fill" />
                          <Text style={[type['type/body-m'], { color: color('text/primary'), marginLeft: space.xs }]}>
                            {b}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {p.current ? (
                      <View
                        style={[
                          styles.currentTag,
                          { borderRadius: radius.pill, borderColor: color('border/strong'), marginTop: space.md, paddingVertical: space.sm },
                        ]}
                      >
                        <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>
                          Current Plan
                        </Text>
                      </View>
                    ) : (
                      <PrimaryButton
                        label="Choose Plan"
                        onPress={() =>
                          router.push({ pathname: '/(student)/(profile)/checkout', params: { planId: p.id } })
                        }
                        style={{ marginTop: space.md }}
                      />
                    )}
                  </View>
                </Stagger>
              );
            })}
          </View>
        )}

        {KYC_REQUIRED ? (
          <View
            style={[
              styles.kycNote,
              { backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <Shield size={20} color={color('accent/default')} />
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
              Identity verification is required for paid access. You can complete this after checkout.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: { alignSelf: 'flex-start', paddingVertical: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  currentTag: { borderWidth: 1.5, alignItems: 'center' },
  kycNote: { flexDirection: 'row', alignItems: 'center' },
});

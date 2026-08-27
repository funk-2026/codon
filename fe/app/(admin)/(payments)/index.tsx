import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Receipt, Tag } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

export default function PaymentsMenuRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - space.md * 2 - space.sm) / 2;

  const cards = [
    { key: 'payments', label: 'Payments', icon: <Receipt size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(payments)/payments-list' },
    { key: 'plans', label: 'Subscription Plans', icon: <Tag size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(payments)/subscription-plan-list' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={{ marginTop: space.lg }}>
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>Payments</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
              Manage transactions and plans.
            </Text>
          </View>
        </Stagger>

        <View style={{ marginTop: space.xl }}>
          <View style={[styles.grid2, { gap: space.sm }]}>
            {cards.map((c, i) => (
              <Stagger key={c.key} delayMs={80 + i * 40}>
                <Pressable
                  onPress={() => router.push(c.href as Href)}
                  style={({ pressed }) => [
                    styles.card,
                    { width: tileWidth, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.92 : 1 },
                    shadow(),
                  ]}
                >
                  {c.icon}
                  <Text style={[type['type/h3'], { color: color('text/primary'), marginTop: space.xs, fontSize: 15 }]}>
                    {c.label}
                  </Text>
                </Pressable>
              </Stagger>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { minHeight: 100, position: 'relative' },
});

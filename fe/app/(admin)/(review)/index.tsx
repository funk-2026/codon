import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Shield, ClipboardText, PlayCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getAdminDashboardSummary } from '@/src/api/admin';

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

export default function ReviewMenuRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - space.md * 2 - space.sm) / 2;
  const [summary, setSummary] = useState({
    pending_kyc: 0,
    pending_test_reviews: 0,
    pending_content_reviews: 0,
  });

  useEffect(() => {
    getAdminDashboardSummary()
      .then(res => {
        setSummary({
          pending_kyc: res.pending_kyc || 0,
          pending_test_reviews: res.pending_test_reviews || 0,
          pending_content_reviews: res.pending_content_reviews || 0,
        });
      })
      .catch(() => { });
  }, []);

  const cards = [
    { key: 'kyc', label: 'KYC Review', icon: <Shield size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/kyc-queue', badge: summary.pending_kyc },
    { key: 'tests', label: 'Test Approvals', icon: <ClipboardText size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/moderation-tests', badge: summary.pending_test_reviews > 0 ? summary.pending_test_reviews : undefined },
    { key: 'content', label: 'Content Approvals', icon: <PlayCircle size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/moderation-videos-docs', badge: summary.pending_content_reviews > 0 ? summary.pending_content_reviews : undefined },
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
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>Review</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
              Manage approvals and moderation.
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
                  {c.badge && c.badge > 0 ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: color('semantic/warning'), borderRadius: radius.pill },
                      ]}
                    >
                      <Text style={[type['type/caption'], { color: color('text/primary') }]}>
                        {c.badge}
                      </Text>
                    </View>
                  ) : null}
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
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});

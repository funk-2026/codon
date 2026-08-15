import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  Users,
  Shield,
  ClipboardText,
  PlayCircle,
  TreeStructure,
  Receipt,
  Tag,
  GearSix,
  ChartBar,
} from 'phosphor-react-native';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAdminDashboardSummary } from '@/src/api/admin';



type Card = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: Href;
  badge?: number;
};

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

export default function AdminHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - space.md * 2 - space.sm) / 2;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_users: 1248,
    active_subscriptions: 342,
    pending_kyc: 4,
    pending_reviews: 6,
  });

  useEffect(() => {
    getAdminDashboardSummary()
      .then(res => {
         setSummary({
            total_users: res.total_users || 0,
            active_subscriptions: res.active_subscriptions || 0,
            pending_kyc: res.pending_kyc || 0,
            pending_reviews: res.pending_reviews || 0,
         });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards: Card[] = [
    { key: 'users', label: 'Users', icon: <Users size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(users)' },
    { key: 'kyc', label: 'KYC Review', icon: <Shield size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)', badge: summary.pending_kyc },
    { key: 'tests', label: 'Test Approvals', icon: <ClipboardText size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/moderation-tests', badge: summary.pending_reviews > 0 ? summary.pending_reviews : undefined },
    { key: 'content', label: 'Content Approvals', icon: <PlayCircle size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/moderation-videos-docs' },
    { key: 'structure', label: 'Course Structure', icon: <TreeStructure size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(review)/course-structure-approval' },
    { key: 'payments', label: 'Payments', icon: <Receipt size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(payments)' },
    { key: 'plans', label: 'Subscription Plans', icon: <Tag size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(payments)/subscription-plan-list' },
    { key: 'settings', label: 'Platform Settings', icon: <GearSix size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(home)/platform-settings' },
    { key: 'analytics', label: 'Analytics', icon: <ChartBar size={26} color={color('accent/default')} weight="duotone" />, href: '/(admin)/(home)/analytics-overview' },
  ];

  const totalNeedsReview = summary.pending_kyc + summary.pending_reviews;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={{ marginTop: space.lg }}>
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>Admin</Text>
            {totalNeedsReview > 0 ? (
              <Text
                style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}
              >
                {totalNeedsReview} items across the platform need review
              </Text>
            ) : null}
          </View>
        </Stagger>

        <Stagger delayMs={80}>
          <View style={[styles.grid2, { gap: space.sm, marginTop: space.xl }]}>
            {loading ? (
              <>
                <SkeletonBlock height={76} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={76} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={76} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={76} radius={radius.md} style={{ width: tileWidth }} />
              </>
            ) : (
              <>
                <SummaryTile label="Total Users" value={String(summary.total_users)} width={tileWidth} />
                <SummaryTile label="Active Subscriptions" value={String(summary.active_subscriptions)} width={tileWidth} />
                <SummaryTile label="Pending KYC" value={String(summary.pending_kyc)} warn={summary.pending_kyc > 0} width={tileWidth} />
                <SummaryTile label="Pending Reviews" value={String(summary.pending_reviews)} warn={summary.pending_reviews > 0} width={tileWidth} />
              </>
            )}
          </View>
        </Stagger>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            MANAGE
          </Text>
          <View style={[styles.grid2, { gap: space.sm }]}>
            {cards.map((c, i) => (
              <Stagger key={c.key} delayMs={160 + i * 40}>
                <Pressable
                  onPress={() => router.push(c.href)}
                  style={({ pressed }) => [
                    styles.card,
                    { width: tileWidth, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.92 : 1 },
                    shadow(),
                  ]}
                >
                  {c.icon}
                  <Text
                    style={[type['type/h3'], { color: color('text/primary'), marginTop: space.xs, fontSize: 15 }]}
                  >
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

function SummaryTile({ label, value, warn, width }: { label: string; value: string; warn?: boolean; width: number }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={[
        { width, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm },
      ]}
    >
      <Text
        style={[
          type['type/numeral-display'],
          { color: warn ? color('semantic/warning') : color('text/primary'), fontSize: 24 },
        ]}
      >
        {value}
      </Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
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

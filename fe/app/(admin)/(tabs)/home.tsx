import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  TreeStructure,
  FolderOpen,
  GearSix,
  ChartBar,
  Tag,
  HandHeart,
} from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAdminSummary } from '@/src/queries/admin';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';



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


export default function AdminHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - space.md * 2 - space.sm) / 2;
  const summaryQuery = useAdminSummary();
  const loading = summaryQuery.isPending;
  const loadError = summaryQuery.isError;
  const loadSummary = () => void summaryQuery.refetch();
  useRefetchOnFocus(summaryQuery.refetch);
  const summary = {
    total_users: summaryQuery.data?.total_users ?? 0,
    active_subscriptions: summaryQuery.data?.active_subscriptions ?? 0,
    pending_kyc: summaryQuery.data?.pending_kyc ?? 0,
    pending_test_reviews: summaryQuery.data?.pending_test_reviews ?? 0,
    pending_content_reviews: summaryQuery.data?.pending_content_reviews ?? 0,
  };

  const pendingReviews = summary.pending_test_reviews + summary.pending_content_reviews;

  const cards: Card[] = [
    { key: 'structure', label: 'Manage Subjects', icon: <TreeStructure size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.manageSubjects },
    { key: 'course-structure', label: 'Course Structure', icon: <FolderOpen size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.courseStructure },
    { key: 'settings', label: 'Platform Settings', icon: <GearSix size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.platformSettings },
    { key: 'custom-test', label: 'Custom Tests & Pool', icon: <GearSix size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.customTestAdmin },
    { key: 'taxonomy', label: 'Tags & Topics', icon: <Tag size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.taxonomy },
    { key: 'wellness', label: 'Wellness articles', icon: <HandHeart size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.wellness },
    { key: 'analytics', label: 'Analytics', icon: <ChartBar size={26} color={color('accent/default')} weight="duotone" />, href: ROUTES.admin.analyticsOverview },
  ];

  const totalNeedsReview = summary.pending_kyc + pendingReviews;

  return (
    <Screen edges={TAB_EDGES}>
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

        {loadError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={loadSummary} />
          </View>
        ) : null}

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
                <SummaryTile label="Pending Reviews" value={String(pendingReviews)} warn={pendingReviews > 0} width={tileWidth} />
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
    </Screen>
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

import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Flame,
  Exam,
  BookOpen,
  HandHeart,
  Sliders,
  Cards,
} from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { CollapsingHeader, ErrorBanner, useCollapsingHeader } from '@/src/components';
import { useMe } from '@/src/queries/profile';
import { useProgress, useProgressBreakdown } from '@/src/queries/progress';
import { useRecentContent } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { DailyGoalCard } from '@/src/home/DailyGoalCard';
import { useFlag } from '@/src/config/AppConfigContext';
import { getModule } from '@/src/modules/registry';
import type { Subscription } from '@/src/api/profile';
import { BrainHacksShelf, HomeUpdatesCarousel } from '@/src/home/HomeShelves';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type SubState = 'active' | 'expiring' | 'none';

const QUICK_ACCESS: { label: string; href: Href; Icon: typeof Exam; wellness?: boolean; flag?: string }[] = [
  { label: getModule('qbank').label, href: { pathname: ROUTES.student.practiceHierarchy, params: { kind: 'qbank' } }, Icon: Exam },
  { label: getModule('test_series').label, href: { pathname: ROUTES.student.practiceHierarchy, params: { kind: 'test_series' } }, Icon: Exam },
  { label: getModule('custom').label, href: ROUTES.student.customBuilder, Icon: Sliders, flag: 'custom_test.enabled' },
  { label: 'Flashcards', href: ROUTES.student.flashcards, Icon: Cards },
  { label: 'Video Classes', href: ROUTES.student.learn, Icon: BookOpen },
  { label: 'Support', href: ROUTES.student.support, Icon: HandHeart, wellness: true },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Welcome back';
}

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

export default function HomeDashboardRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const header = useCollapsingHeader(76);

  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - space.md * 2;
  const bhCardWidth = Math.max(130, Math.min(200, (screenWidth - space.md * 2) / 2.6));

  const customOn = useFlag('custom_test.enabled');
  const me = useMe();
  const progress = useProgress();
  const breakdown = useProgressBreakdown();
  const recent = useRecentContent();
  const loadError = me.isError || progress.isError || breakdown.isError || recent.isError;
  const loadData = () => void Promise.all([me.refetch(), progress.refetch(), breakdown.refetch(), recent.refetch()]);
  useRefetchOnFocus(loadData);

  const recentItem = recent.data?.recent?.[0] ?? null;
  const streak = breakdown.data?.day_streak ?? 0;
  const isNewUser = !((progress.data?.attempted_count ?? 0) > 0);
  const stats = { attempted: progress.data?.attempted_count ?? 0, avgScore: progress.data?.avg_score ?? 0 };

  const { subState, subText } = useMemo((): { subState: SubState; subText: string } => {
    const sub = me.data?.active_subscription;
    if (!sub) return { subState: 'none', subText: '' };
    const end = new Date(sub.end_date);
    const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
    const planName = sub.plan?.name || 'Pro';
    return diffDays <= 7
      ? { subState: 'expiring', subText: `Your ${planName} plan expires in ${diffDays} days — renew to keep access.` }
      : { subState: 'active', subText: `${planName} — active until ${end.toLocaleDateString()}` };
  }, [me.data]);

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h2'], { color: color('header/text') }]}>
                  {greeting()}, {user?.name?.split(' ')[0] || 'Student'}
                </Text>
                <View
                  style={[
                    styles.streakRow,
                    {
                      gap: space['2xs'],
                      marginTop: space.xs,
                      alignSelf: 'flex-start',
                      backgroundColor: color('header/chip'),
                      borderRadius: radius.pill,
                      paddingHorizontal: space.sm,
                      paddingVertical: space['2xs'],
                    },
                  ]}
                >
                  <Flame size={16} color={color('highlight/default')} weight="fill" />
                  <Text style={[type['type/caption'], { color: color('header/text') }]}>
                    {streak} day streak
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push(ROUTES.student.profile)}
                hitSlop={space.xs}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <View
                  style={[
                    styles.avatar,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: color('bg/surface') },
                  ]}
                >
                  <Text style={[type['type/h3'], { color: color('accent/default') }]}>
                    {(user?.name || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            </View>
        }
        compact={
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
              <Text style={[type['type/h3'], { color: color('header/text') }]} numberOfLines={1}>
                {user?.name?.split(' ')[0] || 'Student'}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space['2xs'],
                  backgroundColor: color('header/chip'),
                  borderRadius: radius.pill,
                  paddingHorizontal: space.xs,
                  paddingVertical: 2,
                }}
              >
                <Flame size={14} color={color('highlight/default')} weight="fill" />
                <Text style={[type['type/caption'], { color: color('header/text') }]}>{streak}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push(ROUTES.student.profile)}
              hitSlop={space.xs}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <View style={[styles.avatar, { width: 32, height: 32, borderRadius: 16, backgroundColor: color('bg/surface') }]}>
                <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </>
        }
      />
      <Animated.FlatList
        data={[{}]}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingTop: header.maxHeight }}
        keyExtractor={() => 'root'}
        renderItem={() => (
          <View style={{ paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space['3xl'] }}>
            {loadError ? (
              <View style={{ marginTop: space.md }}>
                <ErrorBanner onRetry={loadData} />
              </View>
            ) : null}

            {/* Updates carousel — admin-curated; renders nothing when empty */}
            <HomeUpdatesCarousel />

            {/* Continue Learning */}
            {recentItem ? (
              <Stagger delayMs={160}>
                <View style={{ marginTop: space.xl }}>
                  <Text
                    style={[
                      type['type/overline'],
                      { color: color('text/tertiary'), marginBottom: space.xs },
                    ]}
                  >
                    CONTINUE LEARNING
                  </Text>
                  <View
                    style={[
                      styles.continueCard,
                      {
                        backgroundColor: color('bg/surface'),
                        borderRadius: radius.lg,
                        padding: space.md,
                      },
                      shadow(),
                    ]}
                  >
                    <View style={styles.cardRow}>
                      <View
                        style={[
                          styles.continueIcon,
                          { backgroundColor: color('accent/tint'), borderRadius: radius.md },
                        ]}
                      >
                        {recentItem.kind === 'video' ? (
                          <BookOpen size={28} color={color('accent/default')} weight="duotone" />
                        ) : (
                          <Exam size={28} color={color('accent/default')} weight="duotone" />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: space.md }}>
                        <Text
                          style={[type['type/h3'], { color: color('text/primary') }]}
                          numberOfLines={1}
                        >
                          Resume: {recentItem.title || 'Content'}
                        </Text>
                        <Text
                          style={[
                            type['type/caption'],
                            { color: color('text/secondary'), marginTop: 2 },
                          ]}
                        >
                          {recentItem.pct === 100 ? 'Completed' : `${recentItem.pct}% Completed`}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: color('bg/sunken'),
                        borderRadius: 2,
                        marginTop: space.sm,
                      }}
                    >
                      <View
                        style={{
                          width: `${recentItem.pct}%`,
                          height: 4,
                          backgroundColor: color('accent/default'),
                          borderRadius: 2,
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        if (recentItem.id) {
                          router.push({ pathname: ROUTES.student.videoPlayer, params: { id: recentItem.id } });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.resumeBtn,
                        {
                          backgroundColor: pressed
                            ? color('action/primary-pressed')
                            : color('action/primary'),
                          borderRadius: radius.pill,
                          marginTop: space.md,
                          opacity: 0.95,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          type['type/body-m-medium'],
                          { color: color('accent/on-accent') },
                        ]}
                      >
                        Continue Now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Stagger>
            ) : null}

            {/* Quick Access */}
            <Stagger delayMs={240}>
              <View style={{ marginTop: space.xl }}>
                <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>EXPLORE</Text>
                  <Pressable onPress={() => router.push(ROUTES.student.explore)} accessibilityRole="link" accessibilityLabel="Explore everything for your course">
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>Discover more →</Text>
                  </Pressable>
                </View>
                <View style={[styles.grid, { gap: space.sm }]}>
                  {QUICK_ACCESS.filter((q) => !q.flag || (q.flag === 'custom_test.enabled' && customOn)).map((q) => (
                    <Pressable
                      key={q.label}
                      onPress={() => router.push(q.href)}
                      style={({ pressed }) => [
                        styles.qaCard,
                        {
                          backgroundColor: color('bg/surface'),
                          borderRadius: radius.md,
                          padding: space.md,
                          opacity: pressed ? 0.92 : 1,
                        },
                        shadow(),
                      ]}
                    >
                      <q.Icon size={26} color={q.wellness ? color('wellness/accent') : color('accent/default')} weight="duotone" />
                      <Text
                        style={[
                          type['type/h3'],
                          { color: color('text/primary'), marginTop: space.xs },
                        ]}
                      >
                        {q.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Stagger>

            {/* Subscription strip */}
            <Stagger delayMs={320}>
              <View style={{ marginTop: space.xl }}>
                <SubscriptionStrip
                  state={subState}
                  text={subText}
                  onViewPlans={() =>
                    router.push(ROUTES.student.subscriptionPlans)
                  }
                />
              </View>
            </Stagger>

            {/* Progress snapshot */}
            <Stagger delayMs={400}>
              <View style={{ marginTop: space.xl }}>
                <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
                    YOUR PROGRESS
                  </Text>
                  <Pressable onPress={() => router.push(ROUTES.student.progressDetail)}>
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                      View all →
                    </Text>
                  </Pressable>
                </View>
                <DailyGoalCard />
                <View style={[styles.statRow, { gap: space.xs }]}>
                  <StatTile label="Tests Taken" value={isNewUser ? '0' : stats.attempted.toString()} />
                  <StatTile label="Avg. Score" value={isNewUser ? '—' : `${Math.round(stats.avgScore)}%`} />
                  <StatTile label="Day Streak" value={String(streak)} />
                </View>
              </View>
            </Stagger>

            {/* Brain Hacks shelf — real data, hidden when empty */}
            <BrainHacksShelf />
          </View>
        )}
      />
    </View>
  );
}


function SubscriptionStrip({
  state,
  text,
  onViewPlans,
}: {
  state: SubState;
  text?: string;
  onViewPlans: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  if (state === 'active') {
    return (
      <View
        style={[
          styles.strip,
          { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
        ]}
      >
        <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
          {text || 'Pro — active'}
        </Text>
        <Text style={[type['type/caption'], { color: color('semantic/success') }]}>Active</Text>
      </View>
    );
  }
  if (state === 'expiring') {
    return (
      <View
        style={[
          styles.strip,
          {
            backgroundColor: color('semantic/warning'),
            borderRadius: radius.md,
            padding: space.md,
          },
        ]}
      >
        <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
          {text || 'Your plan is expiring soon.'}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md },
      ]}
    >
      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
        You&apos;re on Free access. Unlock full Test Series and Video Classes.
      </Text>
      <Pressable onPress={onViewPlans}>
        <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
          View Plans
        </Text>
      </Pressable>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color('bg/surface'),
        borderRadius: radius.md,
        padding: space.sm,
      }}
    >
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 26 }]}>
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  continueCard: {},
  continueIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  qaCard: { width: '48%', minHeight: 96, justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  bhCard: { minHeight: 120 },
  bhIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  updateCard: { justifyContent: 'flex-end' },
});

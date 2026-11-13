import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Flame, Exam, BookOpen, Bell, Target, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { CollapsingHeader, ErrorBanner, useCollapsingHeader } from '@/src/components';
import { useMe } from '@/src/queries/profile';
import { useProgress, useProgressBreakdown } from '@/src/queries/progress';
import { useAttempts, useRecentContent } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { DailyGoalCard } from '@/src/home/DailyGoalCard';
import { BrainHackOfTheDay, HomeUpdatesCarousel } from '@/src/home/HomeShelves';
import { WeekStrip } from '@/src/home/WeekStrip';
import { useExplore } from '@/src/queries/discover';
import { useFlag } from '@/src/config/AppConfigContext';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type SubState = 'active' | 'expiring' | 'none';

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


  const me = useMe();
  const progress = useProgress();
  const breakdown = useProgressBreakdown();
  const recent = useRecentContent();
  const customOn = useFlag('custom_test.enabled');
  const explore = useExplore(user?.selected_course_id);
  const next = customOn ? (explore.data?.recommended?.[0] ?? null) : null;
  const attempts = useAttempts();
  const loadError = me.isError || progress.isError || breakdown.isError || recent.isError;
  const loadData = () => void Promise.all([me.refetch(), progress.refetch(), breakdown.refetch(), recent.refetch(), attempts.refetch()]);
  useRefetchOnFocus(loadData);

  // One Continue card: an unfinished test wins over the last video/notes item.
  const inProgress = attempts.data?.attempts.find((a) => a.status === 'in_progress') ?? null;
  const recentItem = recent.data?.recent?.[0] ?? null;
  const cont: { title: string; pct: number | null; isTest: boolean; go: () => void } | null = inProgress
    ? {
        title: inProgress.test?.title ?? 'Your test',
        pct: null,
        isTest: true,
        go: () => router.push({ pathname: ROUTES.student.testPreStart, params: { id: inProgress.test_id } }),
      }
    : recentItem?.id
      ? {
          title: recentItem.title || 'Content',
          pct: recentItem.pct ?? 0,
          isTest: false,
          go: () =>
            router.push({
              pathname: recentItem.kind === 'document' ? ROUTES.student.contentReader : ROUTES.student.videoPlayer,
              params: { id: recentItem.id },
            }),
        }
      : null;
  const streak = breakdown.data?.day_streak ?? 0;
  const isNewUser = !((progress.data?.attempted_count ?? 0) > 0);

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pressable
                onPress={() => router.push(ROUTES.student.notifications)}
                hitSlop={space.xs}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Bell size={24} color={color('header/text')} weight="regular" />
              </Pressable>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pressable
                onPress={() => router.push(ROUTES.student.notifications)}
                hitSlop={space.xs}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Bell size={22} color={color('header/text')} weight="regular" />
              </Pressable>
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
            </View>
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

            {/* Continue: one card, whichever was touched last */}
            {cont ? (
              <Stagger delayMs={160}>
                <View style={{ marginTop: space.xl }}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>
                    CONTINUE
                  </Text>
                  <View style={[styles.continueCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
                    <View style={styles.cardRow}>
                      <View style={[styles.continueIcon, { backgroundColor: color('accent/tint'), borderRadius: radius.md }]}>
                        {cont.isTest ? (
                          <Exam size={28} color={color('accent/default')} weight="duotone" />
                        ) : (
                          <BookOpen size={28} color={color('accent/default')} weight="duotone" />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: space.md }}>
                        <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>
                          {cont.title}
                        </Text>
                        <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                          {cont.isTest ? 'Test in progress' : cont.pct === 100 ? 'Completed' : `${cont.pct}% completed`}
                        </Text>
                      </View>
                    </View>
                    {cont.pct != null ? (
                      <View style={{ height: 4, backgroundColor: color('bg/sunken'), borderRadius: 2, marginTop: space.sm }}>
                        <View style={{ width: `${cont.pct}%`, height: 4, backgroundColor: color('accent/default'), borderRadius: 2 }} />
                      </View>
                    ) : null}
                    <Pressable
                      onPress={cont.go}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.resumeBtn,
                        {
                          backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'),
                          borderRadius: radius.pill,
                          marginTop: space.md,
                        },
                      ]}
                    >
                      <Text style={[type['type/body-m-medium'], { color: color('accent/on-accent') }]}>
                        {cont.isTest ? 'Resume test' : 'Continue now'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Stagger>
            ) : null}

            {/* Next step: one suggestion, or a first-steps card for brand-new students */}
            <Stagger delayMs={240}>
              <View style={{ marginTop: space.xl }}>
                {isNewUser ? (
                  <View style={{ gap: space.sm }}>
                    <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>START HERE</Text>
                    <ActionCard
                      icon={<Exam size={26} color={color('accent/default')} weight="duotone" />}
                      title="Take your first test"
                      caption="Pick a chapter in Q Bank and try a few questions"
                      onPress={() => router.push(ROUTES.student.practice)}
                    />
                    <ActionCard
                      icon={<BookOpen size={26} color={color('accent/default')} weight="duotone" />}
                      title="Watch a lesson"
                      caption="Video classes, chapter by chapter"
                      onPress={() => router.push(ROUTES.student.learn)}
                    />
                  </View>
                ) : next ? (
                  <View>
                    <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>UP NEXT</Text>
                    <ActionCard
                      icon={<Target size={26} color={color('accent/default')} weight="duotone" />}
                      title={next.title}
                      caption={next.reason}
                      onPress={() =>
                        router.push({ pathname: ROUTES.student.customBuilder, params: { patch: JSON.stringify(next.patch) } })
                      }
                    />
                  </View>
                ) : null}
              </View>
            </Stagger>

            {/* Today: goal ring and the last seven days */}
            <Stagger delayMs={320}>
              <View style={{ marginTop: space.xl }}>
                <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>TODAY</Text>
                  <Pressable onPress={() => router.push(ROUTES.student.progressDetail)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>Your progress →</Text>
                  </Pressable>
                </View>
                <DailyGoalCard />
                <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <Flame size={18} color={color('highlight/default')} weight="fill" />
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
                      {streak > 0 ? `${streak} day streak` : 'Start a streak today'}
                    </Text>
                  </View>
                  <WeekStrip attempts={attempts.data?.attempts ?? []} />
                </View>
              </View>
            </Stagger>

            {/* Plan banner: only when there is something to act on */}
            {subState !== 'active' ? (
              <Stagger delayMs={400}>
                <View style={{ marginTop: space.xl }}>
                  <SubscriptionStrip
                    state={subState}
                    text={subText}
                    onViewPlans={() => router.push(ROUTES.student.subscriptionPlans)}
                  />
                </View>
              </Stagger>
            ) : null}

            <BrainHackOfTheDay />
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

function ActionCard({ icon, title, caption, onPress }: { icon: React.ReactNode; title: string; caption?: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 },
        shadow(),
      ]}
    >
      <View style={{ width: 48, height: 48, backgroundColor: color('accent/tint'), borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{title}</Text>
        {caption ? <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={2}>{caption}</Text> : null}
      </View>
      <CaretRight size={20} color={color('text/tertiary')} />
    </Pressable>
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  bhCard: { minHeight: 120 },
  bhIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  updateCard: { justifyContent: 'flex-end' },
});

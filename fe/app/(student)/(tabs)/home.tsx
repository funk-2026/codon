import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Flame, Exam, BookOpen, Bell, MagnifyingGlass, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { CollapsingHeader, ErrorBanner, useCollapsingHeader } from '@/src/components';
import { useMe } from '@/src/queries/profile';
import { useProgress, useProgressBreakdown } from '@/src/queries/progress';
import { useAttempts, useRecentContent } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { DailyGoalCard } from '@/src/home/DailyGoalCard';
import { LiveSoonCard } from '@/src/home/LiveSoonCard';
import { HomeTiles } from '@/src/home/HomeTiles';
import { StreakCard } from '@/src/home/StreakCard';
import { DetailedAnalysisCard } from '@/src/home/DetailedAnalysisCard';
import { MessageCard } from '@/src/home/MessageCard';
import { BrainHackOfTheDay, HomeUpdatesCarousel } from '@/src/home/HomeShelves';
import { daysUntil, formatExamDate } from '@/src/profile/examDate';
import { useExplore, useNotifications } from '@/src/queries/discover';
import { useFlag } from '@/src/config/AppConfigContext';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type SubState = 'active' | 'expiring' | 'none';

export default function HomeDashboardRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const header = useCollapsingHeader(64);


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
  const notifications = useNotifications('student');
  const unread = notifications.data?.pages[0]?.unread_count ?? 0;
  useRefetchOnFocus(() => { loadData(); void notifications.refetch(); });

  const inProgress = attempts.data?.attempts.find((a) => a.status === 'in_progress') ?? null;
  const recentItems = recent.data?.recent ?? [];
  const watching = recentItems.find((r) => r.kind === 'video') ?? recentItems[0] ?? null;
  const streak = breakdown.data?.day_streak ?? 0;
  const examDays = daysUntil(me.data?.user?.exam_date);

  const [loadedAt] = useState(() => Date.now());
  const { subState, subText } = useMemo((): { subState: SubState; subText: string } => {
    const sub = me.data?.active_subscription;
    if (!sub) return { subState: 'none', subText: '' };
    const end = new Date(sub.end_date);
    const diffDays = Math.ceil((end.getTime() - loadedAt) / (1000 * 3600 * 24));
    const planName = sub.plan?.name || 'Pro';
    return diffDays <= 7
      ? { subState: 'expiring', subText: `Your ${planName} plan expires in ${diffDays} days — renew to keep access.` }
      : { subState: 'active', subText: `${planName} — active until ${end.toLocaleDateString()}` };
  }, [me.data, loadedAt]);

  const firstName = user?.name?.split(' ')[0] || 'Student';

  // Bell and avatar: two circles of the same size, so the right side reads as one control group.
  const headerActions = (size: 'large' | 'small') => {
    const d = size === 'large' ? 40 : 32;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Pressable
          onPress={() => router.push(ROUTES.student.search)}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={[styles.avatar, { width: d, height: d, borderRadius: d / 2, backgroundColor: color('header/chip') }]}
        >
          <MagnifyingGlass size={size === 'large' ? 22 : 18} color={color('header/text')} weight="regular" />
        </Pressable>
        <Pressable
          onPress={() => router.push(ROUTES.student.notifications)}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          style={[styles.avatar, { width: d, height: d, borderRadius: d / 2, backgroundColor: color('header/chip') }]}
        >
          <Bell size={size === 'large' ? 22 : 18} color={color('header/text')} weight={unread > 0 ? 'fill' : 'regular'} />
          {unread > 0 ? <View style={{ position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: color('semantic/danger') }} /> : null}
        </Pressable>
        <Pressable
          onPress={() => router.push(ROUTES.student.profile)}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={[styles.avatar, { width: d, height: d, borderRadius: d / 2, backgroundColor: color('bg/surface') }]}
        >
          <Text style={[size === 'large' ? type['type/body-l'] : type['type/body-m-medium'], { color: color('accent/default'), fontWeight: '600' }]}>
            {(user?.name || 'A').charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]} numberOfLines={1}>
                Hi, {firstName}
              </Text>
              <View style={[styles.streakRow, { gap: space['2xs'], marginTop: space['2xs'] }]}>
                <Flame size={16} color={color('highlight/default')} weight="fill" />
                <Text style={[type['type/body-m'], { color: color('header/text-secondary') }]} numberOfLines={1}>
                  {streak > 0 ? `${streak} day streak` : 'Start a streak today'}
                </Text>
              </View>
            </View>
            {headerActions('large')}
          </View>
        }
        compact={
          <>
            <Text style={[type['type/h3'], { color: color('header/text') }]} numberOfLines={1}>
              Hi, {firstName}
            </Text>
            {headerActions('small')}
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

            {/* 2 · Exam countdown, first thing under the header */}
            <View style={{ marginTop: space.lg }}>
              {examDays != null && examDays >= 0 ? (
                <Pressable
                  onPress={() => router.push(ROUTES.student.editProfile)}
                  accessibilityRole="button"
                  accessibilityLabel={`${examDays} days to your exam. Change the date`}
                  style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }, shadow()]}
                >
                  <Text style={[type['type/numeral-display'], { color: color('accent/default'), fontSize: 40 }]}>{examDays}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>{examDays === 0 ? 'Exam day. Good luck!' : examDays === 1 ? 'day to your exam' : 'days to your exam'}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{formatExamDate(me.data?.user?.exam_date)}</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push(ROUTES.student.editProfile)}
                  accessibilityRole="button"
                  style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, minHeight: 72, justifyContent: 'center' }, shadow()]}
                >
                  <Text style={[type['type/h3'], { color: color('accent/default') }]}>Set your exam date</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>to see the days left</Text>
                </Pressable>
              )}
            </View>

            {/* 3 · Four tiles */}
            <View style={{ marginTop: space.md }}>
              <HomeTiles />
            </View>

            {/* 4 · Upcoming / live: a live test, then what the admin has put up */}
            <LiveSoonCard />
            <HomeUpdatesCarousel />

            {/* 5 · Daily target */}
            <View style={{ marginTop: space.lg }}>
              <DailyGoalCard />
            </View>

            {/* 6 · Streak */}
            <StreakCard streak={streak} attempts={attempts.data?.attempts ?? []} />

            {/* 7 · Detailed analysis */}
            <View style={{ marginTop: space.md }}>
              <DetailedAnalysisCard />
            </View>

            {/* 8 · Continue watching */}
            <View style={{ marginTop: space.xl }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>CONTINUE WATCHING</Text>
              <ActionCard
                icon={<BookOpen size={26} color={color('accent/default')} weight="duotone" />}
                title={watching ? watching.title || 'Your last lesson' : 'Start a lesson'}
                caption={watching ? (watching.pct === 100 ? 'Completed' : `${watching.pct ?? 0}% watched`) : 'Video classes, chapter by chapter'}
                onPress={() => (watching?.id
                  ? router.push({ pathname: watching.kind === 'document' ? ROUTES.student.contentReader : ROUTES.student.videoPlayer, params: { id: watching.id } })
                  : router.push(ROUTES.student.learn))}
              />
            </View>

            {/* 9 · Continue solving */}
            <View style={{ marginTop: space.xl }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>CONTINUE SOLVING</Text>
              <ActionCard
                icon={<Exam size={26} color={color('accent/default')} weight="duotone" />}
                title={inProgress ? inProgress.test?.title ?? 'Your test' : next ? next.title : 'Practise a chapter'}
                caption={inProgress ? 'Test in progress. Tap to resume' : next ? next.reason : 'A few questions every day keeps your streak going'}
                onPress={() => (inProgress
                  ? router.push({ pathname: ROUTES.student.testPreStart, params: { id: inProgress.test_id } })
                  : next
                    ? router.push({ pathname: ROUTES.student.customBuilder, params: { patch: JSON.stringify(next.patch) } })
                    : router.push(ROUTES.student.practice))}
              />
            </View>

            {/* 10 · A message from the admin's chosen voice */}
            <MessageCard />

            {/* Plan banner: only when there is something to act on */}
            {subState !== 'active' ? (
              <View style={{ marginTop: space.xl }}>
                <SubscriptionStrip state={subState} text={subText} onViewPlans={() => router.push(ROUTES.student.subscriptionPlans)} />
              </View>
            ) : null}

            {/* 11 · Brain hack of the day */}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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

import { useCourses } from '@/src/queries/curriculum';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Flame, Exam, BookOpen, FileText, CaretRight } from 'phosphor-react-native';
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
import { daysUntil } from '@/src/profile/examDate';
import { useExplore, useNotifications } from '@/src/queries/discover';
import { useFlag } from '@/src/config/AppConfigContext';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { formatDate } from '@/src/format/date';
import { TabHeaderActions } from '@/src/components/TabHeaderActions';
import { usePullRefresh, RefreshPill } from '@/src/components/PullRefresh';

type SubState = 'active' | 'expiring' | 'none';

export default function HomeDashboardRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const header = useCollapsingHeader(64);
  const pull = usePullRefresh(header.maxHeight);


  const me = useMe();
  const progress = useProgress();
  const breakdown = useProgressBreakdown();
  const recent = useRecentContent();
  const customOn = useFlag('custom_test.enabled');
  const explore = useExplore(user?.selected_course_id);
  // The board-paper channel is for the Class 10 course only; a NEET UG student never sees it.
  const courses = useCourses();
  const boardChannel = /class-?10|board|school/i.test(courses.data?.find((c) => c.id === user?.selected_course_id)?.slug ?? '');
  const next = customOn ? (explore.data?.recommended?.[0] ?? null) : null;
  const attempts = useAttempts();
  const loadError = me.isError || progress.isError || breakdown.isError || recent.isError;
  const loadData = () => void Promise.all([me.refetch(), progress.refetch(), breakdown.refetch(), recent.refetch(), attempts.refetch()]);
  const notifications = useNotifications('student');
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
      ? { subState: 'expiring', subText: `Your ${planName} plan expires in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}. Renew to keep access.` }
      : { subState: 'active', subText: '' };
  }, [me.data, loadedAt]);

  const firstName = user?.name?.split(' ')[0] || 'Student';

  const headerActions = (size: 'large' | 'small') => <TabHeaderActions size={size} avatar />;

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
        refreshControl={pull.control}
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
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{formatDate(me.data?.user?.exam_date)}</Text>
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

            {/* Sample Board Exam Paper: the Class 10 channel, straight to its four tiles */}
            {boardChannel ? (
              <View style={{ marginTop: space.md }}>
                <ActionCard
                  icon={<FileText size={26} color={color('accent/default')} weight="duotone" />}
                  title="Sample board exam paper"
                  caption="Class 10 channel"
                  onPress={() => router.push(ROUTES.student.boardPapers)}
                />
              </View>
            ) : null}

            {/* 7 · My progress */}
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
                title={inProgress ? inProgress.test?.title ?? 'Your test' : next ? next.title : 'Practice a chapter'}
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
      <RefreshPill visible={pull.refreshing} top={header.maxHeight} />
    </View>
  );
}


function SubscriptionStrip({ state, text, onViewPlans }: { state: SubState; text?: string; onViewPlans: () => void }) {
  const { color, type, space, radius } = useTheme();
  const expiring = state === 'expiring';
  return (
    <View style={[styles.strip, { backgroundColor: color(expiring ? 'semantic/warning' : 'accent/tint'), borderRadius: radius.md, padding: space.md, gap: space.sm }]}>
      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
        {expiring ? text || 'Your plan is expiring soon.' : 'You’re on free access. Unlock all tests and video lectures.'}
      </Text>
      <Pressable onPress={onViewPlans} accessibilityRole="button" hitSlop={space.xs} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type['type/body-m-medium'], { color: expiring ? color('text/primary') : color('accent/default') }]}>{expiring ? 'Renew' : 'View plans'}</Text>
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

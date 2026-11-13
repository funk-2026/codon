import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CaretRight, ChartBar, ChatCircleText, ClockCounterClockwise, FolderOpen, GearSix, HandHeart, Megaphone, Tag } from 'phosphor-react-native';
import { ErrorBanner, Screen, SkeletonBlock, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAdminSummary } from '@/src/queries/admin';
import { totalWaiting, useAdminInbox } from '@/src/admin/useAdminInbox';
import { listFeedback } from '@/src/api/adminOps';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type Tool = { key?: 'feedback'; label: string; text: string; Icon: typeof GearSix; href: Href };
const GROUPS: { title: string; tools: Tool[] }[] = [
  {
    title: 'COURSE',
    tools: [{ label: 'Course structure', text: 'Subjects, chapters and what each holds', Icon: FolderOpen, href: ROUTES.admin.courseStructure }],
  },
  {
    title: 'CONTENT',
    tools: [
      { label: 'Tags and topics', text: 'Create, merge and browse', Icon: Tag, href: ROUTES.admin.taxonomy },
      { label: 'Wellness articles', text: 'Write what students read in Support', Icon: HandHeart, href: ROUTES.admin.wellness },
      { label: 'Home banners', text: 'What students see at the top of Home', Icon: Megaphone, href: ROUTES.admin.homeUpdates },
    ],
  },
  {
    title: 'PLATFORM',
    tools: [
      { label: 'Platform settings', text: 'Verification and custom tests', Icon: GearSix, href: ROUTES.admin.platformSettings },
      { key: 'feedback', label: 'User feedback', text: 'What people sent through Give feedback', Icon: ChatCircleText, href: ROUTES.admin.feedback },
      { label: 'Analytics', text: 'How the platform is used', Icon: ChartBar, href: ROUTES.admin.analyticsOverview },
      { label: 'Audit log', text: 'Who changed what', Icon: ClockCounterClockwise, href: ROUTES.admin.auditLog },
    ],
  },
];

/** Home shows the state of the platform and opens things; the numbers are buttons. */
export default function AdminHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const summaryQuery = useAdminSummary();
  const inbox = useAdminInbox();
  useRefetchOnFocus(() => void Promise.all([summaryQuery.refetch(), inbox.refetch()]));

  const newFeedback = useQuery({ queryKey: ['admin', 'feedback', 'new-count'], queryFn: () => listFeedback({ status: 'new', limit: 20 }), retry: false });
  const feedbackCount = newFeedback.data?.items.length ?? 0;
  const loading = summaryQuery.isPending;
  const waiting = totalWaiting(inbox.data);

  const stats: { label: string; value: string; warn?: boolean; onPress: () => void }[] = [
    { label: 'Users', value: String(summaryQuery.data?.total_users ?? 0), onPress: () => router.push(ROUTES.admin.users) },
    { label: 'Active plans', value: String(summaryQuery.data?.active_subscriptions ?? 0), onPress: () => router.push(ROUTES.admin.payments) },
    { label: 'Waiting on you', value: String(waiting), warn: waiting > 0, onPress: () => router.push(ROUTES.admin.review) },
  ];

  return (
    <Screen edges={TAB_EDGES}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: space.lg }}>
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>Admin</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'], minHeight: 22 }]}>
            {waiting > 0 ? `${waiting} item${waiting === 1 ? '' : 's'} waiting for review` : loading ? ' ' : 'Nothing is waiting for review'}
          </Text>
        </View>

        {summaryQuery.isError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={() => void summaryQuery.refetch()} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.lg }}>
          {loading
            ? [0, 1, 2].map((i) => <SkeletonBlock key={i} height={76} radius={radius.md} style={{ flex: 1 }} />)
            : stats.map((s) => (
                <Pressable
                  key={s.label}
                  onPress={s.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.value} ${s.label}. Open`}
                  style={({ pressed }) => [{ flex: 1, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
                >
                  <Text style={[type['type/numeral-display'], { color: s.warn ? color('semantic/warning') : color('text/primary'), fontSize: 26 }]}>{s.value}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={1}>{s.label}</Text>
                </Pressable>
              ))}
        </View>

        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginTop: space.xl, gap: space.xs }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{g.title}</Text>
            {g.tools.map((t) => (
              <Pressable
                key={t.label}
                onPress={() => router.push(t.href)}
                accessibilityRole="button"
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                  <t.Icon size={22} color={color('accent/default')} weight="duotone" />
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{t.label}</Text>
                  <Text style={[type['type/caption'], { color: t.key === 'feedback' && feedbackCount > 0 ? color('semantic/warning') : color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
                    {t.key === 'feedback' && feedbackCount > 0 ? `${feedbackCount}${newFeedback.data?.next_cursor ? '+' : ''} new` : t.text}
                  </Text>
                </View>
                <CaretRight size={18} color={color('text/tertiary')} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

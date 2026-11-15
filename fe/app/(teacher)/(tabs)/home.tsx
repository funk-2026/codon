import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import {
  Cards,
  CaretRight,
  CheckCircle,
  ClipboardText,
  FlagBanner,
  Lightbulb,
  Plus,
  Tag,
  VideoCamera,
  WarningCircle,
} from 'phosphor-react-native';
import { BottomSheet, ErrorBanner, Screen, SkeletonBlock, StatusBadge, TAB_EDGES, type BadgeStatus } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { InventoryHints } from '@/src/teacher/InventoryHints';
import { ImpactCard } from '@/src/teacher/ImpactCard';
import { useNotifications } from '@/src/queries/discover';
import { SEGMENT_OF, STATUS_LABEL, byRecent, statusCounts, type ItemStatus, type TeacherItem } from '@/src/teacher/items';
import { useTeacherItems } from '@/src/teacher/useTeacherItems';
import { countLabel, useTeacherInbox } from '@/src/teacher/useTeacherInbox';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

const CREATE_OPTIONS: { label: string; text: string; href: Href; Icon: typeof ClipboardText }[] = [
  { label: 'New exam', text: 'A timed test in NEET or school style, live or anytime', href: ROUTES.teacher.createExam, Icon: ClipboardText },
  { label: 'New Q Bank set', text: 'Practice questions for a chapter, from questions or a CSV', href: ROUTES.teacher.createTest, Icon: ClipboardText },
  { label: 'New lesson', text: 'A video lecture or a document for a chapter', href: ROUTES.teacher.createContent, Icon: VideoCamera },
  { label: 'New Brain Hack', text: 'A short, practical tip', href: ROUTES.teacher.createBrainHack, Icon: Lightbulb },
  { label: 'New flashcard deck', text: 'Quick-recall cards, prompt and answer', href: ROUTES.teacher.flashcardDeck, Icon: Cards },
];

const BADGE: Record<ItemStatus, BadgeStatus> = { draft: 'draft', pending: 'pending', approved: 'approved', rejected: 'rejected', published: 'published' };

const open = (router: ReturnType<typeof useRouter>, item: TeacherItem) =>
  item.type === 'Deck'
    ? router.push({ pathname: ROUTES.teacher.flashcardDeck, params: { id: item.id } })
    : router.push({ pathname: ROUTES.teacher.contentPreview, params: { id: item.id, type: item.type } });

/** Home answers one question: what needs me right now? Then it gets out of the way. */
export default function TeacherHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const itemsQuery = useTeacherItems();
  const inbox = useTeacherInbox();
  const unread = useNotifications('teacher').data?.pages[0]?.unread_count ?? 0;
  useRefetchOnFocus(() => void Promise.all([itemsQuery.refetch(), inbox.refetch()]));

  const items = itemsQuery.data ?? [];
  const counts = statusCounts(items);
  const rejected = items.filter((i) => i.status === 'rejected').sort(byRecent);
  const recent = [...items].sort(byRecent).slice(0, 5);
  const reports = inbox.data?.reports ?? 0;
  const needsTags = inbox.data?.needsTags ?? 0;

  const toContent = (status: ItemStatus, segment?: string) =>
    router.push({ pathname: ROUTES.teacher.content, params: { status, ...(segment ? { segment } : {}) } });
  const firstSegmentWith = (status: ItemStatus) => {
    const first = items.filter((i) => i.status === status).sort(byRecent)[0];
    return first ? SEGMENT_OF[first.type] : undefined;
  };

  const attention = counts.rejected + counts.approved + reports + (needsTags > 0 ? 1 : 0);
  const firstName = user?.name?.split(' ')[0] || 'Teacher';
  const loading = itemsQuery.isPending;

  const summary: { status: ItemStatus; token: 'semantic/warning' | 'semantic/success' | 'text/secondary' }[] = [
    { status: 'draft', token: 'text/secondary' },
    { status: 'pending', token: 'semantic/warning' },
    { status: 'approved', token: 'semantic/success' },
    { status: 'published', token: 'semantic/success' },
  ];

  return (
    <Screen edges={TAB_EDGES}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[type['type/h1'], { color: color('text/primary') }]} numberOfLines={1}>Hi, {firstName}</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
              {loading ? ' ' : attention > 0 ? `${attention} thing${attention === 1 ? '' : 's'} need${attention === 1 ? 's' : ''} you` : 'You’re all caught up'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(ROUTES.teacher.notifications)}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: space.xs }}
          >
            <Bell size={22} color={color('text/primary')} />
            {unread > 0 ? <View style={{ position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: color('semantic/danger') }} /> : null}
          </Pressable>
          <Pressable
            onPress={() => setCreateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create something new"
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space['2xs'], backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'), borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 40 }]}
          >
            <Plus size={18} color={color('action/on-primary')} weight="bold" />
            <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>Create</Text>
          </Pressable>
        </View>

        {itemsQuery.isError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={() => void itemsQuery.refetch()} />
          </View>
        ) : null}

        {loading ? (
          <View style={{ marginTop: space.xl, gap: space.xs }}>
            <SkeletonBlock height={64} radius={radius.md} />
            <SkeletonBlock height={64} radius={radius.md} />
          </View>
        ) : attention > 0 ? (
          <View style={{ marginTop: space.xl, gap: space.xs }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>NEEDS YOU</Text>

            {rejected.slice(0, 3).map((i) => (
              <Pressable
                key={i.id}
                onPress={() => open(router, i)}
                accessibilityRole="button"
                accessibilityLabel={`${i.title} needs changes`}
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, borderLeftWidth: 4, borderLeftColor: color('semantic/danger'), opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{i.title}</Text>
                  <StatusBadge status="rejected" label="Changes needed" />
                </View>
                <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={2}>
                  {i.rejectionReason || 'Open it to see the reviewer’s note.'}
                </Text>
              </Pressable>
            ))}
            {counts.rejected > 3 ? (
              <AttentionRow icon={<WarningCircle size={22} color={color('semantic/danger')} weight="fill" />} text={`${counts.rejected - 3} more need changes`} onPress={() => toContent('rejected', firstSegmentWith('rejected'))} />
            ) : null}
            {counts.approved > 0 ? (
              <AttentionRow icon={<CheckCircle size={22} color={color('semantic/success')} weight="fill" />} text={`${counts.approved} approved, ready to publish`} onPress={() => toContent('approved', firstSegmentWith('approved'))} />
            ) : null}
            {reports > 0 ? (
              <AttentionRow icon={<FlagBanner size={22} color={color('semantic/danger')} weight="fill" />} text={`${countLabel(reports)} student report${reports === 1 ? '' : 's'} on your questions`} onPress={() => router.push({ pathname: ROUTES.teacher.questions, params: { segment: 'reports' } })} />
            ) : null}
            {needsTags > 0 ? (
              <AttentionRow icon={<Tag size={22} color={color('semantic/warning')} weight="fill" />} text={`${needsTags} question${needsTags === 1 ? '' : 's'} missing tags or difficulty`} onPress={() => router.push({ pathname: ROUTES.teacher.questions, params: { segment: 'tags' } })} />
            ) : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>YOUR CONTENT</Text>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {summary.map((s) => (
                <Pressable
                  key={s.status}
                  onPress={() => toContent(s.status, firstSegmentWith(s.status))}
                  accessibilityRole="button"
                  accessibilityLabel={`${counts[s.status]} ${STATUS_LABEL[s.status].toLowerCase()}. Show them`}
                  style={({ pressed }) => [{ flex: 1, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
                >
                  <Text style={[type['type/numeral-display'], { color: color(s.token), fontSize: 26 }]}>{counts[s.status]}</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={1}>{STATUS_LABEL[s.status]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!loading ? <ImpactCard /> : null}

        {recent.length > 0 ? (
          <View style={{ marginTop: space.xl, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>RECENT</Text>
              <Pressable onPress={() => router.push(ROUTES.teacher.content)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[type['type/caption'], { color: color('accent/default') }]}>All content →</Text>
              </Pressable>
            </View>
            {recent.map((i) => (
              <Pressable
                key={i.id}
                onPress={() => open(router, i)}
                accessibilityRole="button"
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{i.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>{i.breadcrumb}</Text>
                </View>
                <StatusBadge status={BADGE[i.status]} label={STATUS_LABEL[i.status]} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <InventoryHints />
      </ScrollView>

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <View style={{ gap: space.xs }}>
          {CREATE_OPTIONS.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                setCreateOpen(false);
                router.push(o.href);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.9 : 1 }]}
            >
              <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                <o.Icon size={22} color={color('accent/default')} weight="duotone" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>{o.label}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{o.text}</Text>
              </View>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function AttentionRow({ icon, text, onPress }: { icon: React.ReactNode; text: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      {icon}
      <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{text}</Text>
      <CaretRight size={18} color={color('text/tertiary')} />
    </Pressable>
  );
}

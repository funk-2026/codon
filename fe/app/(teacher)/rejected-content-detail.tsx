import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardText, PlayCircle, FileText, Lightbulb, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getTeacherTest, getTeacherContent } from '@/src/api/teacher';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useQuery } from '@tanstack/react-query';

type ItemType = 'Test' | 'Video' | 'Document' | 'Brain Hack';

const TYPE_ICON: Record<ItemType, React.ComponentType<{ size: number; color: string }>> = {
  Test: ClipboardText,
  Video: PlayCircle,
  Document: FileText,
  'Brain Hack': Lightbulb,
};

function breadcrumbFrom(parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(' · ');
}

function timeAgo(iso?: string): string {
  if (!iso) return 'Recently';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Recently';
  const minutes = Math.max(1, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}


export default function RejectedContentDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, type: rawType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const itemType = (rawType as ItemType) ?? 'Test';
  const Icon = TYPE_ICON[itemType];

  const detail = useQuery({
    queryKey: ['teacher', 'rejected', itemType, id],
    enabled: !!id,
    queryFn: async () => {
      if (itemType === 'Test') {
        const { test } = await getTeacherTest(id as string);
        return {
          title: test.title,
          breadcrumb: breadcrumbFrom([test.course?.name, test.subject?.name, test.chapter?.name]),
          reason: test.rejection_reason || 'No reason was provided.',
          reviewedAgo: timeAgo(test.reviewed_at),
        };
      }
      const { content } = await getTeacherContent(id as string);
      return {
        title: content.title,
        breadcrumb: breadcrumbFrom([content.course?.name, content.chapter?.name]),
        reason: content.rejection_reason || 'No reason was provided.',
        reviewedAgo: timeAgo(content.reviewed_at),
      };
    },
  });
  const loading = !!id && detail.isPending;
  const loadError = !id || detail.isError;
  const { title = '', breadcrumb = '', reason = '', reviewedAgo = '' } = detail.data ?? {};
  const load = () => void detail.refetch();

  const handleEditAndResubmit = () => {
    if (!id) return;
    if (itemType === 'Test') {
      router.push({ pathname: ROUTES.teacher.questionBuilder, params: { testId: id } });
    } else if (itemType === 'Brain Hack') {
      router.push(ROUTES.teacher.createBrainHack);
    } else {
      router.push(ROUTES.teacher.createContent);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Changes Needed" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <SkeletonBlock height={96} radius={radius.lg} />
            <SkeletonBlock height={56} radius={radius.md} />
          </View>
        ) : loadError ? (
          <View style={{ marginTop: space.xl }}>
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load this item"
              description="Something went wrong fetching the reviewer feedback."
              action={<TextButton label="Retry" onPress={load} />}
            />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.reasonCard,
                { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl, borderLeftColor: color('semantic/danger') },
                shadow(),
              ]}
            >
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>REVIEWER FEEDBACK</Text>
              <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.xs }]}>
                {reason}
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}>
                Reviewed {reviewedAgo}.
              </Text>
            </View>

            <View
              style={[
                styles.summaryRow,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
              ]}
            >
              <Icon size={22} color={color('text/secondary')} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>
                  {title || 'Untitled'}
                </Text>
                {breadcrumb ? (
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {breadcrumb}
                  </Text>
                ) : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {!loading && !loadError ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Edit & Resubmit" onPress={handleEditAndResubmit} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  reasonCard: { borderLeftWidth: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
});

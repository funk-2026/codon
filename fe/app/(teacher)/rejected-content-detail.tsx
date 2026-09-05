import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, ClipboardText, PlayCircle, FileText, Lightbulb, WarningCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getTeacherTest, getTeacherContent } from '@/src/api/teacher';

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

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

export default function RejectedContentDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, type: rawType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const itemType = (rawType as ItemType) ?? 'Test';
  const Icon = TYPE_ICON[itemType];

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState('');
  const [breadcrumb, setBreadcrumb] = useState('');
  const [reason, setReason] = useState('');
  const [reviewedAgo, setReviewedAgo] = useState('');

  const load = useCallback(() => {
    if (!id) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);

    const run =
      itemType === 'Test'
        ? getTeacherTest(id).then((res) => {
            setTitle(res.test.title);
            setBreadcrumb(breadcrumbFrom([res.test.course?.name, res.test.subject?.name, res.test.chapter?.name]));
            setReason(res.test.rejection_reason || 'No reason was provided.');
            setReviewedAgo(timeAgo(res.test.reviewed_at));
          })
        : getTeacherContent(id).then((res) => {
            setTitle(res.content.title);
            setBreadcrumb(breadcrumbFrom([res.content.course?.name, res.content.chapter?.name]));
            setReason(res.content.rejection_reason || 'No reason was provided.');
            setReviewedAgo(timeAgo(res.content.reviewed_at));
          });

    run.catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [id, itemType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEditAndResubmit = () => {
    if (!id) return;
    if (itemType === 'Test') {
      router.push({ pathname: '/(teacher)/question-builder', params: { testId: id } });
    } else if (itemType === 'Brain Hack') {
      router.push('/(teacher)/create-brain-hack');
    } else {
      router.push('/(teacher)/create-content');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Changes Needed
        </Text>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  reasonCard: { borderLeftWidth: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
});

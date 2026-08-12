import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, ClipboardText, PlayCircle, FileText, Lightbulb } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type ItemType = 'Test' | 'Video' | 'Document' | 'Brain Hack';

const ITEM: Record<string, { title: string; breadcrumb: string | null; type: ItemType; reason: string; reviewedAgo: string }> = {
  a2: { title: 'Cell Biology — Intro Video', breadcrumb: 'NEET UG · Botany · Cell Biology', type: 'Video', reason: 'The audio cuts out around the 4-minute mark — please re-upload with the full audio track intact.', reviewedAgo: '5 hours ago' },
  a5: { title: '[new] Zoology', breadcrumb: 'NEET UG', type: 'Test', reason: 'Duplicate of the existing "Modern Physics" chapter — please add sub-chapters there instead.', reviewedAgo: '3 days ago' },
};

const DEFAULT_ITEM = ITEM.a2;

const TYPE_ICON: Record<ItemType, React.ComponentType<{ size: number; color: string }>> = {
  Test: ClipboardText,
  Video: PlayCircle,
  Document: FileText,
  'Brain Hack': Lightbulb,
};

function editRouteFor(itemType: ItemType, params: { rejected: string }) {
  if (itemType === 'Test') return { pathname: '/(teacher)/(upload)/create-test' as const, params };
  if (itemType === 'Brain Hack') return { pathname: '/(teacher)/(upload)/create-brain-hack' as const, params };
  return { pathname: '/(teacher)/(upload)/create-content' as const, params };
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = (id && ITEM[id]) || DEFAULT_ITEM;
  const Icon = TYPE_ICON[item.type];

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
        <View
          style={[
            styles.reasonCard,
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl, borderLeftColor: color('semantic/danger') },
            shadow(),
          ]}
        >
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>REVIEWER FEEDBACK</Text>
          <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: space.xs }]}>
            {item.reason}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}>
            Reviewed {item.reviewedAgo} by Codon Admin.
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
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{item.title}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
              {item.breadcrumb ?? 'Brain Hack'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label="Edit & Resubmit"
          onPress={() => router.push(editRouteFor(item.type, { rejected: '1' }))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  reasonCard: { borderLeftWidth: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
});

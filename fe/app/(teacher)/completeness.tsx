import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CaretLeft, CheckCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getCompleteness, type CompletenessRow, type MissingKind } from '@/src/api/questionBank';

const KINDS: { key: MissingKind; field: keyof CompletenessRow; label: string }[] = [
  { key: 'difficulty', field: 'missing_difficulty', label: 'Difficulty' },
  { key: 'tags', field: 'missing_tags', label: 'Tags' },
  { key: 'topic', field: 'missing_topic', label: 'Topic' },
  { key: 'ncert', field: 'missing_ncert', label: 'NCERT page' },
  { key: 'alt_text', field: 'missing_alt_text', label: 'Image alt text' },
];

/**
 * Completeness dashboard (FE-2.10): per chapter, how many of my questions are
 * missing each piece of metadata. Tap a count → the quick-tag queue for exactly
 * those questions. Reloads on focus so progress shows when you come back.
 */
export default function CompletenessRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ chapters: CompletenessRow[]; totals: Record<string, number> } | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getCompleteness().then((r) => setData({ chapters: r.chapters ?? [], totals: r.totals ?? {} })).catch(() => setError(true));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const fix = (kind: MissingKind, row?: CompletenessRow) =>
    router.push({ pathname: '/(teacher)/quick-tag', params: { missing: kind, ...(row?.chapter_id ? { chapterId: row.chapter_id, chapter: row.chapter } : {}) } });

  const allDone = data && KINDS.every((k) => !(data.totals[k.field as string] > 0));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Completeness</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }}>
        {error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load completeness" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : !data ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={90} radius={radius.md} />)
        ) : allDone ? (
          <EmptyState icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />} title="Everything is tagged" description={`All ${data.totals.total ?? 0} of your questions have their metadata.`} />
        ) : (
          <>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              Fully tagged questions make students’ custom tests sharper. Tap a number to fix those questions one by one.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {KINDS.filter((k) => data.totals[k.field as string] > 0).map((k) => (
                <Pressable
                  key={k.key}
                  onPress={() => fix(k.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${data.totals[k.field as string]} questions missing ${k.label}. Fix all`}
                  style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.xs, minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{data.totals[k.field as string]} · {k.label}</Text>
                </Pressable>
              ))}
            </View>

            {data.chapters
              .filter((r) => KINDS.some((k) => (r[k.field] as number) > 0))
              .map((r) => (
                <View key={r.chapter_id ?? r.chapter} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{r.chapter} <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>· {r.total} questions</Text></Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                    {KINDS.filter((k) => (r[k.field] as number) > 0).map((k) => (
                      <Pressable
                        key={k.key}
                        onPress={() => fix(k.key, r)}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.chapter}: ${r[k.field]} missing ${k.label}. Fix`}
                        style={{ borderWidth: 1, borderColor: color('semantic/warning'), borderRadius: radius.pill, paddingHorizontal: space.sm, minHeight: 36, justifyContent: 'center' }}
                      >
                        <Text style={[type['type/caption'], { color: color('text/primary') }]}>{r[k.field]} no {k.label.toLowerCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

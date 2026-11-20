import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FilePdf } from 'phosphor-react-native';
import { BottomSheet, Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listReferenceDocs } from '@/src/api/reference';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

// Four tiles down the left, three down the right.
const LEFT = [
  { slug: 'flashcards', label: 'Flashcards' },
  { slug: 'pulse', label: 'Pulse' },
  { slug: 'schema', label: 'Schema' },
  { slug: 'qbank', label: 'QBank' },
];
const RIGHT = [
  { slug: 'test_series', label: 'Test series' },
  { slug: 'videos', label: 'Videos' },
  { slug: 'fourth_book', label: 'Fourth Book' },
];

/** One how-to guide per feature, each a PDF an admin has uploaded. A guide that isn't uploaded yet says so. */
export default function HowToUseRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const docs = useQuery({ queryKey: ['reference-docs', 'howto'], queryFn: () => listReferenceDocs({ kind: 'howto' }), staleTime: 5 * 60_000 });
  const [pending, setPending] = useState<string | null>(null);
  const bySlug = new Map((docs.data ?? []).map((d) => [d.slug, d]));

  const tile = (t: { slug: string; label: string }) => {
    const doc = bySlug.get(t.slug);
    return (
      <Pressable
        key={t.slug}
        onPress={() => (doc ? router.push({ pathname: ROUTES.student.referenceDoc, params: { id: doc.id } }) : setPending(t.label))}
        accessibilityRole="button"
        accessibilityLabel={`${t.label} guide${doc ? '' : ', not available yet'}`}
        style={({ pressed }) => [{ minHeight: 96, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, justifyContent: 'space-between', opacity: pressed ? 0.94 : doc ? 1 : 0.7 }, shadow()]}
      >
        <FilePdf size={26} color={color('accent/default')} weight="duotone" />
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>{t.label}</Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <ScreenHeader title="How to use this app" />
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] }}>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginBottom: space.md }]}>Tap a feature to read how it works.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: space.sm }}>{LEFT.map(tile)}</View>
          <View style={{ flex: 1, gap: space.sm }}>{RIGHT.map(tile)}</View>
        </View>
      </ScrollView>
      <BottomSheet visible={!!pending} onClose={() => setPending(null)} title={`${pending ?? ''} guide`}>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingBottom: space.md }]}>This guide hasn’t been added yet. Check back soon.</Text>
      </BottomSheet>
    </Screen>
  );
}

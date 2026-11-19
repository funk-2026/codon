import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CaretRight, FilePdf } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listReferenceDocs, type RefKind } from '@/src/api/reference';
import { groupBoardDocs } from '@/src/boardpapers/group';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

export const BOARD_CLASS = '10';
const TITLES: Partial<Record<RefKind, string>> = { pattern: 'Paper Pattern', past_paper: 'Past Year Papers', practice_paper: 'Practice Question Papers', weightage: 'Weightage' };
const KINDS = Object.keys(TITLES) as RefKind[];

/**
 * Board, then subject, then (for papers) year, then the PDF. Everything opens in place, so going Back from a PDF
 * returns to the same open board and subject. Only uploaded documents appear.
 */
export default function BoardPaperListRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { kind: raw } = useLocalSearchParams<{ kind?: string }>();
  const kind: RefKind = KINDS.includes(raw as RefKind) ? (raw as RefKind) : 'past_paper';
  const withYear = kind === 'past_paper' || kind === 'practice_paper';
  const q = useQuery({ queryKey: ['reference-docs', kind, BOARD_CLASS], queryFn: () => listReferenceDocs({ kind, class: BOARD_CLASS }), staleTime: 5 * 60_000 });
  const groups = useMemo(() => groupBoardDocs(q.data ?? []), [q.data]);
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  const open = (id: string) => router.push({ pathname: ROUTES.student.referenceDoc, params: { id } });

  return (
    <Screen>
      <ScreenHeader title={TITLES[kind] ?? 'Papers'} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Class {BOARD_CLASS} · {withYear ? 'State, subject, then year' : 'Board, then subject'}</Text>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={56} radius={radius.md} />)
        ) : q.isError ? (
          <EmptyState icon={<FilePdf size={32} color={color('semantic/danger')} />} title="Couldn’t load" description="Check your connection and try again." action={<TextButton label="Try again" onPress={() => void q.refetch()} />} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<FilePdf size={32} color={color('text/tertiary')} />} title="Nothing here yet" description="These will appear as soon as they are added." />
        ) : (
          groups.map((b) => {
            const bOpen = openBoard === b.board;
            return (
              <View key={b.board} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}>
                <Pressable onPress={() => { setOpenBoard(bOpen ? null : b.board); setOpenSubject(null); }} accessibilityRole="button" accessibilityState={{ expanded: bOpen }} style={{ minHeight: 56, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{b.board}</Text>
                  {bOpen ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
                </Pressable>
                {bOpen ? b.subjects.map((s) => {
                  const key = `${b.board}/${s.subject}`;
                  const sOpen = openSubject === key;
                  // A subject with a single, yearless document opens it straight away.
                  const direct = !withYear && s.docs.length === 1;
                  return (
                    <View key={key} style={{ borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
                      <Pressable onPress={() => (direct ? open(s.docs[0].id) : setOpenSubject(sOpen ? null : key))} accessibilityRole="button" accessibilityState={{ expanded: sOpen }} style={{ minHeight: 52, paddingHorizontal: space.md, paddingLeft: space.lg, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>{s.subject}</Text>
                        {direct ? <FilePdf size={20} color={color('accent/default')} /> : sOpen ? <CaretDown size={16} color={color('text/tertiary')} /> : <CaretRight size={16} color={color('text/tertiary')} />}
                      </Pressable>
                      {sOpen ? s.docs.map((d) => (
                        <Pressable key={d.id} onPress={() => open(d.id)} accessibilityRole="button" accessibilityLabel={`${d.title}. Open PDF`} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: space.md, paddingLeft: space['2xl'], flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: pressed ? color('bg/sunken') : 'transparent' })}>
                          <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{withYear && d.year ? `${d.year}${d.title && d.title !== String(d.year) ? ` · ${d.title}` : ''}` : d.title}</Text>
                          <Text style={[type['type/caption'], { color: color('accent/default') }]}>Open PDF</Text>
                        </Pressable>
                      )) : null}
                    </View>
                  );
                }) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

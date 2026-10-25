import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretDown, CaretLeft, CaretRight, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, type MediaMap } from '@/src/rich';
import {
  adminApproveBrainHack, adminApproveDeck, adminGetDeck, adminListBrainHacks, adminListDecks, adminRejectBrainHack, adminRejectDeck,
  type AdminBrainHack,
} from '@/src/api/contentReview';
import type { TeacherCard, TeacherDeck } from '@/src/api/flashcardsTeacher';

type Kind = 'hacks' | 'decks';
type Target = { kind: Kind; id: string; title: string };

/**
 * Admin queue for Brain Hacks and flashcard decks awaiting review. Each item
 * expands to the full content before approving; rejecting requires a reason
 * (sent to the author as a notification by the server).
 */
export default function ContentQueueRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [kind, setKind] = useState<Kind>('hacks');
  const [hacks, setHacks] = useState<AdminBrainHack[]>([]);
  const [hackMedia, setHackMedia] = useState<MediaMap>({});
  const [decks, setDecks] = useState<TeacherDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<Record<string, { cards: TeacherCard[]; media: MediaMap } | 'loading' | 'error'>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    setOpen(null);
    try {
      if (kind === 'hacks') {
        const r = await adminListBrainHacks();
        if (my !== seq.current) return;
        setHacks(r.brain_hacks);
        setHackMedia(r.media);
      } else {
        const r = await adminListDecks();
        if (my !== seq.current) return;
        setDecks(r.decks);
      }
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDeck = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (deckCards[id] && deckCards[id] !== 'error') return;
    setDeckCards((m) => ({ ...m, [id]: 'loading' }));
    try {
      const r = await adminGetDeck(id);
      setDeckCards((m) => ({ ...m, [id]: { cards: r.cards, media: r.media } }));
    } catch {
      setDeckCards((m) => ({ ...m, [id]: 'error' }));
    }
  };

  const removeRow = (t: { kind: Kind; id: string }) =>
    t.kind === 'hacks' ? setHacks((p) => p.filter((x) => x.id !== t.id)) : setDecks((p) => p.filter((x) => x.id !== t.id));

  const approve = async (t: Target) => {
    setBusy(t.id);
    try {
      await (t.kind === 'hacks' ? adminApproveBrainHack(t.id) : adminApproveDeck(t.id));
      removeRow(t);
      show('Approved — the author can now publish it.', 'success');
    } catch {
      show('Couldn’t approve. It may have been reviewed already — pull to refresh.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting || reason.trim().length < 3) return;
    const t = rejecting;
    setBusy(t.id);
    try {
      await (t.kind === 'hacks' ? adminRejectBrainHack(t.id, reason.trim()) : adminRejectDeck(t.id, reason.trim()));
      removeRow(t);
      setRejecting(null);
      setReason('');
      show('Rejected — the author has been notified.', 'success');
    } catch {
      show('Couldn’t reject. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const actions = (t: Target) => (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
      <SecondaryButton label="Reject" onPress={() => { setReason(''); setRejecting(t); }} disabled={busy === t.id} style={{ flex: 1 }} />
      <PrimaryButton label="Approve" onPress={() => approve(t)} loading={busy === t.id} style={{ flex: 1 }} />
    </View>
  );

  const rows = kind === 'hacks' ? hacks : decks;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Brain Hacks & Flashcards</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.sm }}>
        {([['hacks', 'Brain Hacks'], ['decks', 'Flashcard decks']] as const).map(([k, label]) => {
          const on = kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/surface') }}
            >
              <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/primary') }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={88} radius={radius.md} />)
        ) : error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the queue"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('text/tertiary')} />}
            title="Nothing to review"
            description={kind === 'hacks' ? 'No Brain Hacks are waiting for review.' : 'No flashcard decks are waiting for review.'}
          />
        ) : kind === 'hacks' ? (
          hacks.map((h) => {
            const expanded = open === h.id;
            return (
              <View key={h.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
                <Pressable
                  onPress={() => setOpen(expanded ? null : h.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${h.title}, ${h.category}. ${expanded ? 'Collapse' : 'Expand'} to read`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{h.title}</Text>
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{h.category} · {h.read_minutes} min read</Text>
                  </View>
                  {expanded ? <CaretDown size={18} color={color('text/secondary')} /> : <CaretRight size={18} color={color('text/secondary')} />}
                </Pressable>
                {expanded ? (
                  <View style={{ marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
                    <RichContent value={h.body} format={h.content_format} media={hackMedia} variant="explanation" />
                  </View>
                ) : null}
                {actions({ kind: 'hacks', id: h.id, title: h.title })}
              </View>
            );
          })
        ) : (
          decks.map((d) => {
            const expanded = open === d.id;
            const detail = deckCards[d.id];
            return (
              <View key={d.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
                <Pressable
                  onPress={() => toggleDeck(d.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${d.title}, ${d.card_count} cards. ${expanded ? 'Collapse' : 'Expand'} to see the cards`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{d.title}</Text>
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                      {d.card_count} card{d.card_count === 1 ? '' : 's'}{d.requires_subscription ? ' · subscribers' : ' · free'}
                    </Text>
                    {d.description ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={2}>{d.description}</Text> : null}
                  </View>
                  {expanded ? <CaretDown size={18} color={color('text/secondary')} /> : <CaretRight size={18} color={color('text/secondary')} />}
                </Pressable>
                {expanded ? (
                  <View style={{ marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color('border/subtle'), gap: space.sm }}>
                    {detail === 'loading' || detail == null ? (
                      <SkeletonBlock height={60} radius={radius.sm} />
                    ) : detail === 'error' ? (
                      <TextButton label="Couldn’t load the cards — tap to retry" onPress={() => { setOpen(null); void toggleDeck(d.id); }} />
                    ) : (
                      detail.cards.map((c, i) => (
                        <View key={c.id} style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm, gap: space['2xs'] }}>
                          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>CARD {i + 1} · FRONT</Text>
                          <RichContent value={c.front} format={c.content_format} media={detail.media} variant="option" />
                          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>BACK</Text>
                          <RichContent value={c.back} format={c.content_format} media={detail.media} variant="option" />
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
                {actions({ kind: 'decks', id: d.id, title: d.title })}
              </View>
            );
          })
        )}
      </ScrollView>

      <BottomSheet visible={!!rejecting} onClose={() => setRejecting(null)} title={`Reject “${rejecting?.title ?? ''}”`} dismissable={busy == null}>
        <View style={{ gap: space.md }}>
          <InputField label="Reason (sent to the author)" value={reason} onChangeText={setReason} multiline maxLength={500} />
          <PrimaryButton label="Reject" onPress={reject} loading={busy === rejecting?.id} disabled={reason.trim().length < 3} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

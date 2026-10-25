import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, CaretLeft, PencilSimple, Trash, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, StatusBadge, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, RichField, plainText, type MediaMap, type MediaView } from '@/src/rich';
import { ApiError } from '@/src/api/client';
import { getCurriculum, listCourses } from '@/src/api/courses';
import {
  addCard, createDeck, deleteCard, deleteDeck, getTeacherDeck, isDeckEditable, publishDeck, reorderCards, submitDeck, updateCard, updateDeck,
  type TeacherCard, type TeacherDeck,
} from '@/src/api/flashcardsTeacher';
import { DECK_BADGE } from '@/src/flashcards/deckBadge';

const MAX_SIDE = 1000;
type Opt = { value: string; label: string };
type CardDraft = { id?: string; front: string; back: string };

/**
 * Teacher deck editor (FE-6.3): deck details, cards (rich text + images),
 * reorder, and the draft → review → publish lifecycle. Everything is
 * read-only unless the deck is a draft or was rejected (server-enforced too).
 */
export default function FlashcardDeckRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const params = useLocalSearchParams<{ id?: string }>();

  const [deckId, setDeckId] = useState<string | null>(params.id ? String(params.id) : null);
  const [deck, setDeck] = useState<TeacherDeck | null>(null);
  const [cards, setCards] = useState<TeacherCard[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(params.id ? 'loading' : 'ready');

  // details form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [free, setFree] = useState(false);
  const [courses, setCourses] = useState<Opt[]>([]);
  const [tree, setTree] = useState<{ id: string; name: string; chapters: { id: string; name: string }[] }[]>([]);

  const [card, setCard] = useState<CardDraft | null>(null);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<TeacherCard | null>(null);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const editable = !deck || isDeckEditable(deck.status);

  const fillForm = (d: TeacherDeck) => {
    setTitle(d.title);
    setDescription(d.description ?? '');
    setCourseId(d.course_id);
    setSubjectId(d.subject_id ?? undefined);
    setChapterId(d.chapter_id ?? undefined);
    setFree(!d.requires_subscription);
  };

  const load = useCallback(async () => {
    if (!deckId) return;
    setStatus('loading');
    try {
      const r = await getTeacherDeck(deckId);
      setDeck(r.deck);
      setCards(r.cards);
      setMedia(r.media);
      fillForm(r.deck);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listCourses()
      .then((r) => {
        const opts = (r.courses ?? []).map((c) => ({ value: c.id, label: c.name }));
        setCourses(opts);
        setCourseId((cur) => cur ?? opts[0]?.value);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!courseId) return setTree([]);
    getCurriculum(courseId)
      .then((r) => setTree((r.course.subjects ?? []).map((s) => ({ id: s.id, name: s.name, chapters: (s.chapters ?? []).map((c) => ({ id: c.id, name: c.name })) }))))
      .catch(() => setTree([]));
  }, [courseId]);

  const subjectOpts = useMemo(() => tree.map((s) => ({ value: s.id, label: s.name })), [tree]);
  const chapterOpts = useMemo(() => (tree.find((s) => s.id === subjectId)?.chapters ?? []).map((c) => ({ value: c.id, label: c.name })), [tree, subjectId]);

  const titleError = title.trim().length === 0 ? 'Give the deck a title.' : title.trim().length > 120 ? 'Keep it under 120 characters.' : null;
  const detailsDirty = !deck
    || deck.title !== title.trim() || (deck.description ?? '') !== description.trim() || deck.course_id !== courseId
    || (deck.subject_id ?? undefined) !== subjectId || (deck.chapter_id ?? undefined) !== chapterId || deck.requires_subscription === free;

  const saveDetails = async () => {
    if (titleError || !courseId) return;
    setBusy('details');
    const body = {
      title: title.trim(), description: description.trim(), course_id: courseId,
      subject_id: subjectId ?? '', chapter_id: chapterId ?? '', requires_subscription: !free,
    };
    try {
      if (deck) {
        const d = await updateDeck(deck.id, body);
        setDeck({ ...deck, ...d });
        show('Deck saved', 'success');
      } else {
        const d = await createDeck(body);
        setDeck(d);
        setDeckId(d.id);
        router.setParams({ id: d.id });
        show('Deck created — now add cards', 'success');
      }
    } catch (e) {
      show(e instanceof ApiError && e.code === 'locked' ? 'This deck can’t be edited right now.' : 'Couldn’t save the deck. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveCard = async () => {
    if (!deck || !card) return;
    setBusy('card');
    try {
      const r = card.id ? await updateCard(card.id, { front: card.front.trim(), back: card.back.trim() }) : await addCard(deck.id, { front: card.front.trim(), back: card.back.trim() });
      setMedia((m) => ({ ...m, ...r.media }));
      setCards((cs) => (card.id ? cs.map((c) => (c.id === card.id ? r.card : c)) : [...cs, r.card]));
      if (!card.id) setDeck((d) => (d ? { ...d, card_count: d.card_count + 1 } : d));
      setCard(null);
    } catch (e) {
      show(e instanceof ApiError && e.code === 'locked' ? 'Cards can only be changed while the deck is a draft.' : 'Couldn’t save the card. Your text is still here — try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeCard = async () => {
    const c = confirmDeleteCard;
    if (!c) return;
    setBusy('delcard');
    try {
      await deleteCard(c.id);
      setCards((cs) => cs.filter((x) => x.id !== c.id));
      setDeck((d) => (d ? { ...d, card_count: Math.max(0, d.card_count - 1) } : d));
      setConfirmDeleteCard(null);
    } catch {
      show('Couldn’t delete the card.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    if (!deck) return;
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const prev = cards;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    setCards(next); // optimistic
    try {
      await reorderCards(deck.id, next.map((c) => c.id));
    } catch {
      setCards(prev);
      show('Couldn’t reorder. Try again.', 'error');
    }
  };

  const lifecycle = async (action: 'submit' | 'publish') => {
    if (!deck) return;
    setBusy(action);
    try {
      if (action === 'submit') {
        await submitDeck(deck.id);
        setDeck({ ...deck, status: 'pending_review', rejection_reason: undefined });
        show('Submitted for review', 'success');
      } else {
        await publishDeck(deck.id);
        setDeck({ ...deck, status: 'published' });
        show('Published — students can study it now', 'success');
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      show(code === 'incomplete' ? 'Add at least one card first.' : code === 'not_approved' ? 'Only approved decks can be published.' : 'Something went wrong. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeDeck = async () => {
    if (!deck) return;
    setBusy('deldeck');
    try {
      await deleteDeck(deck.id);
      show('Deck deleted', 'success');
      router.back();
    } catch {
      show('Couldn’t delete the deck.', 'error');
      setBusy(null);
    }
  };

  const onMedia = (v: MediaView) => setMedia((m) => ({ ...m, [v.id]: v }));
  const cardValid = !!card && plainText(card.front, 'rich_v1').trim().length + (/!\[/.test(card.front) ? 1 : 0) > 0
    && plainText(card.back, 'rich_v1').trim().length + (/!\[/.test(card.back) ? 1 : 0) > 0
    && card.front.length <= MAX_SIDE && card.back.length <= MAX_SIDE;
  const badge = deck ? DECK_BADGE[deck.status] ?? DECK_BADGE.draft : null;

  if (status === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas'), padding: space.md, gap: space.sm }}>
        <SkeletonBlock height={40} radius={radius.sm} />
        <SkeletonBlock height={160} radius={radius.md} />
        <SkeletonBlock height={120} radius={radius.md} />
      </SafeAreaView>
    );
  }
  if (status === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas'), justifyContent: 'center' }}>
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load this deck"
          description="Check your connection and try again."
          action={<TextButton label="Retry" onPress={load} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md, gap: space.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h2'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>
          {deck ? deck.title : 'New deck'}
        </Text>
        {badge ? <StatusBadge status={badge.status} label={badge.label} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled">
        {deck?.status === 'rejected' && deck.rejection_reason ? (
          <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.md, padding: space.md }}>
            <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>REVIEWER FEEDBACK</Text>
            <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>{deck.rejection_reason}</Text>
          </View>
        ) : null}
        {deck && !editable ? (
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
            {deck.status === 'pending_review' ? 'This deck is with a reviewer — editing is locked until they respond.' : 'Approved and live decks can’t be edited.'}
          </Text>
        ) : null}

        {/* Details */}
        <View style={{ gap: space.sm }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>Details</Text>
          <InputField label="Title" value={title} onChangeText={setTitle} maxLength={120} editable={editable} error={deck || title ? titleError ?? undefined : undefined} />
          <InputField label="Description (optional)" value={description} onChangeText={setDescription} multiline maxLength={500} editable={editable} />
          <SelectField
            label="Course"
            value={courseId}
            options={courses}
            onChange={(v) => { setCourseId(v); setSubjectId(undefined); setChapterId(undefined); }}
            disabled={!editable || !!deck}
            disabledHint={deck ? 'The course is fixed once a deck is created' : undefined}
          />
          <SelectField label="Subject (optional)" value={subjectId} options={subjectOpts} allowClear onChange={(v) => { setSubjectId(v); setChapterId(undefined); }} disabled={!editable || subjectOpts.length === 0} />
          <SelectField label="Chapter (optional)" value={chapterId} options={chapterOpts} allowClear onChange={setChapterId} disabled={!editable || !subjectId} disabledHint={!subjectId ? 'Pick a subject first' : undefined} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Free for everyone</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Off = subscribers only</Text>
            </View>
            <Switch value={free} onValueChange={setFree} disabled={!editable} accessibilityLabel="Free for everyone" />
          </View>
          {editable && detailsDirty ? (
            <PrimaryButton label={deck ? 'Save details' : 'Create deck'} onPress={saveDetails} loading={busy === 'details'} disabled={!!titleError || !courseId} />
          ) : null}
        </View>

        {/* Cards */}
        {deck ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>Cards ({cards.length})</Text>
              {editable ? <TextButton label="+ Add card" onPress={() => setCard({ front: '', back: '' })} /> : null}
            </View>
            {cards.length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No cards yet. Each card has a prompt on the front and the answer on the back.</Text>
            ) : (
              cards.map((c, i) => (
                <View key={c.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space['2xs'] }}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>CARD {i + 1} · FRONT</Text>
                  <RichContent value={c.front} format={c.content_format} media={media} variant="option" />
                  <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>BACK</Text>
                  <RichContent value={c.back} format={c.content_format} media={media} variant="option" />
                  {editable ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs, marginTop: space.xs }}>
                      <IconBtn label={`Move card ${i + 1} up`} disabled={i === 0} onPress={() => move(i, -1)} icon={<ArrowUp size={18} color={color('text/secondary')} />} />
                      <IconBtn label={`Move card ${i + 1} down`} disabled={i === cards.length - 1} onPress={() => move(i, 1)} icon={<ArrowDown size={18} color={color('text/secondary')} />} />
                      <IconBtn label={`Edit card ${i + 1}`} onPress={() => setCard({ id: c.id, front: c.front, back: c.back })} icon={<PencilSimple size={18} color={color('text/secondary')} />} />
                      <IconBtn label={`Delete card ${i + 1}`} onPress={() => setConfirmDeleteCard(c)} icon={<Trash size={18} color={color('semantic/danger')} />} />
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* Lifecycle */}
        {deck ? (
          <View style={{ gap: space.sm }}>
            {editable ? (
              <PrimaryButton
                label={deck.status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
                onPress={() => lifecycle('submit')}
                loading={busy === 'submit'}
                disabled={cards.length === 0 || detailsDirty}
              />
            ) : null}
            {editable && detailsDirty ? <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Save the details first.</Text> : null}
            {deck.status === 'approved' ? <PrimaryButton label="Publish" onPress={() => lifecycle('publish')} loading={busy === 'publish'} /> : null}
            {editable ? (
              <View style={{ alignItems: 'center' }}>
                <TextButton label="Delete deck" onPress={() => setConfirmDeleteDeck(true)} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!card} onClose={() => setCard(null)} title={card?.id ? 'Edit card' : 'New card'} dismissable={busy !== 'card'} maxHeightPct={0.92}>
        {card ? (
          <View style={{ gap: space.md }}>
            <RichField label="Front (prompt)" required value={card.front} onChange={(v) => setCard((c) => (c ? { ...c, front: v } : c))} media={media} onMedia={onMedia} purpose="flashcard_image" maxChars={MAX_SIDE} minLines={2} maxImages={1} />
            <RichField label="Back (answer)" required value={card.back} onChange={(v) => setCard((c) => (c ? { ...c, back: v } : c))} media={media} onMedia={onMedia} purpose="flashcard_image" maxChars={MAX_SIDE} minLines={2} maxImages={1} />
            <PrimaryButton label="Save card" onPress={saveCard} loading={busy === 'card'} disabled={!cardValid} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!confirmDeleteCard} onClose={() => setConfirmDeleteCard(null)} title="Delete this card?" dismissable={busy !== 'delcard'}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirmDeleteCard(null)} style={{ flex: 1 }} />
          <PrimaryButton label="Delete" onPress={removeCard} loading={busy === 'delcard'} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={confirmDeleteDeck} onClose={() => setConfirmDeleteDeck(false)} title="Delete this deck?" dismissable={busy !== 'deldeck'}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>The deck and all its cards are removed permanently.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirmDeleteDeck(false)} style={{ flex: 1 }} />
          <PrimaryButton label="Delete" onPress={removeDeck} loading={busy === 'deldeck'} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function IconBtn({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  const { color, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: color('bg/sunken'), opacity: disabled ? 0.4 : 1 }}
    >
      {icon}
    </Pressable>
  );
}

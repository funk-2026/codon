import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePdf } from 'phosphor-react-native';
import { BottomSheet, ConfirmDialog, EmptyState, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SelectField, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminCreateReferenceDoc, adminDeleteReferenceDoc, adminListReferenceDocs, adminUpdateReferenceDoc, type RefKind, type ReferenceDoc } from '@/src/api/reference';
import { pickAndUploadPdf } from '@/src/content/lecturePdf';
import { ApiError } from '@/src/api/client';

const KINDS: { value: RefKind; label: string }[] = [
  { value: 'howto', label: 'How-to guide' },
  { value: 'policy', label: 'Help or policy' },
  { value: 'pattern', label: 'Paper pattern (view only)' },
  { value: 'past_paper', label: 'Past year paper' },
  { value: 'practice_paper', label: 'Practice question paper' },
  { value: 'weightage', label: 'Weightage' },
  { value: 'schema', label: 'NEET-UG Schema PDF' },
];
const SLUGS: Record<string, { value: string; label: string }[]> = {
  howto: [['flashcards', 'Flashcards'], ['pulse', 'Pulse'], ['schema', 'Schema'], ['qbank', 'QBank'], ['test_series', 'Test series'], ['videos', 'Videos'], ['fourth_book', 'Fourth Book']].map(([value, label]) => ({ value, label })),
  policy: [['faq', 'Frequently asked questions'], ['device_policy', 'Device policy'], ['video_troubleshooting', 'Video troubleshooting'], ['piracy_report', 'Report video piracy']].map(([value, label]) => ({ value, label })),
};
const BOARD_KINDS: RefKind[] = ['pattern', 'past_paper', 'practice_paper', 'weightage'];
const YEAR_KINDS: RefKind[] = ['past_paper', 'practice_paper'];

type Draft = { id?: string; kind: RefKind; title: string; class: string; board: string; subject: string; year: string; slug: string; fileKey?: string; fileName?: string };
const EMPTY: Draft = { kind: 'past_paper', title: '', class: '10', board: '', subject: '', year: '', slug: '' };

/** Every uploaded PDF the app shows: how-to guides, help and policy files, Class 10 board papers and the Schema PDF. */
export default function ReferenceDocsRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'reference-docs'], queryFn: () => adminListReferenceDocs() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<ReferenceDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'reference-docs'] });

  const kind = draft?.kind;
  const needsBoard = !!kind && BOARD_KINDS.includes(kind);
  const needsYear = !!kind && YEAR_KINDS.includes(kind);
  const needsSlug = kind === 'howto' || kind === 'policy';
  const yearNum = Number(draft?.year);
  const valid = !!draft && draft.title.trim().length >= 3 && !!(draft.fileKey || draft.id)
    && (!needsSlug || !!draft.slug) && (!needsBoard || (!!draft.board.trim() && !!draft.subject.trim() && (!needsYear || (yearNum >= 1990 && yearNum <= 2100))));

  const choosePdf = async () => {
    setPct(0);
    try {
      const r = await pickAndUploadPdf((p) => setPct(p), 'reference_pdf');
      if (r) setDraft((d) => (d ? { ...d, fileKey: r.key, fileName: r.name } : d));
    } catch (e) {
      show(e instanceof Error ? e.message : 'Couldn’t upload the PDF.', 'error');
    } finally {
      setPct(null);
    }
  };

  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const body = {
        kind: draft.kind, title: draft.title.trim(), slug: needsSlug ? draft.slug : '',
        class: needsBoard ? draft.class.trim() : '', board: needsBoard ? draft.board.trim() : '', subject: needsBoard ? draft.subject.trim() : '',
        ...(needsYear ? { year: yearNum } : { clear_year: true }),
        ...(draft.fileKey ? { file_key: draft.fileKey, file_name: draft.fileName } : {}),
      };
      if (draft.id) await adminUpdateReferenceDoc(draft.id, body);
      else await adminCreateReferenceDoc(body);
      await refresh();
      setDraft(null);
      show(draft.id ? 'Document updated' : 'Document added', 'success');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Couldn’t save the document.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (d: ReferenceDoc, on: boolean) => {
    try {
      await adminUpdateReferenceDoc(d.id, { is_active: on });
      await refresh();
    } catch {
      show('Couldn’t change that document.', 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminDeleteReferenceDoc(deleting.id);
      await refresh();
      show('Document deleted', 'success');
    } catch {
      show('Couldn’t delete it.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const docs = q.data ?? [];
  const groups = KINDS.map((k) => ({ ...k, items: docs.filter((d) => d.kind === k.value) })).filter((g) => g.items.length > 0);

  return (
    <Screen>
      <ScreenHeader title="Documents" right={<TextButton label="Add" onPress={() => setDraft({ ...EMPTY })} />} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] + insets.bottom }}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>PDFs students read in the app. Switch one off to hide it without deleting.</Text>
        {q.isPending ? (
          <SkeletonBlock height={200} radius={radius.lg} />
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<FilePdf size={32} color={color('text/tertiary')} />} title="No documents yet" description="Add how-to guides, board papers, weightage charts and the Schema PDF." action={<PrimaryButton label="Add a document" onPress={() => setDraft({ ...EMPTY })} />} />
        ) : (
          groups.map((g) => (
            <View key={g.value} style={{ gap: space.xs }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{g.label.toUpperCase()}</Text>
              {g.items.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDraft({ id: d.id, kind: d.kind, title: d.title, class: d.class ?? '', board: d.board ?? '', subject: d.subject ?? '', year: d.year ? String(d.year) : '', slug: d.slug ?? '', fileName: d.file_name })}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{d.title}</Text>
                    <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>
                      {[d.class ? `Class ${d.class}` : null, d.board, d.subject, d.year ? String(d.year) : null, d.slug || null].filter(Boolean).join(' · ') || 'No details'}
                    </Text>
                  </View>
                  <Switch value={d.is_active} onValueChange={(v) => void toggle(d, v)} accessibilityLabel={`${d.title} is shown to students`} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={!!draft} onClose={() => !busy && setDraft(null)} title={draft?.id ? 'Edit document' : 'Add a document'} maxHeightPct={0.92} dismissable={!busy}>
        {draft ? (
          <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">
            <SelectField label="Kind" value={draft.kind} options={KINDS} onChange={(v) => v && setDraft({ ...draft, kind: v as RefKind, slug: '' })} disabled={!!draft.id} />
            {needsSlug ? <SelectField label={kind === 'howto' ? 'Which feature' : 'Which document'} value={draft.slug || undefined} options={SLUGS[kind!]} onChange={(v) => setDraft({ ...draft, slug: v ?? '' })} /> : null}
            <InputField label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} maxLength={160} />
            {needsBoard ? (
              <>
                <InputField label="Class" value={draft.class} onChangeText={(t) => setDraft({ ...draft, class: t })} placeholder="10" maxLength={10} />
                <InputField label="Board or state" value={draft.board} onChangeText={(t) => setDraft({ ...draft, board: t })} placeholder="CBSE, ICSE, Maharashtra…" maxLength={80} />
                <InputField label="Subject" value={draft.subject} onChangeText={(t) => setDraft({ ...draft, subject: t })} placeholder="Mathematics" maxLength={80} />
              </>
            ) : null}
            {needsYear ? <InputField label="Year" value={draft.year} onChangeText={(t) => setDraft({ ...draft, year: t.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={4} placeholder="2025" /> : null}
            <View style={{ gap: space.xs }}>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>PDF</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{draft.fileKey ? `Ready to save: ${draft.fileName}` : draft.fileName ? `Current: ${draft.fileName}` : 'No file chosen'}</Text>
              <SecondaryButton label={pct != null ? `Uploading ${Math.round(pct * 100)}%` : draft.fileKey || draft.fileName ? 'Choose a different PDF' : 'Choose a PDF'} onPress={() => void choosePdf()} disabled={pct != null} />
            </View>
            <PrimaryButton label={draft.id ? 'Save changes' : 'Add document'} onPress={() => void save()} loading={busy} disabled={!valid || pct != null} />
            {draft.id ? <TextButton label="Delete this document" onPress={() => { const d = docs.find((x) => x.id === draft.id); if (d) { setDraft(null); setDeleting(d); } }} /> : null}
          </ScrollView>
        ) : null}
      </BottomSheet>

      <ConfirmDialog visible={!!deleting} tone="danger" title="Delete this document?" message={`“${deleting?.title ?? ''}” disappears for every student.`} confirmLabel="Delete" onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
    </Screen>
  );
}

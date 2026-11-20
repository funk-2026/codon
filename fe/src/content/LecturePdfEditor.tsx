import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { FilePdf } from 'phosphor-react-native';
import { TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { pickAndUploadPdf } from './lecturePdf';

export type PdfKind = 'annotated' | 'notes' | 'fourth_book' | 'board_questions';
export const PDF_KINDS: PdfKind[] = ['annotated', 'notes', 'fourth_book', 'board_questions'];
/** The request field each type is saved in. */
export const PDF_FIELD: Record<PdfKind, 'annotated_pdf_key' | 'notes_pdf_key' | 'fourth_book_pdf_key' | 'board_questions_pdf_key'> = {
  annotated: 'annotated_pdf_key', notes: 'notes_pdf_key', fourth_book: 'fourth_book_pdf_key', board_questions: 'board_questions_pdf_key',
};
export const EMPTY_PDF_SLOTS: Record<PdfKind, PdfSlot> = { annotated: { present: false }, notes: { present: false }, fourth_book: { present: false }, board_questions: { present: false } };
export type PdfSlot = { present: boolean; name?: string };

const META: Record<PdfKind, { title: string; hint: string }> = {
  annotated: { title: 'Annotated PDF', hint: 'What you wrote while teaching. Unlocks for a student after they watch the lecture.' },
  notes: { title: 'Unannotated PDF', hint: 'The clean lecture notes. Students can open them any time.' },
  fourth_book: { title: 'Fourth Book', hint: 'The matching chapter from the Fourth Book.' },
  board_questions: { title: 'Board Exam Questions', hint: 'Board exam questions on this chapter.' },
};

/**
 * Teacher: attach / replace / remove a lecture's two PDFs. Uploads happen
 * here; the parent decides what to do with the resulting key (keep it for
 * "create", or save it straight away on an existing lecture).
 */
export function LecturePdfEditor({
  slots, onChange, disabled,
}: { slots: Record<PdfKind, PdfSlot>; onChange: (kind: PdfKind, key: string | null, name?: string) => Promise<void> | void; disabled?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [busy, setBusy] = useState<{ kind: PdfKind; pct: number } | null>(null);

  const attach = async (kind: PdfKind) => {
    setBusy({ kind, pct: 0 });
    try {
      const picked = await pickAndUploadPdf((pct) => setBusy({ kind, pct }));
      if (picked) await onChange(kind, picked.key, picked.name);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Couldn’t upload the PDF.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: PdfKind) => {
    setBusy({ kind, pct: 1 });
    try {
      await onChange(kind, null);
    } catch {
      show('Couldn’t remove the PDF.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      {PDF_KINDS.map((kind) => {
        const slot = slots[kind];
        const uploading = busy?.kind === kind;
        return (
          <View key={kind} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <FilePdf size={24} color={slot.present ? color('accent/default') : color('text/tertiary')} />
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{META[kind].title}</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={1}>
                  {uploading ? `Uploading… ${Math.round(busy!.pct * 100)}%` : slot.present ? slot.name ?? 'Attached' : 'Not attached (optional)'}
                </Text>
              </View>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{META[kind].hint}</Text>
            {uploading ? (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: color('bg/sunken') }}>
                <View style={{ width: `${Math.round(busy!.pct * 100)}%`, height: 4, borderRadius: 2, backgroundColor: color('accent/default') }} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <TextButton label={slot.present ? 'Replace' : 'Attach PDF'} onPress={() => attach(kind)} disabled={disabled || !!busy} />
                {slot.present ? <TextButton label="Remove" onPress={() => remove(kind)} disabled={disabled || !!busy} /> : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

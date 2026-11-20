import type { LecturePDFs } from '@/src/api/content';

export type PdfKind4 = 'annotated' | 'unannotated' | 'fourth_book' | 'board_questions';

/** The four PDF types, in this order. A type appears only when its PDF has been uploaded. */
export function pdfChoices(p: LecturePDFs): { kind: PdfKind4; label: string; sub: string; url?: string; locked?: boolean }[] {
  const out: { kind: PdfKind4; label: string; sub: string; url?: string; locked?: boolean }[] = [];
  if (p.has_annotated_pdf) out.push({ kind: 'annotated', label: 'Annotated PDF', sub: p.annotated_pdf_locked ? 'Unlocks after you watch the lecture' : 'Everything written during the lecture', url: p.annotated_pdf_url, locked: !!p.annotated_pdf_locked });
  if (p.has_notes_pdf) out.push({ kind: 'unannotated', label: 'Unannotated PDF', sub: 'The lecture notes', url: p.notes_pdf_url });
  if (p.has_fourth_book_pdf) out.push({ kind: 'fourth_book', label: 'Fourth Book', sub: 'This chapter in the Fourth Book', url: p.fourth_book_pdf_url });
  if (p.has_board_questions_pdf) out.push({ kind: 'board_questions', label: 'Board Exam Questions', sub: 'Questions from board exams', url: p.board_questions_pdf_url });
  return out;
}


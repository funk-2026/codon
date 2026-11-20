import { pdfChoices } from '../pdfChoices';

describe('lecture PDF types', () => {
  it('lists the four types in order, only those uploaded', () => {
    const all = pdfChoices({ has_annotated_pdf: true, has_notes_pdf: true, has_fourth_book_pdf: true, has_board_questions_pdf: true });
    expect(all.map((c) => c.label)).toEqual(['Annotated PDF', 'Unannotated PDF', 'Fourth Book', 'Board Exam Questions']);
    const some = pdfChoices({ has_annotated_pdf: false, has_notes_pdf: true, has_board_questions_pdf: true });
    expect(some.map((c) => c.label)).toEqual(['Unannotated PDF', 'Board Exam Questions']);
    expect(pdfChoices({ has_annotated_pdf: false, has_notes_pdf: false })).toEqual([]);
  });
  it('keeps the annotated PDF locked until the lecture is watched', () => {
    expect(pdfChoices({ has_annotated_pdf: true, has_notes_pdf: false, annotated_pdf_locked: true })[0].locked).toBe(true);
  });
});

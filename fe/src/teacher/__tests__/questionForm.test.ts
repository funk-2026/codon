import { contentChanged, EMPTY_DRAFT, fromQuestion, isDirty, isValid, softWarnings, toRequest, validateDraft, type FormDraft } from '../questionForm';

const ID = '11111111-2222-3333-4444-555555555555';
const good: FormDraft = { ...EMPTY_DRAFT, question_text: 'What?', option_a: 'A1', option_b: 'B1', option_c: 'C1', option_d: 'D1', correct_option: 'B' };

describe('validateDraft', () => {
  it('accepts a complete question', () => expect(isValid(validateDraft(good))).toBe(true));
  it('requires stem, options and a correct answer', () => {
    const e = validateDraft(EMPTY_DRAFT);
    expect(Object.keys(e).sort()).toEqual(['correct_option', 'option_a', 'option_b', 'option_c', 'option_d', 'question_text']);
  });
  it('an image alone is valid content for a stem or an option', () => {
    const img = `![diagram](media:${ID})`;
    expect(isValid(validateDraft({ ...good, question_text: img, option_a: img.replace(ID, '22222222-2222-3333-4444-555555555555') }))).toBe(true);
  });
  it('flags identical options', () => {
    const e = validateDraft({ ...good, option_c: 'a1' });
    expect(e.option_c).toMatch(/earlier option/);
  });
  it('enforces character budgets', () => {
    expect(validateDraft({ ...good, question_text: 'x'.repeat(2001) }).question_text).toMatch(/at most 2000/);
    expect(validateDraft({ ...good, option_b: 'x'.repeat(501) }).option_b).toMatch(/at most 500/);
    expect(validateDraft({ ...good, explanation: 'x'.repeat(4001) }).explanation).toMatch(/at most 4000/);
  });
  it('caps images per question across all fields', () => {
    const mk = (n: number) => `![](media:00000000-0000-0000-0000-00000000000${n})`;
    const e = validateDraft({ ...good, question_text: `${mk(1)}\n\n${mk(2)}`, option_a: mk(3), option_b: mk(4), explanation: `${mk(5)}\n\n${mk(6)}\n\n${mk(7)}` });
    expect(e.images).toMatch(/At most 6/);
  });
  it('validates metadata ranges', () => {
    expect(validateDraft({ ...good, ncert_class: '13' }).ncert_class).toBeDefined();
    expect(validateDraft({ ...good, ncert_page: '0' }).ncert_page).toBeDefined();
    expect(validateDraft({ ...good, source_year: '1800' }).source_year).toBeDefined();
    expect(isValid(validateDraft({ ...good, ncert_class: '11', ncert_page: '45', source_year: '2023' }))).toBe(true);
  });
});

describe('softWarnings', () => {
  it('nudges about missing explanation/difficulty/chapter', () => expect(softWarnings(good)).toHaveLength(3));
  it('is quiet when complete', () => expect(softWarnings({ ...good, explanation: 'why', difficulty: 'easy', chapter_id: 'c' })).toHaveLength(0));
});

describe('toRequest', () => {
  it('always sends rich_v1 and trims', () => {
    const r = toRequest({ ...good, question_text: '  What?  ', explanation: '' });
    expect(r.content_format).toBe('rich_v1');
    expect(r.question_text).toBe('What?');
    expect(r.explanation).toBe(''); // empty string clears on update
  });
  it('omits unset metadata but includes what is set', () => {
    const r = toRequest({ ...good, difficulty: 'hard', ncert_class: '11', ncert_page: '', source_year: '2022', tags: ['x'] });
    expect(r.difficulty).toBe('hard');
    expect(r.ncert_class).toBe(11);
    expect('ncert_page' in r).toBe(false);
    expect(r.source_year).toBe(2022);
    expect(r.tags).toEqual(['x']);
    expect('subject_id' in r).toBe(false);
  });
});

describe('fromQuestion / dirty tracking', () => {
  const q: any = { id: 'q', test_id: 't', content_format: 'rich_v1', question_text: 'Q', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_option: 'C', explanation: 'e', difficulty: 'easy', ncert_page: 12, tags: [{ id: '1', label: 'genetics' }] };
  it('round-trips through the form', () => {
    const d = fromQuestion(q);
    expect(d.correct_option).toBe('C');
    expect(d.ncert_page).toBe('12');
    expect(d.tags).toEqual(['genetics']);
    expect(isDirty(d, fromQuestion(q))).toBe(false);
  });
  it('detects changes, ignoring tag order', () => {
    const d = fromQuestion({ ...q, tags: [{ label: 'a' }, { label: 'b' }] });
    expect(isDirty(d, { ...d, tags: ['b', 'a'] })).toBe(false);
    expect(isDirty(d, { ...d, explanation: 'x' })).toBe(true);
  });
  it('separates content edits from metadata-only edits (which skip review on live questions)', () => {
    const d = fromQuestion(q);
    expect(contentChanged(d, { ...d, difficulty: 'hard' })).toBe(false);
    expect(contentChanged(d, { ...d, option_a: 'z' })).toBe(true);
    expect(contentChanged(d, { ...d, correct_option: 'A' })).toBe(true);
  });
});

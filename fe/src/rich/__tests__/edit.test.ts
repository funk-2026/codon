import { imageAlt, insertAt, insertImage, removeImage, setImageAlt, toggleList, wrapSelection } from '../edit';
import { mediaRefs, parse } from '../parse';

const ID = '11111111-2222-3333-4444-555555555555';

describe('wrapSelection', () => {
  it('wraps a selection', () => {
    const r = wrapSelection('hello world', { start: 6, end: 11 }, '**');
    expect(r.text).toBe('hello **world**');
    expect(r.selection).toEqual({ start: 8, end: 13 });
  });
  it('inserts an empty pair with the cursor inside when nothing is selected', () => {
    const r = wrapSelection('ab', { start: 1, end: 1 }, '~');
    expect(r.text).toBe('a~~b');
    expect(r.selection).toEqual({ start: 2, end: 2 });
  });
  it('toggles off when the selection is already wrapped', () => {
    const r = wrapSelection('a **b** c', { start: 2, end: 7 }, '**');
    expect(r.text).toBe('a b c');
  });
  it('tolerates reversed / out-of-range selections', () => {
    expect(wrapSelection('abc', { start: 9, end: 1 }, '*').text).toBe('a*bc*');
    expect(wrapSelection('abc', { start: -5, end: 99 }, '*').text).toBe('*abc*');
  });
  it('sub/sup/math produce markup the parser understands', () => {
    const sub = wrapSelection('H2O', { start: 1, end: 2 }, '~');
    expect(sub.text).toBe('H~2~O');
    expect(JSON.stringify(parse(sub.text, 'rich_v1'))).toContain('"sub"');
    const sup = wrapSelection('x2', { start: 1, end: 2 }, '^');
    expect(JSON.stringify(parse(sup.text, 'rich_v1'))).toContain('"sup"');
    const math = wrapSelection('a+b', { start: 0, end: 3 }, '$');
    expect(JSON.stringify(parse(math.text, 'rich_v1'))).toContain('"math"');
  });
});

describe('insertAt', () => {
  it('inserts and moves the cursor after', () => {
    expect(insertAt('ab', { start: 1, end: 1 }, 'XY')).toEqual({ text: 'aXYb', selection: { start: 3, end: 3 } });
  });
  it('replaces a selection', () => {
    expect(insertAt('abcd', { start: 1, end: 3 }, '-').text).toBe('a-d');
  });
});

describe('images', () => {
  it('inserts an image as its own block paragraph', () => {
    const r = insertImage('Look at this:', { start: 13, end: 13 }, ID, 'A cell');
    expect(r.text).toBe(`Look at this:\n\n![A cell](media:${ID})`);
    const blocks = parse(r.text, 'rich_v1');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'image_block']);
    expect(mediaRefs(r.text, 'rich_v1')).toEqual([ID]);
  });
  it('separates from text after the cursor', () => {
    const r = insertImage('ab', { start: 1, end: 1 }, ID);
    expect(parse(r.text, 'rich_v1').map((b) => b.type)).toEqual(['paragraph', 'image_block', 'paragraph']);
  });
  it('sanitises brackets/newlines in alt text', () => {
    const r = insertImage('', { start: 0, end: 0 }, ID, 'a [b]\nc');
    expect(parse(r.text, 'rich_v1')[0].type).toBe('image_block');
  });
  it('setImageAlt / imageAlt round-trip', () => {
    const t = `x\n\n![old](media:${ID})`;
    expect(imageAlt(t, ID)).toBe('old');
    const t2 = setImageAlt(t, ID, 'new alt');
    expect(imageAlt(t2, ID)).toBe('new alt');
    expect(mediaRefs(t2, 'rich_v1')).toEqual([ID]);
  });
  it('removeImage drops the reference and tidies blank lines', () => {
    const t = `before\n\n![alt](media:${ID})\n\nafter`;
    expect(removeImage(t, ID)).toBe('before\n\nafter');
    expect(removeImage(`![a](media:${ID})`, ID)).toBe('');
  });
});

describe('toggleList', () => {
  it('adds bullets to selected lines and removes them again', () => {
    const on = toggleList('a\nb', { start: 0, end: 3 });
    expect(on.text).toBe('- a\n- b');
    expect(toggleList(on.text, { start: 0, end: on.text.length }).text).toBe('a\nb');
  });
  it('numbers ordered lists', () => {
    expect(toggleList('a\nb', { start: 0, end: 3 }, true).text).toBe('1. a\n2. b');
  });
  it('produces a list block the parser understands', () => {
    const r = toggleList('one\ntwo', { start: 0, end: 7 });
    expect(parse(r.text, 'rich_v1')[0].type).toBe('list');
  });
});

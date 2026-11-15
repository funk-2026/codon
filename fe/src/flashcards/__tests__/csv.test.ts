import { parseCards, splitCsv } from '../csv';

describe('splitCsv', () => {
  it('handles quotes, commas and line breaks inside quotes', () => {
    expect(splitCsv('a,"b, c"\n"line1\nline2","say ""hi"""\n')).toEqual([['a', 'b, c'], ['line1\nline2', 'say "hi"']]);
  });
  it('copes with Windows line endings, a BOM and blank lines', () => {
    expect(splitCsv('﻿a,b\r\n\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('parseCards', () => {
  it('skips an optional header', () => {
    expect(parseCards('front,back\nQ1,A1').cards).toEqual([{ front: 'Q1', back: 'A1' }]);
    expect(parseCards('Q1,A1').cards).toEqual([{ front: 'Q1', back: 'A1' }]);
  });
  it('reports bad rows with their line numbers instead of dropping them silently', () => {
    const r = parseCards('front,back\nQ1,A1\nQ2,\n,A3\nQ4,A4');
    expect(r.cards).toHaveLength(2);
    expect(r.problems.map((p) => p.row)).toEqual([3, 4]);
  });
  it('stops at 500 cards', () => {
    const text = Array.from({ length: 502 }, (_, i) => `q${i},a${i}`).join('\n');
    const r = parseCards(text);
    expect(r.cards).toHaveLength(500);
    expect(r.problems).toHaveLength(2);
  });
});

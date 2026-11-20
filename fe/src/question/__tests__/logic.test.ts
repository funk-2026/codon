import { mcqId, questionShareText, referenceLines, tagChip, timerLabel } from '../logic';

describe('question helpers', () => {
  it('shortens the id and shapes the tag', () => {
    expect(mcqId('5f3a91c2-aaaa-bbbb-cccc-1234567890ab')).toBe('MCQ ID: 5f3a91c2');
    expect(tagChip('Image Based')).toBe('#ImageBased');
  });
  it('builds the reference only when there is a book', () => {
    expect(referenceLines({ book: 'Sample', edition: '8th', pages: '142-144' })).toEqual({ title: 'Sample, 8th edition', pages: 'Page nos 142-144' });
    expect(referenceLines({ book: 'Sample' })).toEqual({ title: 'Sample', pages: undefined });
    expect(referenceLines({ edition: '8th', pages: '1' })).toBeNull();
    expect(referenceLines({})).toBeNull();
  });
  it('shares the question and options only', () => {
    expect(questionShareText({ text: ' Q? ', a: '1', b: '2', c: '3', d: '4' })).toBe('Q?\n\nA. 1\nB. 2\nC. 3\nD. 4');
  });
  it('formats the countdown', () => {
    expect(timerLabel(120)).toBe('2:00');
    expect(timerLabel(61)).toBe('1:01');
    expect(timerLabel(-4)).toBe('0:00');
  });
});

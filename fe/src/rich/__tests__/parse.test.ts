import * as fs from 'fs';
import * as path from 'path';
import { hasContent, mediaRefs, parse, plainText } from '../parse';

type Vector = {
  name: string;
  format: string;
  input: string;
  ast: unknown[];
  plain: string;
  refs: string[];
};

const vectors: Vector[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../contracts/rich-text-v1/vectors.json'), 'utf8'),
).vectors;

describe('rich text v1 — shared golden vectors (same file the Go parser passes)', () => {
  it('loads a meaningful number of vectors', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(30);
  });
  it.each(vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(JSON.parse(JSON.stringify(parse(v.input, v.format)))).toEqual(v.ast ?? []);
    expect(plainText(v.input, v.format)).toBe(v.plain);
    expect(mediaRefs(v.input, v.format)).toEqual(v.refs);
  });
});

describe('robustness', () => {
  it('never throws on arbitrary input (fuzz)', () => {
    const alphabet = 'ab *_~^$!\\[]()\n-1.:media<>/';
    let seed = 1;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 5000; i++) {
      let s = '';
      const n = Math.floor(rnd() * 40);
      for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      expect(() => {
        parse(s, 'rich_v1');
        plainText(s, 'rich_v1');
        mediaRefs(s, 'rich_v1');
      }).not.toThrow();
    }
  });
  it('parses 4,000 characters quickly', () => {
    const big = ('Some **bold** text with H~2~O and $x^2$ and a list\n- one\n- two\n\n').repeat(60).slice(0, 4000);
    const t = Date.now();
    parse(big, 'rich_v1');
    expect(Date.now() - t).toBeLessThan(50);
  });
  it('hasContent treats an image-only option as content and blanks as empty', () => {
    expect(hasContent('   ', 'rich_v1')).toBe(false);
    expect(hasContent('![](media:11111111-1111-1111-1111-111111111111)', 'rich_v1')).toBe(true);
    expect(hasContent('x', 'plain')).toBe(true);
  });
});

import { parseMathJaxSvg, texToSvg } from '../mathSvg';

describe('texToSvg (MathJax, decision D14)', () => {
  it('typesets common NEET maths and chemistry', () => {
    for (const tex of ['\\frac{1}{2}mv^2', '\\sqrt{\\frac{GM}{r}}', '\\Delta G = \\Delta H - T\\Delta S', '\\ce{2H2 + O2 -> 2H2O}', '\\ce{CuSO4.5H2O}']) {
      const r = texToSvg(tex);
      expect(r).not.toBeNull();
      expect(r!.xml.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="')).toBe(true);
      expect(r!.widthEx).toBeGreaterThan(0);
      expect(r!.heightEx).toBeGreaterThan(0);
    }
  });

  it('returns null for TeX MathJax rejects (caller falls back to source)', () => {
    expect(texToSvg('\\notacommand{x}')).toBeNull();
    expect(texToSvg('\\frac{1}{')).toBeNull();
  });

  it('caches results', () => {
    const a = texToSvg('x^2 + y^2 = r^2');
    expect(texToSvg('x^2 + y^2 = r^2')).toBe(a);
  });

  it('display and inline are cached separately', () => {
    expect(texToSvg('\\sum_{i=1}^n i', true)).not.toBe(texToSvg('\\sum_{i=1}^n i', false));
  });
});

describe('parseMathJaxSvg', () => {
  it('extracts ex metrics and strips root sizing', () => {
    const r = parseMathJaxSvg('<svg style="vertical-align: -0.781ex;" xmlns="http://www.w3.org/2000/svg" width="5.867ex" height="2.725ex" role="img" focusable="false" viewBox="0 -859 2593 1204"><g/></svg>')!;
    expect(r).toEqual({ xml: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -859 2593 1204"><g/></svg>', widthEx: 5.867, heightEx: 2.725, verticalAlignEx: -0.781 });
  });
  it('rejects error output and non-svg', () => {
    expect(parseMathJaxSvg('<svg data-mjx-error="x" width="1ex" height="1ex" viewBox="0 0 1 1"></svg>')).toBeNull();
    expect(parseMathJaxSvg('oops')).toBeNull();
  });
});

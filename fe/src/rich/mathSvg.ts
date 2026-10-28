/**
 * TeX → SVG on the device with MathJax (decision D14, option b — see
 * docs/decisions/math-rendering.md). Pure JS: works offline, in Expo Go and in
 * builds without a native module. MathJax is loaded lazily on the first formula
 * and every result is cached, so Next/Prev never re-typesets.
 *
 * Returns null for TeX MathJax can't handle; callers fall back to showing the
 * TeX source, so a bad formula never breaks a question.
 */
export type MathSvg = {
  xml: string;
  /** Size and baseline offset in `ex`; multiply by EX_PER_FONT_PX × fontSize for pixels. */
  widthEx: number;
  heightEx: number;
  /** Negative = how far the formula sits below the text baseline. */
  verticalAlignEx: number;
};

/** One `ex` of the surrounding font, as a fraction of its font size (MathJax's default x-height). */
export const EX_PER_FONT_PX = 0.442;

type Converter = (tex: string, display: boolean) => string;
let converter: Converter | null | undefined;
const cache = new Map<string, MathSvg | null>();
const MAX_CACHE = 500;

function getConverter(): Converter | null {
  if (converter !== undefined) return converter;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { mathjax } = require('mathjax-full/js/mathjax.js');
    const { TeX } = require('mathjax-full/js/input/tex.js');
    const { SVG } = require('mathjax-full/js/output/svg.js');
    const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
    const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
    require('mathjax-full/js/input/tex/base/BaseConfiguration.js');
    require('mathjax-full/js/input/tex/ams/AmsConfiguration.js');
    require('mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document('', {
      InputJax: new TeX({ packages: ['base', 'ams', 'mhchem'] }),
      OutputJax: new SVG({ fontCache: 'none' }),
    });
    converter = (tex, display) => adaptor.innerHTML(doc.convert(tex, { display }));
  } catch {
    converter = null; // MathJax couldn't load in this runtime → TeX-source fallback everywhere
  }
  return converter;
}

const num = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m ? parseFloat(m[1]) : NaN;
};

/** Parses MathJax's SVG wrapper into an xml + ex metrics; null when MathJax reported an error. */
export function parseMathJaxSvg(svg: string): MathSvg | null {
  if (!svg.startsWith('<svg') || /data-mjx-error|merror/.test(svg)) return null;
  const widthEx = num(/width="([\d.]+)ex"/, svg);
  const heightEx = num(/height="([\d.]+)ex"/, svg);
  const verticalAlignEx = num(/vertical-align:\s*(-?[\d.]+)ex/, svg);
  if (!Number.isFinite(widthEx) || !Number.isFinite(heightEx)) return null;
  // react-native-svg sizes the element itself; drop MathJax's ex sizing/style from the root.
  const xml = svg.replace(/^<svg[^>]*?(\sviewBox="[^"]*")[^>]*>/, (open, viewBox) => `<svg xmlns="http://www.w3.org/2000/svg"${viewBox}>`);
  return { xml, widthEx, heightEx, verticalAlignEx: Number.isFinite(verticalAlignEx) ? verticalAlignEx : 0 };
}

export function texToSvg(tex: string, display = false): MathSvg | null {
  const key = `${display ? 'D' : 'I'}:${tex}`;
  if (cache.has(key)) return cache.get(key)!;
  const convert = getConverter();
  let out: MathSvg | null = null;
  if (convert) {
    try {
      out = parseMathJaxSvg(convert(tex, display));
    } catch {
      out = null;
    }
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

// "margin:1.2rem 0;--d:2"  ->  { margin: '1.2rem 0', '--d': '2' }   (keeps JSX terse for one-off styles)
export const s = (css) =>
  Object.fromEntries(
    css
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const i = x.indexOf(':');
        let k = x.slice(0, i).trim();
        const v = x.slice(i + 1).trim();
        if (!k.startsWith('--')) k = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return [k, v];
      }),
  );

export const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const stripHtml = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

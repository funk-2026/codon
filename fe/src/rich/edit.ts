/**
 * Pure text-editing helpers for the teacher's rich-text field (no React/native
 * imports → unit-tested). All functions take the current text + selection and
 * return the new text + the selection to restore, so the toolbar can never
 * corrupt what the teacher typed.
 */
export type Selection = { start: number; end: number };
export type EditResult = { text: string; selection: Selection };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const norm = (text: string, s: Selection): Selection => {
  const a = clamp(Math.min(s.start, s.end), 0, text.length);
  const b = clamp(Math.max(s.start, s.end), 0, text.length);
  return { start: a, end: b };
};

/** Wrap the selection in `open`/`close` (bold `**`, sub `~`, …); with no selection, insert a pair and put the cursor between. */
export function wrapSelection(text: string, sel: Selection, open: string, close: string = open): EditResult {
  const s = norm(text, sel);
  const chosen = text.slice(s.start, s.end);
  // Toggle off: selection already wrapped → unwrap.
  if (chosen.startsWith(open) && chosen.endsWith(close) && chosen.length >= open.length + close.length) {
    const inner = chosen.slice(open.length, chosen.length - close.length);
    return { text: text.slice(0, s.start) + inner + text.slice(s.end), selection: { start: s.start, end: s.start + inner.length } };
  }
  const next = text.slice(0, s.start) + open + chosen + close + text.slice(s.end);
  return chosen
    ? { text: next, selection: { start: s.start + open.length, end: s.start + open.length + chosen.length } }
    : { text: next, selection: { start: s.start + open.length, end: s.start + open.length } };
}

/** Insert `snippet` at the cursor (replacing any selection). */
export function insertAt(text: string, sel: Selection, snippet: string): EditResult {
  const s = norm(text, sel);
  const next = text.slice(0, s.start) + snippet + text.slice(s.end);
  const pos = s.start + snippet.length;
  return { text: next, selection: { start: pos, end: pos } };
}

/** Insert an image as its own paragraph (blank line before and after) so it renders as a block. */
export function insertImage(text: string, sel: Selection, mediaId: string, alt = ''): EditResult {
  const s = norm(text, sel);
  const before = text.slice(0, s.start);
  const after = text.slice(s.end);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const safeAlt = alt.replace(/[\[\]\n]/g, ' ').trim();
  const snippet = `${lead}![${safeAlt}](media:${mediaId})${trail}`;
  const next = before + snippet + after;
  const pos = before.length + snippet.length;
  return { text: next, selection: { start: pos, end: pos } };
}

/** Start each selected line with a list marker (toggle off if all already have it). */
export function toggleList(text: string, sel: Selection, ordered = false): EditResult {
  const s = norm(text, sel);
  const lineStart = text.lastIndexOf('\n', s.start - 1) + 1;
  let lineEnd = text.indexOf('\n', s.end);
  if (lineEnd === -1) lineEnd = text.length;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const marker = (i: number) => (ordered ? `${i + 1}. ` : '- ');
  const has = (l: string) => (ordered ? /^\d{1,3}\.\s/.test(l) : /^[-*]\s/.test(l));
  const allHave = lines.every((l) => l.trim() === '' || has(l));
  const out = lines
    .map((l, i) => (allHave ? l.replace(ordered ? /^\d{1,3}\.\s/ : /^[-*]\s/, '') : l.trim() === '' ? l : `${marker(i)}${l.replace(/^(?:[-*]|\d{1,3}\.)\s+/, '')}`))
    .join('\n');
  return { text: text.slice(0, lineStart) + out + text.slice(lineEnd), selection: { start: lineStart, end: lineStart + out.length } };
}

/** Remove every reference to a media id (used when the teacher deletes an image chip). */
export function removeImage(text: string, mediaId: string): string {
  const re = new RegExp(`\\n{0,2}!\\[[^\\]]*\\]\\(media:${mediaId}\\)\\n{0,2}`, 'gi');
  return text.replace(re, '\n\n').replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n');
}

/** Replace the alt text of one image reference. */
export function setImageAlt(text: string, mediaId: string, alt: string): string {
  const safe = alt.replace(/[\[\]\n]/g, ' ').trim();
  const re = new RegExp(`!\\[[^\\]]*\\]\\(media:${mediaId}\\)`, 'gi');
  return text.replace(re, `![${safe}](media:${mediaId})`);
}

/** Alt text currently used for a media id in the text ('' if none). */
export function imageAlt(text: string, mediaId: string): string {
  const m = new RegExp(`!\\[([^\\]]*)\\]\\(media:${mediaId}\\)`, 'i').exec(text);
  return m ? m[1] : '';
}

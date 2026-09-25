import type { BlockNode, InlineNode, RichFormat } from './ast';

/**
 * Rich text v1 parser — a line-for-line port of be/internal/richtext so the two
 * sides agree on every input (both run the shared golden vectors in
 * contracts/rich-text-v1/vectors.json). It NEVER throws: anything that isn't
 * valid syntax degrades to literal text. There is no HTML and no link syntax.
 */

const ESCAPABLE = '\\*~^$![]_';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const LIST_RE = /^ {0,3}(?:([-*])|(\d{1,3})\.)\s+(.*)$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(media:([0-9a-fA-F-]{36})\)$/;

const isSpace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n';

export function parse(text: string, format: RichFormat | string | undefined): BlockNode[] {
  if (format !== 'rich_v1') {
    if (!text) return [];
    return [{ type: 'paragraph', children: [{ type: 'text', text }] }];
  }
  return parseBlocks(text.replace(/\r\n/g, '\n'));
}

function parseBlocks(text: string): BlockNode[] {
  const lines = text.split('\n');
  const blocks: BlockNode[] = [];
  let para: string[] = [];
  let list: { type: 'list'; ordered?: boolean; items: InlineNode[][] } | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    const joined = para.join('\n');
    para = [];
    const m = IMAGE_RE.exec(joined.trim());
    if (m && UUID_RE.test(m[2])) {
      const node: BlockNode = { type: 'image_block', media_id: m[2].toLowerCase() };
      if (m[1]) node.alt = m[1];
      blocks.push(node);
      return;
    }
    blocks.push({ type: 'paragraph', children: parseInline(joined, false, false) });
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      flushPara();
      flushList();
      continue;
    }
    if (trimmed.startsWith('$$')) {
      const rest = trimmed.slice(2);
      const end = rest.indexOf('$$');
      if (end >= 0 && rest.slice(end + 2).trim() === '') {
        const tex = rest.slice(0, end).trim();
        if (tex !== '') {
          flushPara();
          flushList();
          blocks.push({ type: 'math_block', tex });
          continue;
        }
      } else if (end < 0) {
        const buf: string[] = [rest];
        let closed = false;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const lt = lines[j].trim();
          if (lt.endsWith('$$')) {
            buf.push(lt.slice(0, -2));
            closed = true;
            break;
          }
          buf.push(lines[j]);
        }
        const tex = buf.join('\n').trim();
        if (closed && tex !== '') {
          flushPara();
          flushList();
          blocks.push({ type: 'math_block', tex });
          i = j;
          continue;
        }
      }
    }
    const m = LIST_RE.exec(line);
    if (m) {
      flushPara();
      const ordered = m[2] !== undefined;
      if (!list || !!list.ordered !== ordered) {
        flushList();
        list = { type: 'list', items: [] };
        if (ordered) list.ordered = true;
      }
      list.items.push(parseInline(m[3], false, false));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function findClose(s: string, start: number, d: string): number {
  if (start >= s.length || isSpace(s[start])) return -1;
  for (let j = start + 1; j + d.length <= s.length; j++) {
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (s.startsWith(d, j) && !isSpace(s[j - 1])) return j;
  }
  return -1;
}

function findItalicClose(s: string, start: number): number {
  if (start >= s.length || isSpace(s[start]) || s[start] === '*') return -1;
  for (let j = start + 1; j < s.length; j++) {
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (s[j] === '*' && !isSpace(s[j - 1]) && s[j - 1] !== '*' && (j + 1 >= s.length || s[j + 1] !== '*')) return j;
  }
  return -1;
}

function findScript(s: string, start: number, marker: string): number {
  for (let j = start; j < s.length; j++) {
    if (isSpace(s[j])) return -1;
    if (s[j] === marker) return j === start ? -1 : j;
  }
  return -1;
}

function findMathClose(s: string, start: number): number {
  if (start >= s.length || isSpace(s[start]) || s[start] === '$') return -1;
  for (let j = start + 1; j < s.length; j++) {
    if (s[j] === '\n') return -1;
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (s[j] === '$' && !isSpace(s[j - 1])) {
      const nx = s[j + 1];
      if (nx !== undefined && nx >= '0' && nx <= '9') continue; // "$5 and $10" is currency
      return j;
    }
  }
  return -1;
}

function tryImage(s: string): { len: number; node: InlineNode } | null {
  const end = s.indexOf('](');
  if (end < 0) return null;
  const alt = s.slice(2, end);
  if (alt.includes(']') || alt.includes('\n')) return null;
  const closeIdx = s.indexOf(')', end + 2);
  if (closeIdx < 0) return null;
  const src = s.slice(end + 2, closeIdx);
  if (!src.startsWith('media:')) return null;
  const id = src.slice('media:'.length);
  if (!UUID_RE.test(id)) return null;
  const node: InlineNode = { type: 'image', media_id: id.toLowerCase() };
  if (alt) node.alt = alt;
  return { len: closeIdx + 1, node };
}

function parseInline(s: string, bold: boolean, italic: boolean): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = '';
  const flush = () => {
    if (buf.length > 0) {
      const n: InlineNode = { type: 'text', text: buf };
      if (bold) n.bold = true;
      if (italic) n.italic = true;
      out.push(n);
      buf = '';
    }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
    } else if (c === '\n') {
      flush();
      out.push({ type: 'break' });
      i++;
    } else if (c === '!' && s[i + 1] === '[') {
      const img = tryImage(s.slice(i));
      if (img) {
        flush();
        out.push(img.node);
        i += img.len;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '*' && s[i + 1] === '*') {
      const j = findClose(s, i + 2, '**');
      if (j > 0) {
        flush();
        out.push(...parseInline(s.slice(i + 2, j), true, italic));
        i = j + 2;
      } else {
        buf += '**';
        i += 2;
      }
    } else if (c === '*') {
      const j = findItalicClose(s, i + 1);
      if (j > 0) {
        flush();
        out.push(...parseInline(s.slice(i + 1, j), bold, true));
        i = j + 1;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '~' || c === '^') {
      const j = findScript(s, i + 1, c);
      if (j > 0) {
        flush();
        out.push({ type: c === '^' ? 'sup' : 'sub', text: s.slice(i + 1, j) });
        i = j + 1;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '$') {
      const j = findMathClose(s, i + 1);
      if (j > 0) {
        flush();
        out.push({ type: 'math', tex: s.slice(i + 1, j) });
        i = j + 1;
      } else {
        buf += c;
        i++;
      }
    } else {
      buf += c;
      i++;
    }
  }
  flush();
  return mergeText(out);
}

function mergeText(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === 'text' && last && last.type === 'text' && !!last.bold === !!n.bold && !!last.italic === !!n.italic) {
      last.text += n.text;
    } else {
      out.push(n);
    }
  }
  return out;
}

const inlinePlain = (ns: InlineNode[]): string =>
  ns
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'sub':
        case 'sup':
          return n.text;
        case 'math':
          return n.tex;
        case 'image':
          return '[image]';
        case 'break':
          return '\n';
      }
    })
    .join('');

/** Text-only projection: math → TeX, images → "[image]", blocks joined by "\n". */
export function plainText(text: string, format: RichFormat | string | undefined): string {
  if (format !== 'rich_v1') return text;
  const lines: string[] = [];
  for (const b of parse(text, format)) {
    if (b.type === 'paragraph') lines.push(inlinePlain(b.children));
    else if (b.type === 'list') b.items.forEach((it) => lines.push(inlinePlain(it)));
    else if (b.type === 'math_block') lines.push(b.tex);
    else lines.push('[image]');
  }
  return lines.join('\n');
}

/** Unique media ids referenced by a rich-text value (plain content never references media). */
export function mediaRefs(text: string, format: RichFormat | string | undefined): string[] {
  if (format !== 'rich_v1') return [];
  const seen = new Set<string>();
  const re = /!\[[^\]]*\]\(media:([0-9a-fA-F-]{36})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (UUID_RE.test(m[1])) seen.add(m[1].toLowerCase());
  }
  return [...seen];
}

/** True when the value has any visible content (text, math or an image). */
export function hasContent(text: string, format: RichFormat | string | undefined): boolean {
  if (!text || text.trim() === '') return false;
  if (format !== 'rich_v1') return true;
  return parse(text, format).some((b) => b.type === 'image_block' || b.type === 'math_block' || plainText(text, format).trim() !== '');
}

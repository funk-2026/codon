// Reads a flash card CSV (front,back). Pure (no React Native) so it is unit-tested.

export type CardRow = { front: string; back: string };
export type CsvProblem = { row: number; reason: string };
export type ParsedCards = { cards: CardRow[]; problems: CsvProblem[] };

export const MAX_CARDS = 500;
export const MAX_SIDE = 2000;

/** Splits CSV text into rows of cells. Handles quotes, escaped quotes (""), commas and line breaks inside quotes. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Turns CSV text into cards. A header row ("front,back") is optional. Bad rows are listed, not silently dropped. */
export function parseCards(text: string): ParsedCards {
  const rows = splitCsv(text);
  const out: ParsedCards = { cards: [], problems: [] };
  const hasHeader = rows.length > 0 && rows[0][0]?.trim().toLowerCase() === 'front' && rows[0][1]?.trim().toLowerCase() === 'back';
  rows.forEach((r, idx) => {
    if (idx === 0 && hasHeader) return;
    const line = idx + 1;
    const front = (r[0] ?? '').trim();
    const back = (r[1] ?? '').trim();
    if (!front || !back) out.problems.push({ row: line, reason: 'needs both a front and a back' });
    else if (front.length > MAX_SIDE || back.length > MAX_SIDE) out.problems.push({ row: line, reason: `a side is longer than ${MAX_SIDE} characters` });
    else if (out.cards.length >= MAX_CARDS) out.problems.push({ row: line, reason: `only ${MAX_CARDS} cards per import` });
    else out.cards.push({ front, back });
  });
  return out;
}

export const CSV_TEMPLATE = 'front,back\n"What is the powerhouse of the cell?","Mitochondria"\n"Unit of force","Newton (N)"\n';

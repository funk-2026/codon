/**
 * Rich text v1 — AST types. Mirrors be/internal/richtext (Node) and the shared
 * grammar in contracts/rich-text-v1/grammar.md.
 */
export type InlineNode =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { type: 'sub'; text: string }
  | { type: 'sup'; text: string }
  | { type: 'math'; tex: string }
  | { type: 'image'; media_id: string; alt?: string }
  | { type: 'break' };

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered?: boolean; items: InlineNode[][] }
  | { type: 'math_block'; tex: string }
  | { type: 'image_block'; media_id: string; alt?: string };

export type RichFormat = 'plain' | 'rich_v1';

/** Resolved image the server sends in the top-level `media` map. */
export type MediaView = {
  id: string;
  url: string;
  thumb_url: string;
  width: number;
  height: number;
  alt: string;
};

export type MediaMap = Record<string, MediaView>;

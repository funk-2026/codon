import { plainText } from '@/src/rich/parse';
import type { WellnessCategory, WellnessContent } from '@/src/api/wellness';

/** Shelf order and labels on the Support tab. */
export const WELLNESS_CATEGORIES: { key: WellnessCategory; label: string }[] = [
  { key: 'guidance', label: 'Guidance' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'reflection_prompt', label: 'Reflection Prompts' },
];

export const categoryKey = (label?: string): WellnessCategory | undefined =>
  WELLNESS_CATEGORIES.find((c) => c.label === label || c.key === label)?.key;

export type ShelfCard = { id?: string; title: string; readMins: number; excerpt?: string };

/** ~200 words a minute, at least 1. */
export function readMinutes(body: string, format?: string): number {
  const words = plainText(body, format ?? 'plain').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function toCard(w: WellnessContent): ShelfCard {
  const text = plainText(w.body_text, w.content_format ?? 'plain').trim();
  return { id: w.id, title: w.title, readMins: readMinutes(w.body_text, w.content_format), excerpt: text.length > 110 ? `${text.slice(0, 107)}…` : text };
}

/** Groups live items by category, keeping shelf order; categories without items are dropped. */
export function groupShelves(items: WellnessContent[]): { key: WellnessCategory; label: string; cards: ShelfCard[] }[] {
  return WELLNESS_CATEGORIES.map((c) => ({ ...c, cards: items.filter((i) => i.category === c.key).map(toCard) })).filter((s) => s.cards.length > 0);
}

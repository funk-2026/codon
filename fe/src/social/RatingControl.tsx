import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Star, ThumbsDown, ThumbsUp } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components';
import { ApiError } from '@/src/api/client';
import { deleteRating, putRating, type RatingItemType } from '@/src/api/ratings';
import { track } from '@/src/analytics/track';

/**
 * Star rating (1–5) for tests / videos / brain hacks / decks (FE-3.3).
 * Optimistic; tapping your current rating again removes it. If the student
 * hasn't finished the thing yet the server says `not_eligible` and we explain.
 */
export function StarRating({
  itemType, itemId, value, onChange, label = 'Rate this', size = 32,
}: {
  itemType: Exclude<RatingItemType, 'question'>;
  itemId: string;
  value?: number | null;
  onChange?: (v: number | null) => void;
  label?: string;
  size?: number;
}) {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const [mine, setMine] = useState<number | null>(value ?? null);
  const [busy, setBusy] = useState(false);

  const set = async (v: number) => {
    if (busy) return;
    const prev = mine;
    const next = prev === v ? null : v;
    setMine(next);
    setBusy(true);
    try {
      if (next == null) await deleteRating(itemType, itemId);
      else await putRating({ item_type: itemType, item_id: itemId, value: next });
      track('rating.submitted', { type: itemType, value: next });
      onChange?.(next);
    } catch (e) {
      setMine(prev);
      show(e instanceof ApiError && e.code === 'not_eligible' ? 'Finish it first, then you can rate it.' : "Couldn't save your rating. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View accessibilityRole="adjustable" accessibilityLabel={`${label}. ${mine ? `${mine} of 5 stars` : 'Not rated'}`} style={{ alignItems: 'center', gap: space.xs }}>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => set(n)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            accessibilityState={{ selected: (mine ?? 0) >= n }}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Star size={size} weight={(mine ?? 0) >= n ? 'fill' : 'regular'} color={(mine ?? 0) >= n ? color('semantic/warning') : color('text/tertiary')} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** "Was this explanation helpful?" — thumbs for a question's explanation (value ±1). */
export function ExplanationThumbs({ questionId, value, onChange }: { questionId: string; value?: number | null; onChange?: (v: number | null) => void }) {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const [mine, setMine] = useState<number | null>(value ?? null);
  const [busy, setBusy] = useState(false);

  const set = async (v: 1 | -1) => {
    if (busy) return;
    const prev = mine;
    const next = prev === v ? null : v;
    setMine(next);
    setBusy(true);
    try {
      if (next == null) await deleteRating('question', questionId);
      else await putRating({ item_type: 'question', item_id: questionId, value: next });
      track('rating.submitted', { type: 'question', value: next });
      onChange?.(next);
    } catch (e) {
      setMine(prev);
      show(e instanceof ApiError && e.code === 'not_eligible' ? 'You can rate questions you have seen.' : "Couldn't save. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  const Btn = ({ v, Icon, label }: { v: 1 | -1; Icon: typeof ThumbsUp; label: string }) => (
    <Pressable
      onPress={() => set(v)}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: mine === v }}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={22} weight={mine === v ? 'fill' : 'regular'} color={mine === v ? color('accent/default') : color('text/tertiary')} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Was this explanation helpful?</Text>
      <Btn v={1} Icon={ThumbsUp} label="Helpful" />
      <Btn v={-1} Icon={ThumbsDown} label="Not helpful" />
    </View>
  );
}

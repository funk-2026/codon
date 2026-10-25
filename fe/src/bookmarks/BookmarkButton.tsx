import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BookmarkSimple, Check } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BottomSheet, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { ApiError } from '@/src/api/client';
import { listBookmarkCollections, type BookmarkCollection } from '@/src/api/bookmarks';
import { kvGet, kvSet } from '@/src/storage/kv';
import { useBookmarks } from './BookmarksContext';

const LAST_KEY = 'bookmark-last-collection';

/**
 * Bookmark toggle for one question (FE-3.2). Tap = bookmark into the
 * last-used list (or remove); long-press = choose / move list. Optimistic;
 * explains failures instead of silently reverting.
 */
export function BookmarkButton({ questionId, size = 24 }: { questionId: string; size?: number }) {
  const { color, space } = useTheme();
  const { isBookmarked, toggle, saveTo, collectionOf } = useBookmarks();
  const { show } = useToast();
  const [chooser, setChooser] = useState(false);
  const on = isBookmarked(questionId);

  const explain = (e: unknown) =>
    show(e instanceof ApiError && e.code === 'not_exposed' ? 'You can only bookmark questions you have seen.' : "Couldn't update bookmark. Try again.", 'error');

  const onPress = async () => {
    try {
      const last = on ? undefined : (await kvGet<string | null>(LAST_KEY, null)) ?? undefined;
      const nowOn = await toggle(questionId, last);
      show(nowOn ? 'Bookmarked · long-press to choose a list' : 'Bookmark removed', 'success');
    } catch (e) {
      explain(e);
    }
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={() => setChooser(true)}
        delayLongPress={350}
        hitSlop={space.xs}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={on ? 'Remove bookmark' : 'Bookmark this question'}
        accessibilityHint="Long-press to choose a bookmark list"
        accessibilityActions={[{ name: 'longpress', label: 'Choose bookmark list' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && setChooser(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' })}
      >
        <BookmarkSimple size={size} weight={on ? 'fill' : 'regular'} color={on ? color('accent/default') : color('text/primary')} />
      </Pressable>
      <CollectionChooser
        visible={chooser}
        onClose={() => setChooser(false)}
        current={on ? collectionOf(questionId) : undefined}
        bookmarked={on}
        onPick={async (c) => {
          setChooser(false);
          try {
            await saveTo(questionId, c.id);
            void kvSet(LAST_KEY, c.id);
            show(`Saved to ${c.label}`, 'success');
          } catch (e) {
            explain(e);
          }
        }}
        onRemove={async () => {
          setChooser(false);
          try {
            await toggle(questionId);
            show('Bookmark removed', 'success');
          } catch (e) {
            explain(e);
          }
        }}
      />
    </>
  );
}

function CollectionChooser({
  visible, onClose, current, bookmarked, onPick, onRemove,
}: { visible: boolean; onClose: () => void; current?: string; bookmarked: boolean; onPick: (c: BookmarkCollection) => void; onRemove: () => void }) {
  const { color, type, space, radius } = useTheme();
  const [cols, setCols] = useState<BookmarkCollection[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCols(null);
    listBookmarkCollections()
      .then((r) => setCols([...(r.collections ?? [])].sort((a, b) => a.order_index - b.order_index)))
      .catch(() => setCols([]));
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Save to list">
      <View style={{ gap: space.xs }}>
        {cols == null ? (
          <SkeletonBlock height={120} radius={radius.md} />
        ) : cols.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Couldn’t load your lists. Try again.</Text>
        ) : (
          cols.map((c) => {
            const sel = c.id === current;
            return (
              <Pressable
                key={c.id}
                onPress={() => !sel && onPick(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${c.label}, ${c.count} saved${sel ? ', current list' : ''}`}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.md,
                  backgroundColor: sel ? color('accent/tint') : color('bg/sunken'), opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={[type['type/body-m-medium'], { color: sel ? color('accent/default') : color('text/primary'), flex: 1 }]}>{c.label}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginRight: space.sm }]}>{c.count}</Text>
                {sel ? <Check size={18} color={color('accent/default')} weight="bold" /> : null}
              </Pressable>
            );
          })
        )}
        {bookmarked ? (
          <View style={{ alignItems: 'center', marginTop: space.xs }}>
            <TextButton label="Remove bookmark" onPress={onRemove} />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

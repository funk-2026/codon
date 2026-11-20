import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkSimple } from 'phosphor-react-native';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { deleteBookmark, getBookmarkIds, listBookmarkCollections, putBookmark, type BookmarkItemType } from '@/src/api/bookmarks';
import { TypeIcon } from './TypeIcon';
import { TYPE_ORDER } from './logic';

/** A bookmark row control for Pulse items and Flashcard decks: tap to choose Revise later, Doubts or Important, or remove it. */
export function ItemBookmarkButton({ itemType, itemId, label }: { itemType: Extract<BookmarkItemType, 'pulse' | 'flashcard_deck'>; itemId: string; label: string }) {
  const { color, type, space } = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ids = useQuery({ queryKey: ['bookmark-ids', itemType], queryFn: () => getBookmarkIds(itemType), staleTime: 60_000 });
  const cols = useQuery({ queryKey: ['bookmark-collections'], queryFn: listBookmarkCollections, select: (r) => [...r.collections].sort((a, b) => TYPE_ORDER.indexOf(a.key as never) - TYPE_ORDER.indexOf(b.key as never)) });
  const colOf = Object.entries(ids.data?.by_collection ?? {}).find(([, list]) => list.includes(itemId))?.[0];
  const colKey = cols.data?.find((c) => c.id === colOf)?.key;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['bookmark-ids', itemType] });
    void qc.invalidateQueries({ queryKey: ['bookmark-collections'] });
    void qc.invalidateQueries({ queryKey: ['bookmarks'] });
    void qc.invalidateQueries({ queryKey: ['bookmark-summary'] });
  };
  const save = useMutation({ mutationFn: (collectionId: string) => putBookmark({ item_type: itemType, item_id: itemId, collection_id: collectionId }), onSuccess: () => { setOpen(false); refresh(); } });
  const remove = useMutation({ mutationFn: () => deleteBookmark(itemType, itemId), onSuccess: () => { setOpen(false); refresh(); } });
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={colKey ? `Bookmarked as ${colKey.replace('_', ' ')}. Change` : `Bookmark ${label}`} hitSlop={6} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        {colKey ? <TypeIcon typeKey={colKey} size={22} /> : <BookmarkSimple size={22} color={color('text/tertiary')} />}
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Bookmark as">
        <View style={{ gap: 2, paddingBottom: space.lg }}>
          {(cols.data ?? []).map((c) => (
            <Pressable key={c.id} onPress={() => save.mutate(c.id)} accessibilityRole="button" accessibilityState={{ selected: c.id === colOf }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <TypeIcon typeKey={c.key} size={24} />
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{c.label}</Text>
            </Pressable>
          ))}
          {colOf ? (
            <Pressable onPress={() => remove.mutate()} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[type['type/body-m-medium'], { color: color('semantic/danger') }]}>Remove bookmark</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

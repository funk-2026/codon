import { Pressable } from 'react-native';
import { BookmarkSimple } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useItemBookmark } from './useItemBookmark';
import type { BookmarkItemType } from '@/src/api/bookmarks';

/** A bookmark button for a flash card or a lesson. */
export function BookmarkToggle({ type, id, size = 24 }: { type: Exclude<BookmarkItemType, 'question'>; id?: string; size?: number }) {
  const { color } = useTheme();
  const b = useItemBookmark(type, id);
  if (!id) return null;
  return (
    <Pressable
      onPress={() => {
        b.toggle();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={b.saved ? 'Remove bookmark' : 'Add bookmark'}
      accessibilityState={{ selected: b.saved }}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <BookmarkSimple size={size} weight={b.saved ? 'fill' : 'regular'} color={b.saved ? color('accent/default') : color('text/secondary')} />
    </Pressable>
  );
}

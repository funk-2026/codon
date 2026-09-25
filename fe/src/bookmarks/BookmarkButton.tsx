import React from 'react';
import { Pressable } from 'react-native';
import { BookmarkSimple } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components';
import { ApiError } from '@/src/api/client';
import { useBookmarks } from './BookmarksContext';

/** Bookmark toggle for one question. Optimistic; explains failures instead of silently reverting. */
export function BookmarkButton({ questionId, size = 24 }: { questionId: string; size?: number }) {
  const { color, space } = useTheme();
  const { isBookmarked, toggle } = useBookmarks();
  const { show } = useToast();
  const on = isBookmarked(questionId);

  const onPress = async () => {
    try {
      const nowOn = await toggle(questionId);
      show(nowOn ? 'Bookmarked' : 'Bookmark removed', 'success');
    } catch (e) {
      show(e instanceof ApiError && e.code === 'not_exposed' ? 'You can only bookmark questions you have seen.' : "Couldn't update bookmark. Try again.", 'error');
    }
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={space.xs}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Remove bookmark' : 'Bookmark this question'}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' })}
    >
      <BookmarkSimple size={size} weight={on ? 'fill' : 'regular'} color={on ? color('accent/default') : color('text/primary')} />
    </Pressable>
  );
}

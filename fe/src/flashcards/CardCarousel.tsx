import { useEffect, useRef } from 'react';
import { FlatList, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { StudyCard } from '@/src/api/discover';
import type { MediaMap } from '@/src/rich';
import { FlipCard } from './FlipCard';
import { tap } from './haptics';

const GAP = 12;

/** How tall a card is: a comfortable size on any phone, never the whole screen. */
export function cardHeight(windowHeight: number): number {
  return Math.round(Math.min(Math.max(windowHeight * 0.48, 300), 440));
}

/**
 * Revise mode: the cards sit side by side. Hold and drag to move through them (it snaps card by card, with the next
 * one peeking in), or use the arrows. `index` is the card in view; the carousel scrolls itself when it changes.
 */
export function CardCarousel({ cards, media, deckTitle, index, onIndexChange, flippedId, onFlip }: {
  cards: StudyCard[];
  media: MediaMap;
  deckTitle: string;
  index: number;
  onIndexChange: (i: number) => void;
  flippedId: string | null;
  onFlip: (id: string) => void;
}) {
  const { space } = useTheme();
  const { width, height } = useWindowDimensions();
  const list = useRef<FlatList<StudyCard>>(null);
  const cardW = Math.round(width - space.md * 2 - 28); // leaves a sliver of the next card showing
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const shown = useRef(index);

  // An arrow (or the parent) changed the index: slide there. A drag already moved it: do nothing.
  useEffect(() => {
    if (index === shown.current || index < 0 || index >= cards.length) return;
    shown.current = index;
    list.current?.scrollToIndex({ index, animated: true });
  }, [index, cards.length]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(cards.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    shown.current = i;
    if (i !== index) {
      tap('light');
      onIndexChange(i);
    }
  };

  return (
    <FlatList
      ref={list}
      data={cards}
      horizontal
      keyExtractor={(c) => c.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
      contentContainerStyle={{ paddingHorizontal: side }}
      onMomentumScrollEnd={settle}
      initialNumToRender={3}
      windowSize={5}
      style={{ flexGrow: 0 }}
      renderItem={({ item }) => (
        <View style={{ width: cardW, height: cardHeight(height), marginRight: GAP }}>
          <FlipCard front={item.front} back={item.back} format={item.content_format} media={media} flipped={flippedId === item.id} onFlip={() => onFlip(item.id)} deckTitle={deckTitle} animateIn={false} />
        </View>
      )}
    />
  );
}

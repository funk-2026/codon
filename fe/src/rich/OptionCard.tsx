import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Check, X as XIcon } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { MediaMap } from './ast';
import { RichContent } from './RichContent';
import { plainText } from './parse';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'missed' | 'struck';

export type OptionCardProps = {
  letter: string;
  value: string;
  format?: string;
  media?: MediaMap;
  state?: OptionState;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * One answer option (FE-1.6). Handles text-only, image-only and mixed options;
 * grows with its content (no fixed height, no clipping). State is conveyed by
 * an icon + label as well as colour, so it survives colour-blindness/greyscale.
 */
export function OptionCard({ letter, value, format, media, state = 'idle', onPress, onLongPress, disabled, style, testID }: OptionCardProps) {
  const { color, type, space, radius } = useTheme();

  const palette = {
    idle: { bg: color('bg/surface'), border: color('border/subtle'), badgeBg: color('bg/sunken'), badgeFg: color('text/secondary'), bw: 1.5 },
    selected: { bg: color('accent/tint'), border: color('accent/default'), badgeBg: color('accent/default'), badgeFg: color('accent/on-accent'), bw: 2 },
    correct: { bg: color('semantic/success-tint'), border: color('semantic/success'), badgeBg: color('semantic/success'), badgeFg: color('text/inverse'), bw: 2 },
    wrong: { bg: color('semantic/danger-tint'), border: color('semantic/danger'), badgeBg: color('semantic/danger'), badgeFg: color('text/inverse'), bw: 2 },
    missed: { bg: color('semantic/success-tint'), border: color('semantic/success'), badgeBg: color('semantic/success'), badgeFg: color('text/inverse'), bw: 1.5 },
    struck: { bg: color('bg/sunken'), border: color('border/subtle'), badgeBg: color('bg/sunken'), badgeFg: color('text/tertiary'), bw: 1.5 },
  }[state];

  const stateLabel = { idle: '', selected: 'selected', correct: 'correct answer', wrong: 'your answer, incorrect', missed: 'correct answer', struck: 'eliminated' }[state];
  const a11y = `Option ${letter}. ${plainText(value, format) || 'image'}${stateLabel ? `. ${stateLabel}` : ''}`;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: state === 'selected', disabled: !!disabled }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: palette.bg,
          borderRadius: radius.md,
          borderWidth: palette.bw,
          borderColor: palette.border,
          padding: space.md,
          minHeight: 56,
          gap: space.sm,
          opacity: pressed ? 0.94 : 1,
        },
        style,
      ]}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: palette.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
        {state === 'correct' || state === 'missed' ? (
          <Check size={16} weight="bold" color={palette.badgeFg} />
        ) : state === 'wrong' ? (
          <XIcon size={16} weight="bold" color={palette.badgeFg} />
        ) : (
          <Text style={[type['type/body-m-medium'], { color: palette.badgeFg }]}>{letter}</Text>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 28 }}>
        <RichContent
          value={value}
          format={format}
          media={media}
          variant="option"
          imageMaxHeight={220}
          // Tapping an option must select it, not open a lightbox.
          disableLightbox
          color={state === 'struck' ? color('text/tertiary') : undefined}
        />
      </View>
    </Pressable>
  );
}

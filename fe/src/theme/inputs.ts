import type { TextStyle } from 'react-native';

/**
 * Single-line text inputs centre their text only when no explicit line height is set:
 * with one, iOS pins the text to the top of the line box and it looks pushed down.
 * Wrap a type token with this for any one-line TextInput.
 */
export const inputText = (style: TextStyle): TextStyle => ({ ...style, lineHeight: undefined });

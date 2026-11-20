import { BookmarkSimple, Flag, WarningCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { TYPE_TONE, type TypeKey } from './logic';

/** Blue ribbon for Revise later, yellow exclamation for Doubts, red flag for Important. Icon only, no text. */
export function TypeIcon({ typeKey, size = 22, filled = true }: { typeKey: string; size?: number; filled?: boolean }) {
  const { color } = useTheme();
  const key = (typeKey in TYPE_TONE ? typeKey : 'revise_later') as TypeKey;
  const c = color(TYPE_TONE[key]);
  const weight = filled ? 'fill' : 'regular';
  if (key === 'doubts') return <WarningCircle size={size} color={c} weight={weight} />;
  if (key === 'important') return <Flag size={size} color={c} weight={weight} />;
  return <BookmarkSimple size={size} color={c} weight={weight} />;
}

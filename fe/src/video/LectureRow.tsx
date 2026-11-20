import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckCircle, Lock, MonitorPlay, PauseCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';

/**
 * One lecture in any list (a subject's lectures, Free videos, Downloaded videos): the same 88 x 56 picture, title,
 * one line of detail and a state on the right. `trailing` is an extra control outside the tap area (Remove).
 */
export function LectureRow({
  title, detail, cover, state, locked, progressPct, trailing, onPress, label,
}: {
  title: string;
  detail: string;
  /** The chapter cover; a play icon is shown without one. */
  cover?: ReactNode;
  state?: 'completed' | 'paused' | 'unattempted';
  locked?: boolean;
  /** 0 to 100: the bar along the picture, for a paused lecture. */
  progressPct?: number;
  trailing?: ReactNode;
  onPress: () => void;
  label: string;
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }, shadow()]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 })}>
        <View style={{ width: 88, height: 56, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {cover ?? <MonitorPlay size={26} color={color('accent/default')} weight="duotone" />}
          {state === 'paused' && progressPct ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: color('bg/sunken') }}>
              <View style={{ width: `${progressPct}%`, height: 3, backgroundColor: color('accent/default') }} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{title}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{detail}</Text>
        </View>
        {locked ? <Lock size={20} color={color('text/tertiary')} weight="fill" /> : state === 'completed' ? <CheckCircle size={22} color={color('semantic/success')} weight="fill" /> : state === 'paused' ? <PauseCircle size={22} color={color('semantic/warning')} weight="fill" /> : null}
      </Pressable>
      {trailing}
    </View>
  );
}

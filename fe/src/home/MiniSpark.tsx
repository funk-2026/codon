import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '@/src/theme/ThemeProvider';
import { niceMax, xAt, yAt, type ChartPoint } from './chart';

/** A small line for a card: the shape of the last two weeks, no axes. */
export function MiniSpark({ points, height = 56 }: { points: ChartPoint[]; height?: number }) {
  const { color } = useTheme();
  const [w, setW] = useState(120);
  const { max } = niceMax(points.map((p) => p.value));
  const xs = points.map((_, i) => xAt(i, points.length, 4, w - 4));
  const ys = points.map((p) => yAt(p.value, max, 4, height - 4));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height}>
        <Polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke={color('accent/default')} strokeWidth={2} />
        {points.length ? <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill={color('accent/default')} /> : null}
      </Svg>
    </View>
  );
}

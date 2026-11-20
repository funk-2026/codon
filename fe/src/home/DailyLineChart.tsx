import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/src/theme/ThemeProvider';
import { coveredRuns, niceMax, xAt, yAt, type ChartPoint } from './chart';

const H = 200;
const PAD = { l: 30, r: 14, t: 14, b: 26 };

/** A line chart of one count per day. Tap a point to select it; the caller lists what is behind that point. */
export function DailyLineChart({ points, selected, onSelect, unit }: { points: ChartPoint[]; selected: number | null; onSelect: (i: number) => void; unit: string }) {
  const { color, type } = useTheme();
  const [w, setW] = useState(320);
  const { max, ticks } = niceMax(points.map((p) => p.value));
  const right = w - PAD.r;
  const bottom = H - PAD.b;
  const xs = points.map((_, i) => xAt(i, points.length, PAD.l, right));
  const ys = points.map((p) => yAt(p.value, max, PAD.t, bottom));
  const step = Math.max(1, Math.ceil(points.length / 7));

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={`${unit} per day. ${points.map((p) => `${p.label}: ${p.value}`).join(', ')}`}>
      <Svg width={w} height={H}>
        {ticks.map((t) => (
          <Line key={t} x1={PAD.l} x2={right} y1={yAt(t, max, PAD.t, bottom)} y2={yAt(t, max, PAD.t, bottom)} stroke={color('border/subtle')} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText key={`t${t}`} x={PAD.l - 6} y={yAt(t, max, PAD.t, bottom) + 4} fontSize={10} fill={color('text/tertiary')} textAnchor="end">{t}</SvgText>
        ))}
        {coveredRuns(points).filter((r) => r.length > 1).map((r) => <Polyline key={r[0]} points={r.map((i) => `${xs[i]},${ys[i]}`).join(' ')} fill="none" stroke={color('accent/default')} strokeWidth={2} />)}
        {points.map((p, i) => (p.missing ? null : <Circle key={i} cx={xs[i]} cy={ys[i]} r={selected === i ? 7 : 4} fill={selected === i ? color('accent/default') : color('bg/surface')} stroke={color('accent/default')} strokeWidth={2} />))}
        {/* wide, invisible targets so a finger can hit a point */}
        {points.map((p, i) => (
          <Circle key={`hit${i}`} cx={xs[i]} cy={ys[i]} r={18} fill="transparent" onPress={() => onSelect(i)} />
        ))}
        {points.map((p, i) => (i % step === 0 || i === points.length - 1 ? (
          <SvgText key={`x${i}`} x={xs[i]} y={H - 8} fontSize={10} fill={color('text/tertiary')} textAnchor="middle">{p.label}</SvgText>
        ) : null))}
      </Svg>
      <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>Date · {unit}</Text>
    </View>
  );
}

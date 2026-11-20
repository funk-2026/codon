import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/src/theme/ThemeProvider';

export type RadarAxis = { label: string; mine: number; top: number };

const SIZE = 260;
const C = SIZE / 2;
const R = 86;

/** A radar chart of the same 0 to 100 scale on every axis: my score against the top-100 average. Values are percentages. */
export function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const { color, type, space } = useTheme();
  const n = axes.length;
  if (n < 3) return null;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
  };
  const ring = (v: number) => axes.map((_, i) => pt(i, v)).join(' ');
  const label = `Score against the top 100 average. ${axes.map((a) => `${a.label}: you ${Math.round(a.mine)} percent, top 100 ${Math.round(a.top)} percent`).join('. ')}`;
  return (
    <View style={{ alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={label}>
      <Svg width={SIZE} height={SIZE}>
        {[25, 50, 75, 100].map((v) => <Polygon key={v} points={ring(v)} fill="none" stroke={color('border/subtle')} strokeWidth={1} />)}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100).split(',');
          return <Line key={i} x1={C} y1={C} x2={Number(x)} y2={Number(y)} stroke={color('border/subtle')} strokeWidth={1} />;
        })}
        <Polygon points={axes.map((a, i) => pt(i, a.top)).join(' ')} fill={color('semantic/success')} fillOpacity={0.15} stroke={color('semantic/success')} strokeWidth={2} />
        <Polygon points={axes.map((a, i) => pt(i, a.mine)).join(' ')} fill={color('accent/default')} fillOpacity={0.2} stroke={color('accent/default')} strokeWidth={2} />
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100).split(',').map(Number);
          const dx = x - C;
          const dy = y - C;
          return <SvgText key={a.label} x={C + dx * 1.22} y={C + dy * 1.16 + 4} fontSize={12} fill={color('text/primary')} textAnchor="middle">{a.label}</SvgText>;
        })}
        {axes.map((a, i) => { const [x, y] = pt(i, a.mine).split(',').map(Number); return <Circle key={`m${i}`} cx={x} cy={y} r={3} fill={color('accent/default')} />; })}
      </Svg>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Text style={[type['type/caption'], { color: color('accent/default') }]}>● You</Text>
        <Text style={[type['type/caption'], { color: color('semantic/success') }]}>● Top 100 average</Text>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Scale 0 to 100%</Text>
      </View>
    </View>
  );
}

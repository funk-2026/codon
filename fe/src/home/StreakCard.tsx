import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretDown, CaretLeft, CaretRight, CaretUp, Flame } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { currentWeek, dailyCounts, monthCells, type AttemptDay } from './monthCalendar';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The streak: this week Monday to Sunday, and a tap opens the month in place with the questions solved each day.
 * The streak count comes from the server, the same number as the header.
 */
export function StreakCard({ streak, attempts }: { streak: number; attempts: AttemptDay[] }) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const [now] = useState(() => new Date());
  const [view, setView] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const counts = useMemo(() => dailyCounts(attempts), [attempts]);
  const week = useMemo(() => currentWeek(counts, now), [counts, now]);
  const cells = useMemo(() => monthCells(view.y, view.m, counts, now), [view, counts, now]);

  const shift = (by: number) => setView((v) => {
    const d = new Date(v.y, v.m + by, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${streak} day streak. ${open ? 'Hide' : 'Show'} the month`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 }}
      >
        <Flame size={18} color={color('highlight/default')} weight="fill" />
        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
          {streak > 0 ? `${streak} day streak` : 'Start a streak today'}
        </Text>
        {open ? <CaretUp size={16} color={color('text/tertiary')} /> : <CaretDown size={16} color={color('text/tertiary')} />}
      </Pressable>

      {!open ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }} accessible accessibilityLabel={`Practised on ${week.filter((d) => d.active).length} days this week`}>
          {week.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: space['2xs'] }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: d.active ? color('accent/default') : color('bg/sunken'), borderWidth: d.today ? 2 : 0, borderColor: color('accent/default'), opacity: d.future ? 0.5 : 1 }} />
              <Text style={[type['type/caption'], { color: d.today ? color('text/primary') : color('text/tertiary') }]}>{d.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={space.xs} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <CaretLeft size={18} color={color('text/primary')} />
            </Pressable>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>{MONTHS[view.m]} {view.y}</Text>
            <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={space.xs} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <CaretRight size={18} color={color('text/primary')} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {LETTERS.map((l, i) => <Text key={i} style={[type['type/caption'], { flex: 1, textAlign: 'center', color: color('text/tertiary') }]}>{l}</Text>)}
          </View>
          {cells.map((w, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {w.map((c, ci) => (
                <View key={ci} style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' }}>
                  {c ? (
                    <View
                      accessible
                      accessibilityLabel={c.count ? `${c.day}: ${c.count.mcqs} questions in ${c.count.tests} test${c.count.tests === 1 ? '' : 's'}` : `${c.day}: no practice`}
                      style={{ width: 38, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.count ? color('accent/tint') : 'transparent', borderWidth: c.today ? 1.5 : 0, borderColor: color('accent/default') }}
                    >
                      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{c.day}</Text>
                      {c.count ? <Text style={[type['type/body-m-medium'], { color: color('accent/default'), fontSize: 13 }]}>{c.count.mcqs}</Text> : null}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>The number is how many questions you solved that day.</Text>
        </View>
      )}
    </View>
  );
}

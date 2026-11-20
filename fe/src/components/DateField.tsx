import { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CalendarBlank, CaretLeft, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BottomSheet } from './BottomSheet';
import { formatDMY, monthGrid, parseDMY, startOfDay } from './calendar';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A date as "DD/MM/YYYY" chosen from a calendar. Past days are off by default (a schedule is for the future). */
export function DateField({ label, value, onChange, allowPast = false, containerStyle }: {
  label: string;
  value: string;
  onChange: (dmy: string) => void;
  allowPast?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = parseDMY(value);
  const [view, setView] = useState(() => {
    const d = selected ?? new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = startOfDay(new Date());

  const shift = (by: number) => setView((v) => {
    const d = new Date(v.y, v.m + by, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const openSheet = () => {
    const d = selected ?? new Date();
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setOpen(true);
  };

  return (
    <View style={containerStyle}>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space['2xs'] }]}>{label}</Text>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}. Choose from calendar`}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.md, paddingHorizontal: space.sm, backgroundColor: color('bg/surface') }}
      >
        <Text style={[type['type/body-l'], { color: value ? color('text/primary') : color('text/tertiary') }]}>{value || 'Choose a date'}</Text>
        <CalendarBlank size={20} color={color('text/tertiary')} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Pressable onPress={() => shift(-1)} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <CaretLeft size={20} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>{MONTHS[view.m]} {view.y}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Next month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <CaretRight size={20} color={color('text/primary')} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {DAYS.map((d, i) => (
            <Text key={i} style={[type['type/caption'], { flex: 1, textAlign: 'center', color: color('text/tertiary') }]}>{d}</Text>
          ))}
        </View>
        {monthGrid(view.y, view.m).map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((day, di) => {
              if (day == null) return <View key={di} style={{ flex: 1, height: 44 }} />;
              const date = new Date(view.y, view.m, day);
              const disabled = !allowPast && date < today;
              const on = selected != null && date.getTime() === selected.getTime();
              const isToday = date.getTime() === today.getTime();
              return (
                <Pressable
                  key={di}
                  disabled={disabled}
                  onPress={() => { onChange(formatDMY(date)); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled }}
                  accessibilityLabel={date.toDateString()}
                  style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color('accent/default') : 'transparent', borderWidth: isToday && !on ? 1 : 0, borderColor: color('accent/default') }}>
                    <Text style={[type['type/body-m'], { color: on ? color('accent/on-accent') : disabled ? color('text/tertiary') : color('text/primary'), opacity: disabled ? 0.4 : 1 }]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <Pressable onPress={() => { onChange(formatDMY(new Date())); setOpen(false); }} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.xs }}>
          <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Today</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

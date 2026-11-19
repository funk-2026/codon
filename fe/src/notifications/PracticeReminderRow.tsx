import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { REMINDERS, getReminder, hourLabel, setReminder, toggleHour, type ReminderKind, type ReminderState } from './reminders';

/** A settings row for one daily reminder: on or off, and one or more times of day. */
export function ReminderRow({ kind }: { kind: ReminderKind }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const cfg = REMINDERS[kind];
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getReminder(kind).then(setState).catch(() => setState({ enabled: false, hours: [cfg.hours[0]] }));
  }, [kind, cfg.hours]);

  const apply = async (next: ReminderState) => {
    setBusy(true);
    try {
      const r = await setReminder(kind, next);
      if (r === 'ok') {
        setState(next);
        if (next.enabled) show(`Reminder set for ${next.hours.map(hourLabel).join(', ')}`, 'success');
      } else {
        show(r === 'denied' ? 'Allow notifications for Codon in your phone’s settings to get reminders.' : 'Reminders aren’t available on this device.', 'error');
      }
    } catch {
      show('Couldn’t update the reminder. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  return (
    <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{cfg.label}</Text>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{state.enabled ? `Every day at ${state.hours.map(hourLabel).join(', ')}` : cfg.off}</Text>
        </View>
        <Switch value={state.enabled} disabled={busy} onValueChange={(v) => apply({ ...state, enabled: v })} accessibilityLabel={cfg.label} trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />
      </View>
      {state.enabled ? (
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
          {cfg.hours.map((h) => {
            const on = state.hours.includes(h);
            return (
              <Pressable
                key={h}
                onPress={() => apply(toggleHour(state, h))}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${on ? 'Stop reminding' : 'Remind me'} at ${hourLabel(h)}`}
                style={{ minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/sunken') }}
              >
                <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{hourLabel(h)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

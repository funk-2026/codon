import React, { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { REMINDER_HOURS, getReminder, hourLabel, setReminder, type ReminderState } from './reminders';

/** Settings row: daily practice reminder on/off + time (local notification). */
export function PracticeReminderRow() {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getReminder().then(setState).catch(() => setState({ enabled: false, hour: 19 }));
  }, []);

  const apply = async (next: ReminderState) => {
    setBusy(true);
    try {
      const r = await setReminder(next);
      if (r === 'ok') {
        setState(next);
        if (next.enabled) show(`Reminder set for ${hourLabel(next.hour)} every day`, 'success');
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
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Daily practice reminder</Text>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
            {state.enabled ? `Every day at ${hourLabel(state.hour)}` : 'A gentle nudge to practise each day'}
          </Text>
        </View>
        <Switch
          value={state.enabled}
          disabled={busy}
          onValueChange={(v) => apply({ ...state, enabled: v })}
          accessibilityLabel="Daily practice reminder"
          trackColor={{ false: color('border/strong'), true: color('accent/default') }}
          thumbColor={color('bg/surface')}
        />
      </View>
      {state.enabled ? (
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
          {REMINDER_HOURS.map((h) => {
            const on = h === state.hour;
            return (
              <Pressable
                key={h}
                onPress={() => !on && apply({ enabled: true, hour: h })}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Remind me at ${hourLabel(h)}`}
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

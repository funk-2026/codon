import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { kvGet, kvSet } from '@/src/storage/kv';
import { ROUTES } from '@/src/navigation/routes';

/**
 * Daily reminders (practice, drink water, box breathing): LOCAL notifications scheduled on this device, so there is
 * no server or push token involved and they also work in Expo Go. Each reminder can fire at several times a day.
 */
export type ReminderKind = 'practice' | 'water' | 'breathing';
export type ReminderState = { enabled: boolean; hours: number[] };

export const REMINDERS: Record<ReminderKind, { label: string; off: string; hours: readonly number[]; title: string; body: string; route?: string }> = {
  practice: { label: 'Daily practice reminder', off: 'A gentle nudge to practise each day', hours: [7, 17, 19, 21], title: 'Time for a quick practice', body: 'A short set today keeps your streak going.', route: ROUTES.student.practice },
  water: { label: 'Drink water reminder', off: 'A reminder to stay hydrated while you study', hours: [10, 13, 16, 19], title: 'Time for some water', body: 'Take a few sips. Your brain works better hydrated.' },
  breathing: { label: 'Box breathing reminder', off: 'A short pause to breathe and reset', hours: [9, 14, 18, 22], title: 'Take a breathing break', body: 'Breathe in 4, hold 4, out 4, hold 4. Repeat a few times.' },
};

/** Kept for existing imports. */
export const REMINDER_HOURS = REMINDERS.practice.hours;

export const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

const keyOf = (k: ReminderKind) => (k === 'practice' ? 'practice-reminder' : `${k}-reminder`);
const idsKeyOf = (k: ReminderKind) => (k === 'practice' ? 'practice-reminder-id' : `${k}-reminder-ids`);
const channelOf = (k: ReminderKind) => `${k}-reminders`;
const DEFAULT = (k: ReminderKind): ReminderState => ({ enabled: false, hours: [REMINDERS[k].hours[2] ?? REMINDERS[k].hours[0]] });

/** Reads a stored value of any older shape ({enabled, hour}) into the current one, keeping only valid times. */
export function normalizeReminder(kind: ReminderKind, raw: unknown): ReminderState {
  const r = raw as { enabled?: unknown; hours?: unknown; hour?: unknown } | null;
  if (!r || typeof r !== 'object') return DEFAULT(kind);
  const valid = (h: unknown): h is number => typeof h === 'number' && REMINDERS[kind].hours.includes(h);
  const hours = Array.isArray(r.hours) ? r.hours.filter(valid) : valid(r.hour) ? [r.hour] : [];
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  return { enabled: r.enabled === true && sorted.length > 0, hours: sorted.length ? sorted : DEFAULT(kind).hours };
}

/** Adds or removes one time. Removing the last time turns the reminder off. */
export function toggleHour(state: ReminderState, hour: number): ReminderState {
  const has = state.hours.includes(hour);
  const hours = (has ? state.hours.filter((h) => h !== hour) : [...state.hours, hour]).sort((a, b) => a - b);
  return hours.length === 0 ? { enabled: false, hours: state.hours } : { enabled: state.enabled, hours };
}

type N = typeof import('expo-notifications');
async function load(): Promise<N | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function getReminder(kind: ReminderKind = 'practice'): Promise<ReminderState> {
  return normalizeReminder(kind, await kvGet<unknown>(keyOf(kind), null));
}

/** Turn a reminder on at its chosen times (re-scheduling) or off. Persists the choice only when it took effect. */
export async function setReminder(kind: ReminderKind, next: ReminderState): Promise<'ok' | 'denied' | 'unavailable'> {
  const Notifications = await load();
  if (!Notifications) return 'unavailable';

  const prev = await kvGet<string | string[] | null>(idsKeyOf(kind), null);
  for (const id of Array.isArray(prev) ? prev : prev ? [prev] : []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  if (!next.enabled) {
    await kvSet(idsKeyOf(kind), []);
    await kvSet(keyOf(kind), next);
    return 'ok';
  }
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';

  const cfg = REMINDERS[kind];
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelOf(kind), { name: cfg.label, importance: Notifications.AndroidImportance.DEFAULT });
  const ids: string[] = [];
  for (const hour of next.hours) {
    ids.push(await Notifications.scheduleNotificationAsync({
      content: { title: cfg.title, body: cfg.body, ...(cfg.route ? { data: { route: cfg.route } } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, ...(Platform.OS === 'android' ? { channelId: channelOf(kind) } : {}) },
    }));
  }
  await kvSet(idsKeyOf(kind), ids);
  await kvSet(keyOf(kind), next);
  return 'ok';
}

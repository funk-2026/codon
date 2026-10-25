import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { kvGet, kvSet } from '@/src/storage/kv';

/**
 * Daily practice reminder (CM-I8 / FE-6.9): a LOCAL notification scheduled on
 * this device — no server or push token needed, so it also works in Expo Go.
 * Tapping it opens the Practice tab (an allow-listed route in PushProvider).
 */
export type ReminderState = { enabled: boolean; hour: number };
export const REMINDER_HOURS = [7, 17, 19, 21] as const;
const KEY = 'practice-reminder';
const ID_KEY = 'practice-reminder-id';
const CHANNEL = 'practice-reminders';
const DEFAULT: ReminderState = { enabled: false, hour: 19 };

export const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

type N = typeof import('expo-notifications');
async function load(): Promise<N | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function getReminder(): Promise<ReminderState> {
  const s = await kvGet<ReminderState | null>(KEY, null);
  return s && typeof s.hour === 'number' ? s : DEFAULT;
}

/** Turn the reminder on at `hour` (re-schedules) or off. Persists the choice only when it took effect. */
export async function setReminder(next: ReminderState): Promise<'ok' | 'denied' | 'unavailable'> {
  const Notifications = await load();
  if (!Notifications) return 'unavailable';

  // always clear the previous schedule first
  const prevId = await kvGet<string | null>(ID_KEY, null);
  if (prevId) await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});

  if (!next.enabled) {
    await kvSet(ID_KEY, null);
    await kvSet(KEY, next);
    return 'ok';
  }

  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Practice reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for a quick practice',
      body: 'A short set today keeps your streak going.',
      data: { route: '/(student)/(practice)' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: next.hour, minute: 0, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
  await kvSet(ID_KEY, id);
  await kvSet(KEY, next);
  return 'ok';
}

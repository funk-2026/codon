import * as Haptics from 'expo-haptics';
import { kvGet, kvSet } from '@/src/storage/kv';

const KEY = 'vibrate-on-wrong';

/** Wrong-answer vibration: on unless the student switched it off. Only used where answers are shown at once (QBank and Custom Module Regular), never in an exam. */
export const getVibrateOnWrong = () => kvGet<boolean>(KEY, true);
export const setVibrateOnWrong = (on: boolean) => kvSet(KEY, on);

/** A short buzz for a wrong answer, if the student wants it. Never throws. */
export async function buzzOnWrong(): Promise<void> {
  try {
    if (await getVibrateOnWrong()) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    /* a phone without haptics simply stays quiet */
  }
}

import * as Haptics from 'expo-haptics';

/** Light tap for flips and ratings. Never throws: haptics are a nicety, not a requirement. */
export function tap(kind: 'light' | 'success' = 'light') {
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // unsupported device or web
  }
}

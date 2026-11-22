import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

// Haptics are a nicety: never let a failure surface to the user.
function run(effect: () => Promise<void>) {
  if (!enabled) return;
  effect().catch(() => {});
}

export const tap = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

export const longPress = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

export const success = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const warning = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

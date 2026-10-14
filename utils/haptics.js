import * as Haptics from 'expo-haptics';

// a small buzz for the moments that matter: saving money records and confirming a payment, nothing routine
// haptics aren't on every device (the web, some Androids), so a failure is just ignored

export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// for a void or a reject, the things that take money back out
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

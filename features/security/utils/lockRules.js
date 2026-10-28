// pure rules for the app lock, so the tests can check them without a phone

// more than a minute away locks the app again, a quick trip to another app doesn't
export const lock_after_ms = 60 * 1000;
// after this many failed tries the lock screen offers Log Out right up front
export const failures_before_logout = 3;

// only a signed-in account with the switch on is ever locked, the demo and signed out never are
export function canLock(settings) {
  return !!settings.enabled && !!settings.user && !settings.demo_mode;
}

// coming back to the app: lock when it was really in the background for more than a minute,
// and never when the trip away was a system dialog (a permission prompt, the photo picker, the share sheet)
export function shouldLockOnReturn(background_at, now, left_for_dialog) {
  if (background_at === null || background_at === undefined || left_for_dialog) {
    return false;
  }
  return now - background_at > lock_after_ms;
}

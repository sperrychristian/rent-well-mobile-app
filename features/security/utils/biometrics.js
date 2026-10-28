import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { whileSystemDialog } from '../../../services/appLock';

// what this phone can do for unlocking: { available, label }
// available means it has the hardware and someone has set up a face or a finger on it
// label is what the switch and the Unlock button say, so an iPhone with Face ID says "Face ID" and so on
export async function biometricSupport() {
  try {
    const has_hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = has_hardware ? await LocalAuthentication.isEnrolledAsync() : false;
    const types = has_hardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
    return { available: has_hardware && enrolled, label: biometricLabel(types, Platform.OS) };
  } catch (error) {
    console.log('Could not check Face ID or Touch ID', error.message);
    return { available: false, label: biometricLabel([], Platform.OS) };
  }
}

// pure, so the tests can check every phone: iPhones say Face ID or Touch ID, Android says face or fingerprint
export function biometricLabel(types, platform) {
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  if (platform === 'ios') {
    if (face && !finger) {
      return 'Face ID';
    }
    if (finger && !face) {
      return 'Touch ID';
    }
    return 'Face ID or Touch ID';
  }
  if (face && !finger) {
    return 'face unlock';
  }
  if (finger && !face) {
    return 'fingerprint';
  }
  return 'fingerprint or face unlock';
}

// the system prompt: Face ID or Touch ID first, and the phone's passcode as the fallback
// it never turns the fallback off, so nobody is ever locked out of their own app
// gives back { success, error }, the lock screen counts the failures
export async function unlockWithDevice(prompt) {
  try {
    const result = await whileSystemDialog(() =>
      LocalAuthentication.authenticateAsync({
        promptMessage: prompt || 'Unlock Rent Well',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      }),
    );
    return result.success
      ? { success: true, error: null }
      : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: 'unknown', message: error.message };
  }
}

// these mean the phone can't check anyone at all (no biometrics and no passcode, or no hardware),
// so the lock steps aside instead of trapping the person outside their own app
export function cannotCheck(error) {
  return error === 'passcode_not_set' || error === 'not_available' || error === 'not_enrolled';
}

// a cancel isn't a failed try, only a face or finger the phone didn't accept is
export function countsAsFailure(error) {
  return error === 'authentication_failed' || error === 'lockout' || error === 'unknown';
}

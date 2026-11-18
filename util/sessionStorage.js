// assignment 12: where the signed-in session is saved on the phone, so the next launch opens signed in
// on iOS and Android it goes in SecureStore (the Keychain, and the Android Keystore), which is what the
// assignment recommends for a token, and anywhere SecureStore isn't there (the web render, the tests)
// it falls back to AsyncStorage. nothing in here ever logs the session, only that something failed
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth_session_key } from './storageKeys';

// asked once per launch, the answer can't change while the app runs
let secure_check = null;

async function canUseSecureStore() {
  if (Platform.OS === 'web') {
    return false;
  }
  if (!secure_check) {
    secure_check = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secure_check;
}

// the tests call this so each one asks again
export function forgetSecureStoreCheck() {
  secure_check = null;
}

// step 1: save the whole session as one JSON string under one key
export async function saveSession(session) {
  const text = JSON.stringify(session);
  if (await canUseSecureStore()) {
    // after first unlock, so a session restored while the phone is still locked in the background still opens
    await SecureStore.setItemAsync(auth_session_key, text, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return;
  }
  await AsyncStorage.setItem(auth_session_key, text);
}

// step 2: read it back at launch, null when there's nothing saved or it can't be read
export async function readSession() {
  let text = null;
  try {
    text = (await canUseSecureStore())
      ? await SecureStore.getItemAsync(auth_session_key)
      : await AsyncStorage.getItem(auth_session_key);
  } catch {
    console.log('Could not read the saved session');
    return null;
  }
  if (!text) {
    return null;
  }
  try {
    const session = JSON.parse(text);
    // a saved session needs both tokens and the account id, anything less can't sign anyone in
    if (!session || !session.idToken || !session.refreshToken || !session.localId) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// step 3: log out removes it from both places, in case it was ever saved in the fallback
export async function clearSession() {
  try {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(auth_session_key);
    }
  } catch {
    console.log('Could not clear the saved session');
  }
  await AsyncStorage.removeItem(auth_session_key).catch(() => {});
}

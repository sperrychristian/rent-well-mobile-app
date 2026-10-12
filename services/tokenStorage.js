import * as SecureStore from 'expo-secure-store';

// tokens live in the keychain (iOS) or keystore (Android), never in AsyncStorage
const access_key = 'rent_well_access_token';
const refresh_key = 'rent_well_refresh_token';
const user_key = 'rent_well_user';

export async function loadTokens() {
  const access_token = await SecureStore.getItemAsync(access_key);
  const refresh_token = await SecureStore.getItemAsync(refresh_key);
  const user_text = await SecureStore.getItemAsync(user_key);
  if (!refresh_token) {
    return null;
  }
  let user = null;
  try {
    user = user_text ? JSON.parse(user_text) : null;
  } catch {
    user = null;
  }
  return { access_token: access_token, refresh_token: refresh_token, user: user };
}

// the refresh token goes first since it's the one that can't be lost
export async function saveTokens(session) {
  await SecureStore.setItemAsync(refresh_key, session.refresh_token);
  await SecureStore.setItemAsync(access_key, session.access_token);
  await SecureStore.setItemAsync(user_key, JSON.stringify(session.user));
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(refresh_key);
  await SecureStore.deleteItemAsync(access_key);
  await SecureStore.deleteItemAsync(user_key);
}

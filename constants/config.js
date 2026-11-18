// the Firebase settings come from .env (git ignored), never from the code, so the real address is never committed
// Expo copies EXPO_PUBLIC_ values into the app when it bundles, so after changing .env run npx expo start -c
// .env.example shows what goes in .env

// the Realtime Database address, like https://your-project-default-rtdb.firebaseio.com (no slash at the end)
// it's read inside a function so the tests can set it, and a trailing slash gets trimmed in case one sneaks in
export function firebaseDbUrl() {
  const value = process.env.EXPO_PUBLIC_FIREBASE_DB_URL || '';
  return value.trim().replace(/\/+$/, '');
}

// the web API key is only kept for next milestone's Firebase Auth, nothing uses it yet, so it can be blank
// assignment 12: Firebase Auth uses it now, util/auth.js puts it on every sign up, log in, and refresh request
export function firebaseApiKey() {
  return (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
}

// the Auth REST servers, the real Google ones unless .env points somewhere else (the tests and the local fake do)
function trimmedBase(value, fallback) {
  const picked = (value || '').trim() || fallback;
  return picked.replace(/\/+$/, '');
}

// sign up and log in (accounts:signUp, accounts:signInWithPassword) live here
export function firebaseAuthUrl() {
  return trimmedBase(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_URL,
    'https://identitytoolkit.googleapis.com',
  );
}

// trading a refresh token for a new ID token lives here
export function firebaseTokenUrl() {
  return trimmedBase(
    process.env.EXPO_PUBLIC_FIREBASE_TOKEN_URL,
    'https://securetoken.googleapis.com',
  );
}

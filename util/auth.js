// assignment 12: sign up and log in with Firebase Authentication through its REST API, with plain fetch
// this follows the lecture's util/auth.js: one authenticate(mode, email, password) and two small exports
// that call it, createUser and login. the lecture used axios and the API key was typed into the file,
// here the key comes from .env (constants/config.js) and every answer and every failure is handled
// screens never call fetch for this, they go through AuthContext, which calls these
import { firebaseApiKey, firebaseAuthUrl, firebaseTokenUrl } from '../constants/config';

export const auth_timeout_ms = 10000;

// the friendly words for every Firebase Auth code, the raw codes never reach the screen
// the three wrong login codes share one message on purpose, so nobody can tell which half was wrong
const wrong_login = "That email or password isn't right.";
const session_ended = 'Your session ended. Please log in again.';
const auth_messages = {
  EMAIL_EXISTS: 'An account with that email already exists. Log in instead.',
  INVALID_LOGIN_CREDENTIALS: wrong_login,
  EMAIL_NOT_FOUND: wrong_login,
  INVALID_PASSWORD: wrong_login,
  INVALID_EMAIL: "That email doesn't look right. Check it and try again.",
  MISSING_EMAIL: 'Enter your email.',
  MISSING_PASSWORD: 'Enter your password.',
  WEAK_PASSWORD: 'That password is too weak. Use at least 8 characters.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a few minutes and try again.',
  USER_DISABLED: 'This account has been turned off. Ask the person who runs Rent Well for help.',
  OPERATION_NOT_ALLOWED:
    'Email and password sign in is turned off. Turn on Email/Password in the Firebase console under Authentication > Sign-in method.',
  INVALID_API_KEY:
    "The Firebase API key in .env isn't valid. Copy it again from the Firebase console, then restart Expo with npx expo start -c.",
  NOT_CONFIGURED:
    'The Firebase API key is missing. Add EXPO_PUBLIC_FIREBASE_API_KEY to .env, then restart Expo with npx expo start -c.',
  NETWORK_ERROR: "Can't reach the sign in server. Check your connection and try again.",
  TIMEOUT: 'Signing in took too long. Check your connection and try again.',
  // the refresh token answers
  TOKEN_EXPIRED: session_ended,
  USER_NOT_FOUND: session_ended,
  INVALID_REFRESH_TOKEN: session_ended,
  INVALID_GRANT_TYPE: session_ended,
  MISSING_REFRESH_TOKEN: session_ended,
  INVALID_ID_TOKEN: session_ended,
  // Rent Well's own, from AuthContext
  NO_PROFILE: 'This account has no Rent Well profile yet.',
  PROFILE_NOT_SAVED:
    "Your account was made, but your profile didn't save. Check your connection, then sign up again with the same email and password to finish.",
  UNKNOWN: 'Something went wrong signing in. Try again in a moment.',
};

// the refresh codes that mean the saved session is dead for good (log in again), anything else might pass
const rejected_refresh_codes = [
  'TOKEN_EXPIRED',
  'USER_NOT_FOUND',
  'INVALID_REFRESH_TOKEN',
  'INVALID_GRANT_TYPE',
  'MISSING_REFRESH_TOKEN',
  'USER_DISABLED',
  'INVALID_ID_TOKEN',
];

// every screen reads its message from here, an unknown code gets the safe fallback
export function authErrorMessage(code) {
  return auth_messages[code] || auth_messages.UNKNOWN;
}

// one error type for every way auth can fail: code is mine or Firebase's, message is always the friendly one
export class AuthError extends Error {
  constructor(code, status) {
    const known = auth_messages[code] ? code : 'UNKNOWN';
    super(authErrorMessage(known));
    this.name = 'AuthError';
    this.code = known;
    this.status = status || 0;
  }
}

// true when the refresh token itself was turned down, so the app has to sign out
export function isRejectedRefresh(error) {
  return !!error && rejected_refresh_codes.includes(error.code);
}

// true when the phone just couldn't reach Google, so the saved session is kept and tried again later
export function isNetworkFailure(error) {
  return !!error && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT');
}

// Firebase sends the code as the start of the message, sometimes with more after it
// like "WEAK_PASSWORD : Password should be at least 6 characters", so I only keep the first word
export function codeFromBody(body) {
  const error = body && typeof body === 'object' ? body.error : null;
  if (typeof error === 'string') {
    // the older token answer is { error: 'invalid_grant' }
    return error === 'invalid_grant' ? 'INVALID_REFRESH_TOKEN' : error.toUpperCase();
  }
  const message = error && typeof error.message === 'string' ? error.message : '';
  if (message.startsWith('API key not valid')) {
    return 'INVALID_API_KEY';
  }
  const first = message.split(':')[0].trim().split(' ')[0];
  return first || 'UNKNOWN';
}

// step 1: one POST with the time limit, both auth servers go through here
async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), auth_timeout_ms);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    // an abort means my own timer ran out, anything else means the phone couldn't reach Google
    if (controller.signal.aborted || (error && error.name === 'AbortError')) {
      throw new AuthError('TIMEOUT', 0);
    }
    throw new AuthError('NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new AuthError(codeFromBody(data), response.status);
  }
  return data || {};
}

// the key goes on the url once (the lecture added it twice), and a missing key stops here with a setup message
function keyOrThrow() {
  const key = firebaseApiKey();
  if (!key) {
    throw new AuthError('NOT_CONFIGURED', 0);
  }
  return key;
}

// Firebase says how many seconds the token lasts, I keep the moment it runs out instead
function expiresAtFrom(expires_in) {
  const seconds = Number(expires_in) || 3600;
  return Date.now() + seconds * 1000;
}

// step 2: mode is "signUp" or "signInWithPassword", the url and the body are the lecture's
export async function authenticate(mode, email, password) {
  const url =
    firebaseAuthUrl() + '/v1/accounts:' + mode + '?key=' + encodeURIComponent(keyOrThrow());
  const data = await postJson(url, {
    email: email,
    password: password,
    returnSecureToken: true,
  });
  // the lecture never returned anything, so there was no token, this hands back what the app keeps
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    expiresAt: expiresAtFrom(data.expiresIn),
  };
}

// step 3: the two small helpers the screens' actions use
export function createUser(email, password) {
  return authenticate('signUp', email, password);
}

export function login(email, password) {
  return authenticate('signInWithPassword', email, password);
}

// step 4: an ID token lasts an hour, the refresh token trades in for a new one
// the token server answers in snake_case, so it gets turned into the same shape as a log in
export async function refreshSession(refresh_token) {
  const url = firebaseTokenUrl() + '/v1/token?key=' + encodeURIComponent(keyOrThrow());
  const data = await postJson(url, {
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
  });
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || refresh_token,
    localId: data.user_id,
    expiresAt: expiresAtFrom(data.expires_in),
  };
}

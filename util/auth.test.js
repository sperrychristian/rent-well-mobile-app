import {
  authenticate,
  createUser,
  login,
  refreshSession,
  authErrorMessage,
  AuthError,
  codeFromBody,
  isRejectedRefresh,
  isNetworkFailure,
  auth_timeout_ms,
} from './auth';
import {
  installFakeFirebase,
  uninstallFakeFirebase,
  test_auth_url,
  test_token_url,
  test_api_key,
} from '../scripts/testing/fakeFirebase';

// made-up values only
const email = 'new.landlord@example.com';
const password = 'long-enough-1';

afterEach(() => {
  uninstallFakeFirebase();
  jest.useRealTimers();
});

// a fetch that answers one Firebase error body
function answerWith(status, body) {
  global.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status: status,
    text: async () => JSON.stringify(body),
  }));
}

function firebaseError(message) {
  return { error: { code: 400, message: message, status: 'INVALID_ARGUMENT' } };
}

describe('the lecture helpers against the fake Auth', () => {
  test('createUser posts to accounts:signUp once with the key, and hands back the session', async () => {
    const firebase = installFakeFirebase();
    const before = Date.now();
    const session = await createUser(email, password);
    expect(session.idToken).toMatch(/^fake-id-/);
    expect(session.refreshToken).toMatch(/^fake-refresh-/);
    expect(session.localId).toBe(firebase.auth.accountFor(email).local_id);
    expect(session.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    const call = firebase.fetch.calls[0];
    expect(call.url).toBe(test_auth_url + '/v1/accounts:signUp?key=' + test_api_key);
    // the lecture's bug: the key only shows up once
    expect(call.url.split('key=')).toHaveLength(2);
    expect(JSON.parse(call.body)).toEqual({
      email: email,
      password: password,
      returnSecureToken: true,
    });
  });

  test('login posts to accounts:signInWithPassword and gets the same localId back', async () => {
    const firebase = installFakeFirebase();
    const made = await createUser(email, password);
    const session = await login(email, password);
    expect(session.localId).toBe(made.localId);
    expect(firebase.fetch.calls[1].url).toContain('/v1/accounts:signInWithPassword?key=');
  });

  test('authenticate takes the mode straight into the url', async () => {
    const firebase = installFakeFirebase();
    await authenticate('signUp', email, password);
    expect(firebase.auth.counts.signUp).toBe(1);
  });

  test('refreshSession trades the refresh token and turns the snake_case answer into the same shape', async () => {
    const firebase = installFakeFirebase();
    const made = await createUser(email, password);
    const fresh = await refreshSession(made.refreshToken);
    expect(fresh.idToken).not.toBe(made.idToken);
    expect(fresh.localId).toBe(made.localId);
    expect(fresh.refreshToken).toBe(made.refreshToken);
    expect(firebase.fetch.calls[1].url).toBe(test_token_url + '/v1/token?key=' + test_api_key);
    expect(JSON.parse(firebase.fetch.calls[1].body)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: made.refreshToken,
    });
  });

  test('a refresh token the server never gave out is rejected for good', async () => {
    installFakeFirebase();
    const error = await refreshSession('made-up').catch((caught) => caught);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(isRejectedRefresh(error)).toBe(true);
  });

  test('signing up twice with one email says the email is taken', async () => {
    installFakeFirebase();
    await createUser(email, password);
    await expect(createUser(email, password)).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });

  test('a wrong password gets the one generic message', async () => {
    installFakeFirebase();
    await createUser(email, password);
    await expect(login(email, 'wrong-password')).rejects.toMatchObject({
      code: 'INVALID_LOGIN_CREDENTIALS',
      message: "That email or password isn't right.",
    });
  });
});

describe('every Firebase code becomes a plain message', () => {
  const cases = [
    ['EMAIL_EXISTS', 'An account with that email already exists. Log in instead.'],
    ['INVALID_LOGIN_CREDENTIALS', "That email or password isn't right."],
    ['EMAIL_NOT_FOUND', "That email or password isn't right."],
    ['INVALID_PASSWORD', "That email or password isn't right."],
    ['INVALID_EMAIL', "That email doesn't look right. Check it and try again."],
    [
      'WEAK_PASSWORD : Password should be at least 6 characters',
      'That password is too weak. Use at least 8 characters.',
    ],
    [
      'TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled',
      'Too many tries. Wait a few minutes and try again.',
    ],
    [
      'USER_DISABLED',
      'This account has been turned off. Ask the person who runs Rent Well for help.',
    ],
    [
      'OPERATION_NOT_ALLOWED',
      'Email and password sign in is turned off. Turn on Email/Password in the Firebase console under Authentication > Sign-in method.',
    ],
    [
      'API key not valid. Please pass a valid API key.',
      "The Firebase API key in .env isn't valid. Copy it again from the Firebase console, then restart Expo with npx expo start -c.",
    ],
  ];

  test.each(cases)('%s', async (firebase_message, shown) => {
    installFakeFirebase();
    answerWith(400, firebaseError(firebase_message));
    const error = await login(email, password).catch((caught) => caught);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toBe(shown);
    // the raw code never shows
    expect(error.message).not.toMatch(/[A-Z]{4,}_[A-Z]+/);
  });

  test('an unknown code gets the safe fallback, never the raw text', async () => {
    installFakeFirebase();
    answerWith(400, firebaseError('SOMETHING_NEW_FROM_GOOGLE'));
    const error = await login(email, password).catch((caught) => caught);
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('Something went wrong signing in. Try again in a moment.');
    expect(error.message).not.toContain('SOMETHING_NEW');
  });

  test('a body that is not JSON is the fallback too', async () => {
    installFakeFirebase();
    global.fetch = jest.fn(async () => ({ ok: false, status: 502, text: async () => '<html>' }));
    await expect(login(email, password)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  test('the old token answer { error: "invalid_grant" } counts as a rejected refresh', () => {
    expect(codeFromBody({ error: 'invalid_grant' })).toBe('INVALID_REFRESH_TOKEN');
    expect(codeFromBody(null)).toBe('UNKNOWN');
  });

  test('the rejected refresh codes all mean log in again', () => {
    ['TOKEN_EXPIRED', 'USER_NOT_FOUND', 'INVALID_REFRESH_TOKEN'].forEach((code) => {
      expect(isRejectedRefresh(new AuthError(code))).toBe(true);
      expect(authErrorMessage(code)).toBe('Your session ended. Please log in again.');
    });
    expect(isRejectedRefresh(new AuthError('NETWORK_ERROR'))).toBe(false);
  });
});

describe('network trouble', () => {
  test('no connection says so', async () => {
    installFakeFirebase();
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const error = await login(email, password).catch((caught) => caught);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(isNetworkFailure(error)).toBe(true);
    expect(error.message).toBe(
      "Can't reach the sign in server. Check your connection and try again.",
    );
  });

  test('a call that never answers stops after 10 seconds', async () => {
    installFakeFirebase();
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const pending = login(email, password).catch((caught) => caught);
    jest.advanceTimersByTime(auth_timeout_ms);
    const error = await pending;
    expect(error.code).toBe('TIMEOUT');
    expect(isNetworkFailure(error)).toBe(true);
  });

  test('with no API key it stops before any request with the setup message', async () => {
    installFakeFirebase();
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    global.fetch = jest.fn();
    await expect(login(email, password)).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
      message:
        'The Firebase API key is missing. Add EXPO_PUBLIC_FIREBASE_API_KEY to .env, then restart Expo with npx expo start -c.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('secrets stay out of messages', () => {
  test('no token, password, or key ever ends up in an error', async () => {
    const firebase = installFakeFirebase();
    const made = await createUser(email, password);
    firebase.auth.revokeRefresh(made.localId);
    const errors = [
      await refreshSession(made.refreshToken).catch((caught) => caught),
      await login(email, 'wrong-password').catch((caught) => caught),
    ];
    errors.forEach((error) => {
      const text = error.message + JSON.stringify(error);
      expect(text).not.toContain(made.refreshToken);
      expect(text).not.toContain(made.idToken);
      expect(text).not.toContain(test_api_key);
      expect(text).not.toContain('wrong-password');
    });
  });
});

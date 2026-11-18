import { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './AuthContext';
import {
  seededFirebase,
  uninstallFakeFirebase,
  signInAs,
  test_password,
  test_session_key,
} from '../scripts/testing/fakeFirebase';
import { getNode, sessionUser } from '../util/http';
import { currentAuthToken, setAuthToken } from '../util/authToken';

// assignment 12: the token in app-wide state, saved on the phone, restored at launch, refreshed when it's
// about to run out, sent on every database request, and forgotten on log out, all against the fake Auth

jest.mock('../util/navigationRef', () => ({
  resetTo: jest.fn(),
  navigateWhenReady: jest.fn(),
  navigation_ref: { isReady: () => false },
}));

const peek = {};

function AuthPeek() {
  const auth = useAuth();
  useEffect(() => {
    peek.auth = auth;
  });
  return null;
}

async function settle(rounds) {
  for (let index = 0; index < (rounds || 8); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderAuth() {
  const view = render(
    <AuthProvider>
      <AuthPeek />
    </AuthProvider>,
  );
  await settle();
  return view;
}

async function savedSession() {
  const text = await AsyncStorage.getItem(test_session_key);
  return text ? JSON.parse(text) : null;
}

// changes the saved session before the App reads it, like a phone that was closed for a while
async function editSavedSession(changes) {
  const saved = await savedSession();
  await AsyncStorage.setItem(test_session_key, JSON.stringify({ ...saved, ...changes }));
}

function databaseCalls(firebase) {
  return firebase.fetch.calls.filter((call) => call.url.includes('firebaseio.com'));
}

let log_spy;

beforeEach(async () => {
  await AsyncStorage.clear();
  Object.keys(peek).forEach((key) => delete peek[key]);
  require('../util/navigationRef').resetTo.mockClear();
  log_spy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  log_spy.mockRestore();
  uninstallFakeFirebase();
});

describe('sign up, log in, log out', () => {
  test('a landlord signs up: the token is in state, on the phone, and on every database request', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    await renderAuth();
    expect(peek.auth.isAuthenticated).toBe(false);
    await act(async () => {
      await peek.auth.registerOwner({
        name: 'Robin Hale',
        email: 'robin@example.com',
        password: test_password,
      });
    });
    expect(peek.auth.isAuthenticated).toBe(true);
    expect(peek.auth.token).toMatch(/^fake-id-/);
    expect(currentAuthToken()).toBe(peek.auth.token);
    const saved = await savedSession();
    expect(saved).toMatchObject({ idToken: peek.auth.token, localId: peek.auth.localId });
    expect(saved.user).toMatchObject({ id: peek.auth.localId, role: 'owner' });
    // the profile write went out with the token, the rules let it through
    const writes = databaseCalls(firebase).filter((call) => call.method === 'PATCH');
    expect(writes.length).toBeGreaterThan(0);
    writes.forEach((call) => expect(call.url).toContain('.json?auth=fake-id-'));
    expect(firebase.database.dump().authLinks[peek.auth.localId]).toBe(peek.auth.localId);
  });

  test('log in reads the profile through authLinks, log out clears storage and memory', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await renderAuth();
    await act(async () => {
      await peek.auth.login(email, test_password);
    });
    expect(peek.auth.user).toMatchObject({ id: 'owner-taylor', role: 'owner' });
    expect(sessionUser().id).toBe('owner-taylor');
    await act(async () => {
      await peek.auth.logout();
    });
    expect(peek.auth.status).toBe('signed_out');
    expect(peek.auth.token).toBeNull();
    expect(peek.auth.opens_on_login).toBe(true);
    expect(currentAuthToken()).toBeNull();
    expect(sessionUser()).toBeNull();
    expect(await savedSession()).toBeNull();
  });

  test('a wrong password says so and nothing is saved', async () => {
    const firebase = seededFirebase();
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await renderAuth();
    let caught;
    await act(async () => {
      caught = await peek.auth.login(email, 'not-the-password').catch((error) => error);
    });
    expect(caught.message).toBe("That email or password isn't right.");
    expect(peek.auth.status).toBe('signed_out');
    expect(await savedSession()).toBeNull();
  });

  test('a Firebase account with no link is signed out with the no profile message', async () => {
    const firebase = seededFirebase();
    firebase.auth.addAccount('stray@example.com', test_password);
    await renderAuth();
    let caught;
    await act(async () => {
      caught = await peek.auth.login('stray@example.com', test_password).catch((error) => error);
    });
    expect(caught.message).toBe('This account has no Rent Well profile yet.');
    expect(peek.auth.status).toBe('signed_out');
    expect(currentAuthToken()).toBeNull();
    expect(await savedSession()).toBeNull();
  });

  test('a profile that did not save says so, and signing up again with the same email finishes it', async () => {
    const firebase = seededFirebase();
    await renderAuth();
    firebase.fetch.fail_status = 500;
    const fields = { name: 'Robin Hale', email: 'robin@example.com', password: test_password };
    let caught;
    await act(async () => {
      caught = await peek.auth.registerOwner(fields).catch((error) => error);
    });
    expect(caught.code).toBe('PROFILE_NOT_SAVED');
    expect(caught.message).toMatch(/account was made, but your profile didn't save/);
    expect(peek.auth.status).toBe('signed_out');
    firebase.fetch.fail_status = 0;
    await act(async () => {
      await peek.auth.registerOwner(fields);
    });
    // the second try signed in to the account it made the first time and wrote the profile
    expect(firebase.auth.counts.signUp).toBe(2);
    expect(firebase.auth.counts.signInWithPassword).toBe(1);
    expect(peek.auth.user).toMatchObject({ role: 'owner', name: 'Robin Hale' });
  });

  test('signing up with an email someone else has (another password) is just "email taken"', async () => {
    const firebase = seededFirebase();
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await renderAuth();
    let caught;
    await act(async () => {
      caught = await peek.auth
        .registerOwner({ name: 'Copy Cat', email: email, password: 'different-pass' })
        .catch((error) => error);
    });
    expect(caught.code).toBe('EMAIL_EXISTS');
    // and with the right password it's a log in, not a second profile
    await act(async () => {
      caught = await peek.auth
        .registerOwner({ name: 'Copy Cat', email: email, password: test_password })
        .catch((error) => error);
    });
    expect(caught.code).toBe('EMAIL_EXISTS');
    expect(peek.auth.status).toBe('signed_out');
  });
});

describe('auto-login at launch', () => {
  test('a saved, still good token opens signed in with no refresh', async () => {
    const firebase = seededFirebase();
    await signInAs(firebase, 'tenant-sam');
    await renderAuth();
    expect(peek.auth.status).toBe('signed_in');
    expect(peek.auth.user).toMatchObject({ id: 'tenant-sam', role: 'tenant' });
    expect(firebase.auth.counts.token).toBe(0);
  });

  test('an expired token refreshes quietly and the new one is saved', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    const { session } = await signInAs(firebase, 'tenant-sam');
    firebase.auth.expireTokens();
    await editSavedSession({ expiresAt: Date.now() - 1000 });
    await renderAuth();
    expect(peek.auth.status).toBe('signed_in');
    expect(firebase.auth.counts.token).toBe(1);
    expect(peek.auth.token).not.toBe(session.idToken);
    expect((await savedSession()).idToken).toBe(peek.auth.token);
    expect((await savedSession()).expiresAt).toBeGreaterThan(Date.now());
  });

  test('a token within 5 minutes of running out refreshes too', async () => {
    const firebase = seededFirebase();
    await signInAs(firebase, 'tenant-sam');
    await editSavedSession({ expiresAt: Date.now() + 2 * 60 * 1000 });
    await renderAuth();
    expect(firebase.auth.counts.token).toBe(1);
  });

  test('a rejected refresh signs out with the session ended note and goes to Login', async () => {
    const firebase = seededFirebase();
    const { local_id } = await signInAs(firebase, 'tenant-sam');
    firebase.auth.revokeRefresh(local_id);
    await editSavedSession({ expiresAt: Date.now() - 1000 });
    await renderAuth();
    expect(peek.auth.status).toBe('signed_out');
    expect(peek.auth.session_expired).toBe(true);
    expect(require('../util/navigationRef').resetTo).toHaveBeenCalledWith('Login');
    expect(await savedSession()).toBeNull();
  });

  test('offline, an expired token still opens signed in from the saved copy', async () => {
    const firebase = seededFirebase();
    await signInAs(firebase, 'tenant-sam');
    await editSavedSession({ expiresAt: Date.now() - 1000 });
    firebase.fetch.offline = true;
    await renderAuth();
    expect(peek.auth.status).toBe('signed_in');
    expect(peek.auth.user).toMatchObject({ id: 'tenant-sam' });
    expect(await savedSession()).not.toBeNull();
  });

  test('nothing saved opens signed out', async () => {
    seededFirebase();
    await renderAuth();
    expect(peek.auth.status).toBe('signed_out');
    expect(peek.auth.session_expired).toBe(false);
  });
});

describe('the token on database requests', () => {
  test('two quick requests that both need a refresh share one refresh call', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    await signInAs(firebase, 'owner-taylor');
    await renderAuth();
    // the token is about to run out
    setAuthToken(currentAuthToken(), Date.now() + 1000);
    const before = firebase.auth.counts.token;
    await act(async () => {
      await Promise.all([getNode('properties'), getNode('tenancies')]);
    });
    expect(firebase.auth.counts.token - before).toBe(1);
  });

  test('a 401 is retried exactly once after a refresh', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    await signInAs(firebase, 'owner-taylor');
    await renderAuth();
    // the server stops taking the token, the phone still thinks it's good
    firebase.auth.expireTokens();
    const before = databaseCalls(firebase).length;
    let properties;
    await act(async () => {
      properties = await getNode('properties');
    });
    expect(Object.keys(properties).length).toBeGreaterThan(0);
    expect(firebase.auth.counts.token).toBe(1);
    expect(databaseCalls(firebase).length - before).toBe(2);
    expect(peek.auth.status).toBe('signed_in');
  });

  test('a second 401 after a rejected refresh signs out with the permission message', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    const { local_id } = await signInAs(firebase, 'owner-taylor');
    await renderAuth();
    firebase.auth.expireTokens();
    firebase.auth.revokeRefresh(local_id);
    let caught;
    await act(async () => {
      caught = await getNode('properties').catch((error) => error);
    });
    expect(caught.code).toBe('PERMISSION_DENIED');
    expect(peek.auth.status).toBe('signed_out');
    expect(peek.auth.session_expired).toBe(true);
    expect(require('../util/navigationRef').resetTo).toHaveBeenCalledWith('Login');
  });

  test('a 401 that keeps coming after a good refresh fails once, without a loop or a sign out', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    await signInAs(firebase, 'owner-taylor');
    await renderAuth();
    firebase.auth.isValidToken = () => false;
    const before = databaseCalls(firebase).length;
    let caught;
    await act(async () => {
      caught = await getNode('properties').catch((error) => error);
    });
    expect(caught.code).toBe('PERMISSION_DENIED');
    expect(databaseCalls(firebase).length - before).toBe(2);
    expect(peek.auth.status).toBe('signed_in');
  });

  test('tokens never show up in logs or error text', async () => {
    const firebase = seededFirebase(undefined, { require_auth: true });
    const { local_id, session } = await signInAs(firebase, 'owner-taylor');
    const warn_spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error_spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderAuth();
    firebase.auth.expireTokens();
    firebase.auth.revokeRefresh(local_id);
    let caught;
    await act(async () => {
      caught = await getNode('properties').catch((error) => error);
    });
    const logged = [log_spy, warn_spy, error_spy]
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map((arg) => String(arg && arg.message ? arg.message : arg)).join(' '))
      .join('\n');
    [session.idToken, session.refreshToken].forEach((secret) => {
      expect(logged).not.toContain(secret);
      expect(caught.message).not.toContain(secret);
      expect(JSON.stringify(caught)).not.toContain(secret);
    });
    expect(caught.message).not.toContain('auth=');
    warn_spy.mockRestore();
    error_spy.mockRestore();
  });
});

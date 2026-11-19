// for the tests: points the app at a fake database and swaps fetch for one that answers from it
// const firebase = installFakeFirebase(seed) gives back { database, fetch }, call uninstallFakeFirebase() after
// assignment 12: it also points the app at a fake Firebase Auth, so firebase.auth signs people up and in,
// and { require_auth: true } makes the database turn away any request without a token the fake gave out
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeDatabase, createFakeFetch } from '../fakeDatabase';
import { createFakeAuth } from '../fakeAuth';
import { buildSeedData } from '../seedData';

export const test_db_url = 'https://rent-well-test-default-rtdb.firebaseio.com';
// made-up values only, the tests never see the real project
export const test_auth_url = 'https://auth.rent-well.test';
export const test_token_url = 'https://token.rent-well.test';
export const test_api_key = 'test-api-key';
// the password every account made by signInAs gets
export const test_password = 'test-pass-1234';
// the one key the saved session lives under (util/storageKeys.js has the same value)
export const test_session_key = 'rent_well_auth_session';

const env_names = [
  'EXPO_PUBLIC_FIREBASE_DB_URL',
  'EXPO_PUBLIC_FIREBASE_AUTH_URL',
  'EXPO_PUBLIC_FIREBASE_TOKEN_URL',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
];

let saved_fetch = null;
let saved_env = null;

export function installFakeFirebase(initial, options) {
  const settings = options || {};
  saved_fetch = saved_fetch || global.fetch;
  if (!saved_env) {
    saved_env = {};
    env_names.forEach((name) => (saved_env[name] = process.env[name]));
  }
  process.env.EXPO_PUBLIC_FIREBASE_DB_URL = test_db_url;
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_URL = test_auth_url;
  process.env.EXPO_PUBLIC_FIREBASE_TOKEN_URL = test_token_url;
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = test_api_key;
  const database = createFakeDatabase(initial === undefined ? null : initial);
  const auth = createFakeAuth({
    api_key: test_api_key,
    token_lifetime_s: settings.token_lifetime_s,
  });
  const fake_fetch = createFakeFetch(database, test_db_url, {
    auth: auth,
    auth_base: test_auth_url,
    token_base: test_token_url,
    require_auth: settings.require_auth,
  });
  global.fetch = fake_fetch;
  return { database, auth, fetch: fake_fetch };
}

export function uninstallFakeFirebase() {
  if (saved_fetch) {
    global.fetch = saved_fetch;
  }
  saved_fetch = null;
  if (saved_env) {
    env_names.forEach((name) => {
      if (saved_env[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved_env[name];
      }
    });
  }
  saved_env = null;
}

// the seeded database, with today fixed so the ledger numbers are the same every run
export function seededFirebase(now, options) {
  return installFakeFirebase(buildSeedData(now || new Date()), options);
}

// gives a seeded user a fake Auth account, links it (authLinks plus authUid, the way the seed script does),
// and saves a signed-in session on the "phone", so the next App render opens signed in like a relaunch
export async function signInAs(firebase, user_id) {
  const record = firebase.database.dump().users[user_id];
  const email = record.email || user_id + '@example.com';
  const local_id = firebase.auth.addAccount(email, test_password);
  firebase.database.handle('PATCH', '', {
    ['authLinks/' + local_id]: user_id,
    ['users/' + user_id + '/authUid']: local_id,
  });
  const session = {
    ...firebase.auth.sessionFor(email),
    user: {
      id: user_id,
      role: record.role === 'tenant' ? 'tenant' : 'owner',
      name: record.name || '',
      email: record.email || '',
      ownerId: record.ownerId || null,
    },
  };
  await AsyncStorage.setItem(test_session_key, JSON.stringify(session));
  return { session, email, local_id };
}

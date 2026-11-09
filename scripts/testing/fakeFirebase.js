// for the tests: points the app at a fake database and swaps fetch for one that answers from it
// const firebase = installFakeFirebase(seed) gives back { database, fetch }, call uninstallFakeFirebase() after
import { createFakeDatabase, createFakeFetch } from '../fakeDatabase';
import { buildSeedData } from '../seedData';

export const test_db_url = 'https://rent-well-test-default-rtdb.firebaseio.com';

let saved_fetch = null;
let saved_url;

export function installFakeFirebase(initial) {
  saved_fetch = saved_fetch || global.fetch;
  saved_url = process.env.EXPO_PUBLIC_FIREBASE_DB_URL;
  process.env.EXPO_PUBLIC_FIREBASE_DB_URL = test_db_url;
  const database = createFakeDatabase(initial === undefined ? null : initial);
  const fake_fetch = createFakeFetch(database, test_db_url);
  global.fetch = fake_fetch;
  return { database, fetch: fake_fetch };
}

export function uninstallFakeFirebase() {
  if (saved_fetch) {
    global.fetch = saved_fetch;
  }
  saved_fetch = null;
  if (saved_url === undefined) {
    delete process.env.EXPO_PUBLIC_FIREBASE_DB_URL;
  } else {
    process.env.EXPO_PUBLIC_FIREBASE_DB_URL = saved_url;
  }
}

// the seeded database, with today fixed so the ledger numbers are the same every run
export function seededFirebase(now) {
  return installFakeFirebase(buildSeedData(now || new Date()));
}

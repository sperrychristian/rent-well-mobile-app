import { runSeed, seedEmailFor, accountTable } from './seedRunner';
import {
  installFakeFirebase,
  uninstallFakeFirebase,
  test_db_url,
  test_auth_url,
  test_api_key,
} from './testing/fakeFirebase';

// assignment 12: the seed makes a Firebase Auth account per seeded user, links it, and writes with a token,
// so it has to work with the database requiring auth, and a second run has to give the same result

const settings = {
  db_url: test_db_url,
  auth_url: test_auth_url,
  api_key: test_api_key,
  // a made-up password, only for the fake
  password: 'seed-pass-for-tests',
};

afterEach(uninstallFakeFirebase);

test('it makes an account per seeded user, links them, and every node checks out with auth required', async () => {
  const firebase = installFakeFirebase(null, { require_auth: true });
  const result = await runSeed({ ...settings, check: true });
  expect(result.failures).toBe(0);
  expect(result.accounts).toHaveLength(8);
  expect(result.accounts.every((row) => row.made)).toBe(true);
  const tree = firebase.database.dump();
  result.accounts.forEach((row) => {
    expect(tree.authLinks[row.local_id]).toBe(row.user_id);
    expect(tree.users[row.user_id].authUid).toBe(row.local_id);
    expect(firebase.auth.accountFor(row.email).local_id).toBe(row.local_id);
  });
  const taylor = result.accounts.find((row) => row.user_id === 'owner-taylor');
  expect(taylor).toMatchObject({ email: 'taylor@example.com', role: 'owner' });
  // nothing secret comes back
  expect(JSON.stringify(result.accounts)).not.toMatch(/fake-id-|fake-refresh-|seed-pass/);
});

test('running it twice in a row signs in to the same accounts and gives the same data', async () => {
  const firebase = installFakeFirebase(null, { require_auth: true });
  const now = new Date();
  const first = await runSeed({ ...settings, now: now });
  const after_first = firebase.database.dump();
  const second = await runSeed({ ...settings, now: now, check: true });
  expect(second.failures).toBe(0);
  expect(second.accounts.every((row) => !row.made)).toBe(true);
  expect(second.accounts.map((row) => row.local_id)).toEqual(
    first.accounts.map((row) => row.local_id),
  );
  // the same records in every node (a few seeded timestamps read the clock, so values can move by a millisecond)
  const after_second = firebase.database.dump();
  Object.keys(after_first).forEach((node) => {
    expect(Object.keys(after_second[node]).sort()).toEqual(Object.keys(after_first[node]).sort());
  });
  expect(after_second.authLinks).toEqual(after_first.authLinks);
});

test('a record made in the app survives a second seed', async () => {
  const firebase = installFakeFirebase(null);
  await runSeed(settings);
  firebase.database.handle('PATCH', '', {
    'users/uid-new': { id: 'uid-new', role: 'owner', name: 'New Landlord' },
    'authLinks/uid-new': 'uid-new',
  });
  await runSeed(settings);
  const tree = firebase.database.dump();
  expect(tree.users['uid-new']).toBeTruthy();
  expect(tree.authLinks['uid-new']).toBe('uid-new');
});

test('a seeded account with another password stops with a clear message, never the password', async () => {
  const firebase = installFakeFirebase(null);
  firebase.auth.addAccount('taylor@example.com', 'someone-elses');
  const error = await runSeed(settings).catch((caught) => caught);
  expect(error.message).toMatch(/taylor@example.com already exists with a different password/);
  expect(error.message).not.toContain(settings.password);
});

test('it refuses to run without a seed password of 8 or more', async () => {
  installFakeFirebase(null);
  await expect(runSeed({ ...settings, password: '' })).rejects.toThrow(/SEED_ACCOUNT_PASSWORD/);
  await expect(runSeed({ ...settings, password: 'short' })).rejects.toThrow(
    /SEED_ACCOUNT_PASSWORD/,
  );
});

test('an account with no email gets a clearly fake one, and the table has emails only', () => {
  expect(seedEmailFor({ name: 'Pat Q. Smith' })).toBe('pat.q.smith@example.com');
  expect(seedEmailFor({ name: 'X', email: 'Real@Example.com' })).toBe('real@example.com');
  const table = accountTable([
    { role: 'owner', name: 'Taylor Brooks', email: 'taylor@example.com' },
  ]);
  expect(table).toContain('landlord');
  expect(table).toContain('taylor@example.com');
});

import { getUser, getUserByAuth, createOwnerProfile, createTenantProfile } from './users';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

// assignment 12: the test accounts list is gone (Firebase Auth signs people in), so these check the
// authLinks lookup and the two profile writes keyed by the Firebase localId

afterEach(uninstallFakeFirebase);

test('a user record is read by id, and a Firebase account finds its record through authLinks', async () => {
  const firebase = seededFirebase();
  expect(await getUser('tenant-sam')).toMatchObject({ ownerId: 'owner-taylor', role: 'tenant' });
  expect(await getUser('nobody')).toBeNull();
  expect(await getUserByAuth('uid-sam')).toBeNull();
  firebase.database.handle('PUT', 'authLinks/uid-sam', 'tenant-sam');
  expect(await getUserByAuth('uid-sam')).toMatchObject({ id: 'tenant-sam', role: 'tenant' });
});

test('a landlord profile is keyed by the localId, linked in the same write, and an email in use is turned away', async () => {
  const firebase = seededFirebase();
  const writes_before = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  const user = await createOwnerProfile('uid-lee', { name: ' Lee Ann ', email: 'LEE@example.com' });
  expect(user).toMatchObject({
    id: 'uid-lee',
    role: 'owner',
    name: 'Lee Ann',
    email: 'lee@example.com',
  });
  const tree = firebase.database.dump();
  expect(tree.users['uid-lee']).toMatchObject({ role: 'owner', authUid: 'uid-lee' });
  expect(tree.authLinks['uid-lee']).toBe('uid-lee');
  const writes_after = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  expect(writes_after - writes_before).toBe(1);
  await expect(
    createOwnerProfile('uid-other', { name: 'Again', email: 'lee@example.com' }),
  ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  // the same account finishing its own profile again is fine
  await expect(
    createOwnerProfile('uid-lee', { name: 'Lee Ann', email: 'lee@example.com' }),
  ).resolves.toMatchObject({ id: 'uid-lee' });
});

test('a tenant signs up with a pending invite: user, tenancy, conversation, link, and a used invite in one write', async () => {
  const firebase = seededFirebase();
  const writes_before = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  const user = await createTenantProfile('uid-casey', {
    invite_code: 'K7M2QX9P',
    email: 'casey@example.com',
    name: '',
  });
  const tree = firebase.database.dump();
  expect(user).toMatchObject({
    id: 'uid-casey',
    role: 'tenant',
    name: 'Casey Nguyen',
    ownerId: 'owner-taylor',
  });
  expect(tree.authLinks['uid-casey']).toBe('uid-casey');
  expect(tree.users['uid-casey'].authUid).toBe('uid-casey');
  const tenancy = Object.values(tree.tenancies).find((item) => item.tenantUserId === user.id);
  expect(tenancy).toMatchObject({
    propertyId: 'prop-maple',
    unitLabel: 'Unit 4',
    status: 'active',
  });
  expect(Object.values(tree.conversations).some((item) => item.tenantUserId === user.id)).toBe(
    true,
  );
  expect(tree.invites['invite-1']).toMatchObject({ status: 'used' });
  const writes_after = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  expect(writes_after - writes_before).toBe(1);
  // the code is used now, so it can't sign up anyone else
  await expect(
    createTenantProfile('uid-other', { invite_code: 'K7M2QX9P', email: 'other@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});

test('an expired or unknown invite code is turned away', async () => {
  seededFirebase();
  await expect(
    createTenantProfile('uid-drew', { invite_code: 'H4TR8WZN', email: 'drew@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  await expect(
    createTenantProfile('uid-x', { invite_code: 'NOPE1234', email: 'x@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});

import { getTestAccounts, getUser, registerOwnerAccount, registerTenantAccount } from './users';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

afterEach(uninstallFakeFirebase);

test('the test accounts list landlords first, then tenants, by name', async () => {
  seededFirebase();
  const accounts = await getTestAccounts();
  expect(accounts[0]).toMatchObject({ role: 'owner', name: 'Jamie Ortiz' });
  expect(accounts[1]).toMatchObject({ id: 'owner-taylor', role: 'owner', name: 'Taylor Brooks' });
  expect(accounts.filter((item) => item.role === 'tenant').map((item) => item.name)).toContain(
    'Sam Rivera',
  );
  expect(await getUser('tenant-sam')).toMatchObject({ ownerId: 'owner-taylor', role: 'tenant' });
  expect(await getUser('nobody')).toBeNull();
});

test('a landlord signs up once, and the same email is turned away the second time', async () => {
  const firebase = seededFirebase();
  const user = await registerOwnerAccount({ name: ' Lee Ann ', email: 'LEE@example.com' });
  expect(user).toMatchObject({ role: 'owner', name: 'Lee Ann', email: 'lee@example.com' });
  expect(firebase.database.dump().users[user.id].role).toBe('owner');
  await expect(
    registerOwnerAccount({ name: 'Again', email: 'lee@example.com' }),
  ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
});

test('a tenant signs up with a pending invite: user, tenancy, conversation, and a used invite in one write', async () => {
  const firebase = seededFirebase();
  const writes_before = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  const user = await registerTenantAccount({
    invite_code: 'K7M2QX9P',
    email: 'casey@example.com',
    name: '',
  });
  const tree = firebase.database.dump();
  expect(user).toMatchObject({ role: 'tenant', name: 'Casey Nguyen', ownerId: 'owner-taylor' });
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
    registerTenantAccount({ invite_code: 'K7M2QX9P', email: 'other@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});

test('an expired or unknown invite code is turned away', async () => {
  seededFirebase();
  await expect(
    registerTenantAccount({ invite_code: 'H4TR8WZN', email: 'drew@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  await expect(
    registerTenantAccount({ invite_code: 'NOPE1234', email: 'x@example.com' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});

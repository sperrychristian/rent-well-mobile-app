import { getTenantData, saveTenantDataChanges, buildTenantDataPatch } from './tenants';
import {
  buildDemoView,
  demoAddProperty,
  demoUpdateProperty,
  demoDeleteProperty,
  demoCreateInvite,
  demoRevokeInvite,
  demoMove,
  demoEnd,
} from '../../features/tenants/utils/demoTenants';
import { demoSetLease, demoRenewLease } from '../../features/leases/utils/demoLeases';
import { findInviteByCode } from './invites';
import { savePaymentInstructions } from './properties';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

afterEach(uninstallFakeFirebase);

const owner_id = 'owner-taylor';
const today = new Date().toISOString().slice(0, 10);
let count = 0;
const makeId = () => 'new-' + ++count;

test('the bundle loads in the demo shape and builds the same tenant view the demo does', async () => {
  seededFirebase();
  const data = await getTenantData(owner_id);
  expect(data.properties.map((item) => item.name).sort()).toEqual(['123 Maple St', '48 Cedar Ave']);
  const view = buildDemoView(data, [], new Date());
  const sam = view.tenants.find((tenant) => tenant.id === 'tenant-sam');
  expect(sam.active_tenancies[0]).toMatchObject({
    unit_label: 'Unit 2',
    property_name: '123 Maple St',
  });
  expect(sam.active_tenancies[0].lease.lease_status).toBe('expiring_soon');
  expect(sam.conversation_id).toBe('convo-sam');
  const morgan = view.tenants.find((tenant) => tenant.id === 'tenant-morgan');
  expect(morgan.is_active).toBe(false);
  // Riley shares Sam's unit
  const riley = view.tenants.find((tenant) => tenant.id === 'tenant-riley');
  expect(riley.active_tenancies[0].unit_label).toBe('Unit 2');
  // an empty landlord gets empty lists, never an error
  const empty = await getTenantData('owner-jamie');
  expect(empty).toMatchObject({ properties: [], tenants: [], tenancies: [], invites: [] });
});

test('nothing changed means nothing is written', async () => {
  seededFirebase();
  const data = await getTenantData(owner_id);
  expect(buildTenantDataPatch(data, data, owner_id)).toEqual({});
});

test('properties: add, rename (the tenancy copies follow), delete is blocked while tenants live there', async () => {
  const firebase = seededFirebase();
  let data = await getTenantData(owner_id);
  const added = demoAddProperty(
    data,
    { name: '9 Oak Ln', address: '9 Oak Ln, Springfield' },
    makeId,
  );
  await saveTenantDataChanges(data, added.data, owner_id);
  data = await getTenantData(owner_id);
  expect(data.properties.some((item) => item.name === '9 Oak Ln')).toBe(true);

  const renamed = demoUpdateProperty(data, 'prop-cedar', { name: '48 Cedar Avenue', address: 'x' });
  const patch = buildTenantDataPatch(data, renamed.data || renamed, owner_id);
  expect(patch['tenancies/tenancy-alex/propertyName']).toBe('48 Cedar Avenue');
  await saveTenantDataChanges(data, renamed.data || renamed, owner_id);
  expect(firebase.database.dump().tenancies['tenancy-alex'].propertyName).toBe('48 Cedar Avenue');

  data = await getTenantData(owner_id);
  expect(() => demoDeleteProperty(data, 'prop-maple', [], new Date())).toThrow(
    expect.objectContaining({ code: 'PROPERTY_HAS_ACTIVE_TENANCY' }),
  );
  const oak = data.properties.find((item) => item.name === '9 Oak Ln');
  const deleted = demoDeleteProperty(data, oak.id, [], new Date());
  await saveTenantDataChanges(data, deleted.data || deleted, owner_id);
  const after = await getTenantData(owner_id);
  expect(buildDemoView(after, [], new Date()).properties.some((item) => item.id === oak.id)).toBe(
    false,
  );
});

test('invites: create, find by code, revoke', async () => {
  seededFirebase();
  let data = await getTenantData(owner_id);
  const created = demoCreateInvite(
    data,
    { property_id: 'prop-cedar', tenant_name: 'Quinn', unit_label: '' },
    new Date(),
    makeId,
    () => 'ZZZZ2222',
  );
  await saveTenantDataChanges(data, created.data, owner_id);
  expect(await findInviteByCode('ZZZZ2222')).toMatchObject({
    tenantName: 'Quinn',
    status: 'pending',
  });
  data = await getTenantData(owner_id);
  const revoked = demoRevokeInvite(data, created.invite.id, new Date());
  await saveTenantDataChanges(data, revoked.data, owner_id);
  expect(await findInviteByCode('ZZZZ2222')).toMatchObject({ status: 'revoked' });
});

test('a move ends one tenancy and starts another in one atomic write, and end makes the tenant a former tenant', async () => {
  const firebase = seededFirebase();
  let data = await getTenantData(owner_id);
  const patches_before = firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
  const moved = demoMove(
    data,
    'tenancy-jordan',
    { property_id: 'prop-cedar', unit_label: 'Upstairs' },
    today,
    new Date(),
    makeId,
  );
  await saveTenantDataChanges(data, moved.data || moved, owner_id);
  expect(firebase.fetch.calls.filter((call) => call.method === 'PATCH').length).toBe(
    patches_before + 1,
  );
  const tree = firebase.database.dump();
  expect(tree.tenancies['tenancy-jordan'].status).toBe('ended');
  expect(
    Object.values(tree.tenancies).some(
      (item) => item.tenantUserId === 'tenant-jordan' && item.status === 'active',
    ),
  ).toBe(true);

  data = await getTenantData(owner_id);
  const ended = demoEnd(data, 'tenancy-alex', { move_out_note: 'Moved away' }, today);
  await saveTenantDataChanges(data, ended.data || ended, owner_id);
  const view = buildDemoView(await getTenantData(owner_id), [], new Date());
  expect(view.tenants.find((tenant) => tenant.id === 'tenant-alex').is_active).toBe(false);
});

test('leases: set for a tenancy with none, then renew, with timeline events', async () => {
  const firebase = seededFirebase();
  let data = await getTenantData(owner_id);
  const set = demoSetLease(
    data,
    'tenancy-alex',
    {
      lease_start_on: today,
      lease_end_on: today.slice(0, 4) * 1 + 1 + today.slice(4),
      lease_term: 'fixed',
      renewal_notice_days: 60,
      lease_notes: '',
    },
    today,
    new Date(),
    makeId,
  );
  await saveTenantDataChanges(data, set.data || set, owner_id);
  expect(firebase.database.dump().leases['tenancy-alex'].leaseTerm).toBe('fixed');
  data = await getTenantData(owner_id);
  const sam_end = data.tenancies.find((item) => item.id === 'tenancy-sam').lease.lease_end_on;
  const renewed = demoRenewLease(
    data,
    'tenancy-sam',
    { new_end_on: sam_end.slice(0, 4) * 1 + 1 + sam_end.slice(4), new_rent_cents: null },
    today,
    new Date(),
    makeId,
    true,
  );
  await saveTenantDataChanges(data, renewed.data || renewed, owner_id);
  const tree = firebase.database.dump();
  expect(tree.leases['tenancy-sam'].leaseEndOn > sam_end).toBe(true);
  expect(Object.keys(tree.leaseEvents['tenancy-sam']).length).toBe(2);
});

test('payment instructions save on the property', async () => {
  const firebase = seededFirebase();
  await savePaymentInstructions('prop-maple', 'Zelle only');
  expect(firebase.database.dump().properties['prop-maple'].paymentInstructions).toBe('Zelle only');
});

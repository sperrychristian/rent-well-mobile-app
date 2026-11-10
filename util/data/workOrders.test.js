import {
  getAllWorkOrders,
  getWorkOrder,
  createOwnerWorkOrder,
  createTenantWorkOrder,
  updateWorkOrderStatus,
  updateWorkOrderFields,
  updateWorkOrderNotes,
  deleteWorkOrder,
} from './workOrders';
import { setSessionUser } from './session';
import { fromApiWorkOrder } from '../../features/workOrders/utils/workOrderHelpers';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

const taylor = { id: 'owner-taylor', role: 'owner', name: 'Taylor Brooks' };
const sam = { id: 'tenant-sam', role: 'tenant', name: 'Sam Rivera', ownerId: 'owner-taylor' };

afterEach(() => {
  uninstallFakeFirebase();
  setSessionUser(null);
});

test('a landlord sees every order on their properties, a tenant only their own', async () => {
  seededFirebase();
  setSessionUser(taylor);
  const all = await getAllWorkOrders();
  expect(all).toHaveLength(5);
  expect(fromApiWorkOrder(all[0]).property).toMatch(/Maple|Cedar/);
  setSessionUser(sam);
  const mine = await getAllWorkOrders();
  expect(mine.map((order) => order.title)).toEqual(['Kitchen faucet leaking']);
  setSessionUser({ id: 'owner-jamie', role: 'owner' });
  expect(await getAllWorkOrders()).toEqual([]);
});

test('a tenant report takes the property, unit, and landlord from the tenancy', async () => {
  const firebase = seededFirebase();
  setSessionUser(sam);
  const order = await createTenantWorkOrder({
    title: 'Bathroom fan rattles',
    description: 'Loud at night',
    priority: 'Low',
    preferred_date: '2026-12-01',
  });
  const saved = firebase.database.dump().workOrders[order.id];
  expect(saved).toMatchObject({
    ownerId: 'owner-taylor',
    propertyId: 'prop-maple',
    unitLabel: 'Unit 2',
    tenancyId: 'tenancy-sam',
    status: 'Open',
    preferredDate: '2026-12-01',
  });
  // and the landlord sees it on their next load
  setSessionUser(taylor);
  expect((await getAllWorkOrders()).some((item) => item.id === order.id)).toBe(true);
});

test('a former tenant can not report an issue', async () => {
  seededFirebase();
  setSessionUser({ id: 'tenant-morgan', role: 'tenant', name: 'Morgan Diaz' });
  await expect(createTenantWorkOrder({ title: 'x', description: 'y' })).rejects.toMatchObject({
    code: 'NO_ACTIVE_TENANCY',
  });
});

test('create, edit every field, move through the statuses, and delete', async () => {
  const firebase = seededFirebase();
  setSessionUser(taylor);
  const created = await createOwnerWorkOrder({
    property_id: 'prop-cedar',
    title: 'Gutter clog',
    description: 'Overflowing',
    priority: 'Normal',
    tenant_user_id: 'tenant-alex',
    estimate: 120,
  });
  expect(created).toMatchObject({ tenantName: 'Alex Chen', estimate: 120 });
  const edited = await updateWorkOrderFields(created.id, {
    title: 'Gutter clog, back side',
    description: 'Overflowing onto the porch',
    priority: 'Emergency',
    contractor: 'Ace Gutters',
    estimate: null,
  });
  expect(edited).toMatchObject({
    title: 'Gutter clog, back side',
    priority: 'Emergency',
    estimate: null,
  });
  const started = await updateWorkOrderStatus(created.id, 'In Progress');
  expect(started.startedAt).toBeTruthy();
  const resolved = await updateWorkOrderStatus(created.id, 'Resolved');
  expect(resolved.resolvedAt).toBeTruthy();
  expect(resolved.startedAt).toBe(started.startedAt);
  const reopened = await updateWorkOrderStatus(created.id, 'Open');
  expect(reopened).toMatchObject({ startedAt: null, resolvedAt: null });
  await updateWorkOrderNotes(created.id, 'Call first');
  expect((await getWorkOrder(created.id)).ownerNotes).toBe('Call first');
  await deleteWorkOrder(created.id);
  expect(firebase.database.dump().workOrders[created.id]).toBeUndefined();
  await expect(getWorkOrder(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('deleting an order unlinks its expenses in the same write and keeps the expense', async () => {
  const firebase = seededFirebase();
  setSessionUser(taylor);
  const linked = Object.values(firebase.database.dump().expenses).find(
    (expense) => expense.workOrderId === 'wo-2',
  );
  await deleteWorkOrder('wo-2');
  const after = firebase.database.dump().expenses[linked.id];
  expect(after).toBeDefined();
  expect(after.workOrderId).toBeUndefined();
});

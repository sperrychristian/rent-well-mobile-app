import {
  localDateString,
  propertyLabel,
  fromApiWorkOrder,
  mergeWorkOrders,
  replaceWorkOrder,
  applyStatus,
  canTenantAddPhotos,
  photosLeft,
  openCount,
  activeCount,
  ordersForTenant,
  legacyExpensesFor,
} from './workOrderHelpers';

// built from local times so the test passes in any time zone
const created = new Date(2026, 9, 8, 14, 30).toISOString();
const started = new Date(2026, 9, 9, 9, 0).toISOString();

const owner_copy = {
  id: 'w1',
  title: 'Kitchen faucet leaking',
  description: 'Drips constantly',
  priority: 'Normal',
  status: 'In Progress',
  ownerNotes: 'Plumber Thursday',
  contractor: 'Wasatch Plumbing',
  estimate: 180,
  property: { id: 'p1', name: 'Maple Court', address: '12 Maple St' },
  unitLabel: 'Unit 2B',
  tenantName: 'Tara Tenant',
  tenant: { id: 't1', name: 'Tara Tenant' },
  ownerId: 'o1',
  createdBy: 't1',
  photos: [{ id: 'ph1', key: 'attachments/t1/a.jpg', uploadedBy: 't1', createdAt: created }],
  createdAt: created,
  startedAt: started,
  resolvedAt: null,
};

describe('mapping api work orders to the app shape', () => {
  test('localDateString uses the phone calendar and passes null through', () => {
    expect(localDateString(created)).toBe('2026-10-08');
    expect(localDateString(null)).toBeNull();
  });

  test('propertyLabel adds the unit only when there is one', () => {
    expect(propertyLabel(owner_copy)).toBe('Maple Court, Unit 2B');
    expect(propertyLabel({ ...owner_copy, unitLabel: null })).toBe('Maple Court');
  });

  test('an owner copy maps every field the screens read', () => {
    const order = fromApiWorkOrder(owner_copy);
    expect(order).toMatchObject({
      id: 'w1',
      title: 'Kitchen faucet leaking',
      description: 'Drips constantly',
      property: 'Maple Court, Unit 2B',
      property_id: 'p1',
      unit_label: 'Unit 2B',
      tenant: 'Tara Tenant',
      tenant_id: 't1',
      status: 'In Progress',
      priority: 'Normal',
      created_at: '2026-10-08',
      started_at: '2026-10-09',
      resolved_at: null,
      created_at_iso: created,
      notes: 'Plumber Thursday',
      contractor: 'Wasatch Plumbing',
      estimate: 180,
      photo: null,
      photos: ['attachments/t1/a.jpg'],
      reported_by_tenant: true,
    });
  });

  test('a tenant copy without contractor and estimate keys falls back to empty', () => {
    const { contractor, estimate, ...tenant_copy } = owner_copy;
    const order = fromApiWorkOrder(tenant_copy);
    expect(order.contractor).toBe('');
    expect(order.estimate).toBeNull();
    expect(contractor).toBe('Wasatch Plumbing');
    expect(estimate).toBe(180);
  });

  test('an owner-made order with no tenant has an empty name, never null', () => {
    const order = fromApiWorkOrder({
      ...owner_copy,
      tenantName: '',
      tenant: null,
      createdBy: 'o1',
      unitLabel: null,
      photos: [],
    });
    expect(order.tenant).toBe('');
    expect(order.tenant_id).toBeNull();
    expect(order.unit_label).toBe('');
    expect(order.reported_by_tenant).toBe(false);
    expect(order.photos).toEqual([]);
  });
});

describe('mergeWorkOrders', () => {
  const a = { id: 'a', created_at_iso: '2026-10-08T10:00:00.000Z', title: 'A' };
  const b = { id: 'b', created_at_iso: '2026-10-09T10:00:00.000Z', title: 'B' };
  const c = { id: 'c', created_at_iso: '2026-10-10T10:00:00.000Z', title: 'C' };

  test('newest first with no repeats', () => {
    expect(mergeWorkOrders([a, b], [c, b]).map((order) => order.id)).toEqual(['c', 'b', 'a']);
  });

  test('the incoming copy replaces the old one', () => {
    const merged = mergeWorkOrders([a, b], [{ ...b, title: 'B changed' }]);
    expect(merged.find((order) => order.id === 'b').title).toBe('B changed');
    expect(merged).toHaveLength(2);
  });

  test('replaceWorkOrder swaps only the match and keeps the order', () => {
    const replaced = replaceWorkOrder([c, b, a], { ...a, title: 'A2' });
    expect(replaced.map((order) => order.title)).toEqual(['C', 'B', 'A2']);
  });
});

describe('applyStatus', () => {
  const today = '2026-10-11';
  const open = { status: 'Open', started_at: null, resolved_at: null };
  const in_progress = { status: 'In Progress', started_at: '2026-10-09', resolved_at: null };
  const resolved = { status: 'Resolved', started_at: '2026-10-09', resolved_at: '2026-10-10' };

  test('Open to In Progress sets the start date', () => {
    expect(applyStatus(open, 'In Progress', today)).toMatchObject({
      status: 'In Progress',
      started_at: today,
      resolved_at: null,
    });
  });

  test('Open straight to Resolved fills in both dates', () => {
    expect(applyStatus(open, 'Resolved', today)).toMatchObject({
      status: 'Resolved',
      started_at: today,
      resolved_at: today,
    });
  });

  test('In Progress to Resolved keeps the start date', () => {
    expect(applyStatus(in_progress, 'Resolved', today)).toMatchObject({
      started_at: '2026-10-09',
      resolved_at: today,
    });
  });

  test('going back clears the dates that no longer apply', () => {
    expect(applyStatus(in_progress, 'Open', today)).toMatchObject({
      started_at: null,
      resolved_at: null,
    });
    expect(applyStatus(resolved, 'In Progress', today)).toMatchObject({
      status: 'In Progress',
      started_at: '2026-10-09',
      resolved_at: null,
    });
    expect(applyStatus(resolved, 'Open', today)).toMatchObject({
      started_at: null,
      resolved_at: null,
    });
  });

  test('the same status changes nothing', () => {
    expect(applyStatus(open, 'Open', today)).toBe(open);
  });
});

describe('photo limits and counts', () => {
  test('tenants add photos only while Open and under 10', () => {
    expect(canTenantAddPhotos({ status: 'Open', photos: [] })).toBe(true);
    expect(canTenantAddPhotos({ status: 'In Progress', photos: [] })).toBe(false);
    expect(canTenantAddPhotos({ status: 'Open', photos: new Array(10).fill('k') })).toBe(false);
  });

  test('photosLeft is 5 at a time and 10 in total', () => {
    expect(photosLeft({ photos: [] })).toBe(5);
    expect(photosLeft({ photos: new Array(7).fill('k') })).toBe(3);
    expect(photosLeft({ photos: new Array(10).fill('k') })).toBe(0);
    expect(photosLeft(null)).toBe(5);
  });

  test('openCount counts Open only, activeCount counts everything not resolved', () => {
    const orders = [{ status: 'Open' }, { status: 'In Progress' }, { status: 'Resolved' }];
    expect(openCount(orders)).toBe(1);
    expect(activeCount(orders)).toBe(2);
  });
});

describe('legacyExpensesFor', () => {
  test('builds the small expense list for one order', () => {
    const expenses = [
      {
        id: 'e1',
        amount: 40,
        notes: 'Washer',
        vendor: 'Home Depot',
        receipts: ['r.jpg'],
        work_order_id: 'w1',
      },
      { id: 'e2', amount: 10, notes: '', vendor: 'Ace', receipts: [], work_order_id: 'w1' },
      { id: 'e3', amount: 99, notes: 'Other', receipts: [], work_order_id: 'w2' },
    ];
    expect(legacyExpensesFor(expenses, 'w1')).toEqual([
      { id: 'e1', amount: 40, description: 'Washer', photo_uri: 'r.jpg' },
      { id: 'e2', amount: 10, description: 'Ace', photo_uri: null },
    ]);
  });
});

describe('ordersForTenant', () => {
  test('keeps only the named tenant, ignoring case and extra spaces', () => {
    const orders = [
      { id: '1', tenant: 'Sam Rivera' },
      { id: '2', tenant: 'Jordan Lee' },
      { id: '3', tenant: ' sam rivera ' },
      { id: '4', tenant: '' },
      { id: '5' },
    ];
    expect(ordersForTenant(orders, 'Sam Rivera').map((order) => order.id)).toEqual(['1', '3']);
  });

  test('a blank name matches nothing, so orders with no tenant never show up', () => {
    expect(ordersForTenant([{ id: '4', tenant: '' }], '')).toEqual([]);
    expect(ordersForTenant([{ id: '4', tenant: '' }], null)).toEqual([]);
  });
});

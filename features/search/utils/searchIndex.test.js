import {
  buildSearchItems,
  searchItems,
  matchesQuery,
  highlightParts,
  addRecentSearch,
  resultCount,
  max_recent_searches,
} from './searchIndex';
import { buildSampleLedgers } from '../../payments/data/sampleLedger';
import { fromApiWorkOrder } from '../../workOrders/utils/workOrderHelpers';

const today = '2026-10-28';
const ledgers = buildSampleLedgers(today);

const owner_data = {
  role: 'owner',
  today: today,
  orders: [
    {
      id: '1',
      title: 'Kitchen faucet leaking',
      property: '123 Maple St, Unit 2',
      tenant: 'Sam Rivera',
      status: 'Open',
    },
  ],
  tenants: [
    {
      id: 'demo-tenant-sam',
      name: 'Sam Rivera',
      email: 'sam@example.com',
      active_tenancies: [{ property_name: '123 Maple St', unit_label: 'Unit 2' }],
    },
  ],
  properties: [{ id: 'demo-prop-maple', name: '123 Maple St', address: 'Salt Lake City' }],
  ledgers: ledgers,
  expenses: [
    {
      id: 'e1',
      amount: 84.5,
      vendor: 'Home Depot',
      category: 'Repairs',
      date: '2026-10-02',
      property: '123 Maple St',
    },
  ],
};

describe('buildSearchItems', () => {
  test('a landlord gets every area, each row points at its screen with an id', () => {
    const items = buildSearchItems(owner_data);
    const sections = new Set(items.map((entry) => entry.section));
    expect([...sections].sort()).toEqual(
      ['charges', 'expenses', 'payments', 'properties', 'tenants', 'work_orders'].sort(),
    );
    const tenant = items.find((entry) => entry.section === 'tenants');
    expect(tenant).toMatchObject({ route: 'TenantDetail', target_id: 'demo-tenant-sam' });
    const order = items.find((entry) => entry.section === 'work_orders');
    expect(order).toMatchObject({ route: 'WorkOrderDetail', target_id: '1' });
    const charge = items.find((entry) => entry.section === 'charges');
    expect(charge.route).toBe('TenantLedger');
    expect(charge.target_id).toMatch(/^demo-tenancy-/);
    const expense = items.find((entry) => entry.section === 'expenses');
    expect(expense).toMatchObject({ route: 'Expenses', target_id: 'e1' });
  });

  test("a tenant gets only requests, payments, and charges, and never a landlord's rows", () => {
    const items = buildSearchItems({
      ...owner_data,
      role: 'tenant',
      ledgers: [ledgers[0]],
    });
    const sections = new Set(items.map((entry) => entry.section));
    expect([...sections].sort()).toEqual(['charges', 'payments', 'work_orders']);
    expect(items.find((entry) => entry.section === 'work_orders').route).toBe('RequestDetail');
    expect(items.find((entry) => entry.section === 'charges').route).toBe('Payments');
    expect(items.every((entry) => entry.route !== 'TenantLedger')).toBe(true);
  });

  test('real mode rows from the api shapes search the same way', () => {
    const api_order = fromApiWorkOrder({
      id: 'wo-9',
      title: 'Garage door stuck',
      property: { id: 'p1', name: 'Maple Court' },
      unitLabel: 'Unit 2B',
      tenantName: 'Tara Tenant',
      status: 'In Progress',
      createdAt: '2026-10-20T15:00:00.000Z',
    });
    const items = buildSearchItems({ role: 'owner', today: today, orders: [api_order] });
    const found = searchItems(items, 'garage tara');
    expect(found[0].data[0]).toMatchObject({ route: 'WorkOrderDetail', target_id: 'wo-9' });
  });

  test('overdue charges carry the danger tone so the row reads terracotta', () => {
    const items = buildSearchItems(owner_data);
    const overdue = items.filter((entry) => entry.section === 'charges' && entry.tone === 'danger');
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue[0].subtitle).toMatch(/Overdue/);
  });
});

describe('searching', () => {
  const items = buildSearchItems(owner_data);

  test('finds things across areas, grouped in section order', () => {
    const sections = searchItems(items, 'maple');
    expect(sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(['tenants', 'properties', 'work_orders', 'expenses']),
    );
    const order = sections.map((section) => section.key);
    expect(order.indexOf('tenants')).toBeLessThan(order.indexOf('expenses'));
    expect(resultCount(sections)).toBeGreaterThan(3);
  });

  test('every word has to match, in any order and any case', () => {
    expect(
      matchesQuery(
        items.find((entry) => entry.target_id === '1'),
        'FAUCET maple',
      ),
    ).toBe(true);
    expect(
      matchesQuery(
        items.find((entry) => entry.target_id === '1'),
        'faucet cedar',
      ),
    ).toBe(false);
  });

  test('one letter is too short, and nothing matching gives an empty list', () => {
    expect(searchItems(items, 'm')).toEqual([]);
    expect(searchItems(items, 'zzzz')).toEqual([]);
  });

  test('keywords match even when they are not on screen', () => {
    const sections = searchItems(items, 'sam@example');
    expect(sections[0].data[0].route).toBe('TenantDetail');
  });
});

describe('highlightParts', () => {
  test('splits out each matching word and joins back to the same line', () => {
    const parts = highlightParts('Kitchen faucet leaking', 'faucet kit');
    expect(parts.map((part) => part.text).join('')).toBe('Kitchen faucet leaking');
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['Kit', 'faucet']);
  });

  test('special characters are safe', () => {
    expect(highlightParts('$1,450.00 (rent)', '(rent')[1]).toEqual({ text: '(rent', match: true });
    expect(highlightParts('', 'x')).toEqual([{ text: '', match: false }]);
  });
});

describe('recent searches', () => {
  test('newest first, no repeats, short ones skipped, and capped', () => {
    let list = addRecentSearch([], 'faucet');
    list = addRecentSearch(list, 'sam');
    list = addRecentSearch(list, 'FAUCET');
    expect(list).toEqual(['FAUCET', 'sam']);
    expect(addRecentSearch(list, 'a')).toBe(list);
    for (let index = 0; index < 20; index++) {
      list = addRecentSearch(list, 'search ' + index);
    }
    expect(list).toHaveLength(max_recent_searches);
  });
});

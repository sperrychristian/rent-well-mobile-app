import fs from 'fs';
import path from 'path';
import {
  navigation_map,
  initial_routes,
  reachableFrom,
  headerTitle,
  shortId,
} from './navigationMap';

const root = path.join(__dirname, '..');
const app_source = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
// every <Stack.Screen name="..."> in App.js
const registered = [...app_source.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)].map(
  (match) => match[1],
);
const mapped = Object.keys(navigation_map);

describe('the map matches App.js', () => {
  test('every registered screen is in the map and every mapped screen is registered', () => {
    expect(registered.length).toBeGreaterThan(20);
    expect([...registered].sort()).toEqual([...mapped].sort());
  });

  test('no screen is registered twice', () => {
    expect(new Set(registered).size).toBe(registered.length);
  });

  test('the initial routes are real screens and App.js sets initialRouteName', () => {
    Object.values(initial_routes).forEach((route_name) => {
      expect(navigation_map[route_name]).toBeDefined();
    });
    expect(app_source).toMatch(/<Stack\.Navigator[^>]*initialRouteName=/);
  });

  test('every screen file exists', () => {
    mapped.forEach((route_name) => {
      expect(fs.existsSync(path.join(root, navigation_map[route_name].file))).toBe(true);
    });
  });
});

describe('every screen is reachable', () => {
  function screensFor(role) {
    return mapped.filter((route_name) => {
      const screen_role = navigation_map[route_name].role;
      return screen_role === role || screen_role === 'shared';
    });
  }

  test('signed out, from Welcome every screen can be reached (through log in or the demo)', () => {
    const reached = reachableFrom(initial_routes.signed_out);
    expect(mapped.filter((route_name) => !reached.has(route_name))).toEqual([]);
  });

  test('an owner reaches every owner and shared screen without logging out', () => {
    const reached = reachableFrom(initial_routes.owner, { skip_resets: true, role: 'owner' });
    expect(screensFor('owner').filter((route_name) => !reached.has(route_name))).toEqual([]);
    // and never lands on a tenant-only screen
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'tenant'),
    ).toEqual([]);
  });

  test('a tenant reaches every tenant and shared screen without logging out', () => {
    const reached = reachableFrom(initial_routes.tenant, { skip_resets: true, role: 'tenant' });
    expect(screensFor('tenant').filter((route_name) => !reached.has(route_name))).toEqual([]);
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'owner'),
    ).toEqual([]);
  });

  test('the auth screens are reachable from Welcome without signing in', () => {
    const reached = reachableFrom(initial_routes.signed_out, { skip_resets: true });
    mapped
      .filter((route_name) => navigation_map[route_name].role === 'auth')
      .forEach((route_name) => expect(reached.has(route_name)).toBe(true));
  });
});

describe('edges and params', () => {
  const edges = mapped.flatMap((route_name) =>
    navigation_map[route_name].edges.map((edge) => ({ from: route_name, ...edge })),
  );

  test('every edge points at a real screen', () => {
    edges.forEach((edge) => expect(navigation_map[edge.to]).toBeDefined());
  });

  test('every param passed is an id and the screen it goes to reads it', () => {
    edges
      .filter((edge) => edge.param)
      .forEach((edge) => {
        expect(edge.param).toMatch(/Id$/);
        expect(navigation_map[edge.to].params).toContain(edge.param);
      });
  });

  test('every param a screen reads is an id', () => {
    mapped.forEach((route_name) => {
      navigation_map[route_name].params.forEach((param) => expect(param).toMatch(/Id$/));
    });
  });

  test('at least one id param is passed and there are at least three header buttons', () => {
    expect(edges.filter((edge) => edge.param).length).toBeGreaterThan(0);
    expect(edges.filter((edge) => edge.via === 'header').length).toBeGreaterThanOrEqual(3);
  });

  test('every screen has a title that is more than its route name', () => {
    mapped.forEach((route_name) => {
      const title = navigation_map[route_name].title;
      // "Work Orders" for WorkOrders counts as just the route name too, so I compare letters only
      const letters = (text) => text.toLowerCase().replace(/[^a-z]/g, '');
      expect(title.length).toBeGreaterThan(2);
      expect(letters(title)).not.toBe(letters(route_name));
    });
  });

  test('future tabs and drawer items match the plan', () => {
    const marked = (role, kind) =>
      mapped
        .filter((route_name) =>
          navigation_map[route_name].future.some(
            (item) => item.role === role && item.kind === kind,
          ),
        )
        .sort();
    expect(marked('owner', 'tab')).toEqual(['Dashboard', 'Messages', 'Tenants', 'WorkOrders']);
    expect(marked('owner', 'drawer')).toEqual([
      'Checklist',
      'Documents',
      'Expenses',
      'Properties',
      'Settings',
    ]);
    expect(marked('tenant', 'tab')).toEqual(['Messages', 'MyRequests', 'TenantHome']);
  });
});

describe('headerTitle', () => {
  test('adds a short id when the title depends on a param', () => {
    expect(headerTitle('WorkOrderDetail', { workOrderId: '1' })).toBe('Work Order #1');
    expect(
      headerTitle('WorkOrderDetail', { workOrderId: '1a2b3c4d-9999-4000-8000-000000000000' }),
    ).toBe('Work Order #1a2b3c4d');
    expect(headerTitle('YearEndReport', { yearId: '2026' })).toBe('Year-End Tax Report #2026');
    expect(headerTitle('Dashboard', undefined)).toBe('Landlord Dashboard');
    expect(headerTitle('Unknown', undefined)).toBe('Unknown');
    expect(shortId('abc')).toBe('abc');
  });
});

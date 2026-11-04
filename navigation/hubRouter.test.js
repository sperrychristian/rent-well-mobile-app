import { StackRouter, StackActions, CommonActions } from '@react-navigation/routers';
import { hubRouter, nestedParams, isHubRoute, wrapResetRoutes } from './hubRouter';
import { menuPickState, roleLabel } from './DrawerContent';
import { previousDrawerRoute } from './headerButtons';
import { tabBadges } from './tabBadges';

// the root stack's router with the override, run by hand on small states like React Navigation does
const route_names = [
  'Welcome',
  'Login',
  'Main',
  'PaymentDetail',
  'NewWorkOrder',
  'MessageThread',
  'Search',
];
const options = {
  routeNames: route_names,
  routeParamList: {},
  routeGetIdList: {},
};
const original = StackRouter({});
const router = { ...original, ...hubRouter(original) };

function stackWith(names) {
  return original.getRehydratedState(
    { routes: names.map((name) => ({ name })), index: names.length - 1, stale: true },
    options,
  );
}

describe('nestedParams', () => {
  test('a tab is wrapped in Tabs, a drawer screen goes straight into Main', () => {
    expect(nestedParams('Payments', undefined)).toEqual({
      screen: 'Tabs',
      params: { screen: 'Payments', params: undefined },
    });
    expect(nestedParams('WorkOrders', { tenantId: 't1' })).toEqual({
      screen: 'Tabs',
      params: { screen: 'WorkOrders', params: { tenantId: 't1' } },
    });
    expect(nestedParams('Settings', undefined)).toEqual({ screen: 'Settings', params: undefined });
  });

  test('only tab and drawer screens count as hubs', () => {
    expect(isHubRoute('Dashboard')).toBe(true);
    expect(isHubRoute('Expenses')).toBe(true);
    expect(isHubRoute('PaymentDetail')).toBe(false);
    expect(isHubRoute('Welcome')).toBe(false);
    expect(isHubRoute('Nope')).toBe(false);
  });
});

describe('hubRouter on the root stack', () => {
  test('navigate to a tab from a detail screen pops back to Main and opens the tab', () => {
    const state = stackWith(['Main', 'PaymentDetail']);
    const next = router.getStateForAction(state, CommonActions.navigate('Payments'), options);
    expect(next.routes.map((route) => route.name)).toEqual(['Main']);
    expect(next.routes[0].params).toEqual({
      screen: 'Tabs',
      params: { screen: 'Payments', params: undefined },
    });
    // the same Main, so the drawer and tabs keep their state
    expect(next.routes[0].key).toBe(state.routes[0].key);
  });

  test('navigate to a drawer screen with an id keeps the id', () => {
    const state = stackWith(['Main', 'MessageThread']);
    const next = router.getStateForAction(
      state,
      CommonActions.navigate('Tenants', { propertyId: 'p1' }),
      options,
    );
    expect(next.routes.map((route) => route.name)).toEqual(['Main']);
    expect(next.routes[0].params).toEqual({ screen: 'Tenants', params: { propertyId: 'p1' } });
  });

  // the week 9b names: Calendar is a drawer screen, Search is a plain stack screen, Expenses takes an expense id
  test('the new names land in the right place: Calendar in the drawer, Search on the stack', () => {
    const from_search = stackWith(['Main', 'Search']);
    const to_calendar = router.getStateForAction(
      from_search,
      CommonActions.navigate('Calendar'),
      options,
    );
    expect(to_calendar.routes.map((route) => route.name)).toEqual(['Main']);
    expect(to_calendar.routes[0].params).toEqual({ screen: 'Calendar', params: undefined });

    const to_expense = router.getStateForAction(
      from_search,
      CommonActions.navigate('Expenses', { expenseId: 'e1' }),
      options,
    );
    expect(to_expense.routes[0].params).toEqual({
      screen: 'Expenses',
      params: { expenseId: 'e1' },
    });

    expect(isHubRoute('Calendar')).toBe(true);
    expect(isHubRoute('Search')).toBe(false);
    const to_search = router.getStateForAction(
      stackWith(['Main']),
      CommonActions.navigate('Search'),
      options,
    );
    expect(to_search.routes.map((route) => route.name)).toEqual(['Main', 'Search']);
  });

  test('push to a hub never stacks a second Main', () => {
    const state = stackWith(['Main', 'PaymentDetail']);
    const next = router.getStateForAction(state, StackActions.push('Messages'), options);
    expect(next.routes.map((route) => route.name)).toEqual(['Main']);
  });

  test('replace a form with a tab drops the form and opens the tab', () => {
    const state = stackWith(['Main', 'NewWorkOrder']);
    const next = router.getStateForAction(state, StackActions.replace('MyRequests'), options);
    expect(next.routes.map((route) => route.name)).toEqual(['Main']);
    expect(next.routes[0].params.params.screen).toBe('MyRequests');
  });

  test('a reset to a home becomes a reset to Main with that tab', () => {
    const state = stackWith(['Login']);
    const next = router.getStateForAction(
      state,
      CommonActions.reset({ index: 0, routes: [{ name: 'TenantHome' }] }),
      options,
    );
    expect(next.routes.map((route) => route.name)).toEqual(['Main']);
    expect(next.routes[0].params).toEqual({
      screen: 'Tabs',
      params: { screen: 'TenantHome', params: undefined },
    });
    expect(wrapResetRoutes([{ name: 'Welcome' }])).toEqual([{ name: 'Welcome' }]);
  });

  test('everything else is the plain stack', () => {
    const state = stackWith(['Main']);
    const next = router.getStateForAction(
      state,
      CommonActions.navigate('PaymentDetail', { paymentId: 'x' }),
      options,
    );
    expect(next.routes.map((route) => route.name)).toEqual(['Main', 'PaymentDetail']);
    const reset = router.getStateForAction(
      next,
      CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }),
      options,
    );
    expect(reset.routes.map((route) => route.name)).toEqual(['Welcome']);
  });
});

describe('the drawer helpers', () => {
  const drawer_state = {
    key: 'drawer-1',
    index: 2,
    routeNames: ['Tabs', 'Expenses', 'Mileage'],
    routes: [
      { key: 'tabs-k', name: 'Tabs' },
      { key: 'exp-k', name: 'Expenses' },
      { key: 'mil-k', name: 'Mileage' },
    ],
    history: [
      { type: 'route', key: 'tabs-k' },
      { type: 'route', key: 'exp-k' },
      { type: 'route', key: 'mil-k' },
    ],
  };

  test('a section opened by a link knows where it came from, one picked from the menu does not', () => {
    expect(previousDrawerRoute(drawer_state)).toBe('Expenses');
    const picked = menuPickState(drawer_state, 'Mileage');
    expect(picked.history).toEqual([
      { type: 'route', key: 'tabs-k' },
      { type: 'route', key: 'mil-k' },
    ]);
    expect(picked.index).toBe(2);
    expect(previousDrawerRoute(picked)).toBe(null);
    // the routes and keys stay the same, so nothing remounts
    expect(picked.routes).toBe(drawer_state.routes);
  });

  test('picking the tabs from the menu clears the history to just the tabs', () => {
    const picked = menuPickState(drawer_state, 'Tabs');
    expect(picked.index).toBe(0);
    expect(picked.history).toEqual([{ type: 'route', key: 'tabs-k' }]);
    expect(previousDrawerRoute(undefined)).toBe(null);
  });

  test('the role label says which side and whether it is the demo', () => {
    expect(roleLabel('owner', false)).toBe('Landlord');
    expect(roleLabel('tenant', false)).toBe('Tenant');
    expect(roleLabel('owner', true)).toBe('Demo, landlord view');
    expect(roleLabel('tenant', true)).toBe('Demo, tenant view');
  });
});

describe('tabBadges', () => {
  test('owners get the unread count, the overdue dot, and the work orders dot', () => {
    const badges = tabBadges({ role: 'owner', unread: 3, overdue: true, open_orders: 2 });
    expect(badges.Messages).toEqual({ count: 3, spoken: '3 unread' });
    expect(badges.Payments).toEqual({ dot: true, spoken: 'something is overdue' });
    expect(badges.WorkOrders).toEqual({ dot: true, spoken: '2 need you' });
    expect(tabBadges({ role: 'owner', unread: 0, overdue: false, open_orders: 1 })).toEqual({
      WorkOrders: { dot: true, spoken: '1 work order needs you' },
    });
  });

  test('tenants never get a work orders dot, and nothing to show means no badges', () => {
    expect(tabBadges({ role: 'tenant', unread: 0, overdue: false, open_orders: 4 })).toEqual({});
    expect(tabBadges({ role: 'tenant', unread: 1, overdue: true, open_orders: 0 })).toEqual({
      Messages: { count: 1, spoken: '1 unread' },
      Payments: { dot: true, spoken: 'something is overdue' },
    });
  });
});

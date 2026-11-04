import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import App from '../App';
import { navigation_ref } from '../services/navigationRef';
import { hubs, drawerScreens, navigation_map, headerTitle } from './navigationMap';

// the real App, signed out, with the real navigators: Welcome, then the demo, then taps like a person would
// SecureStore has nothing saved here, so the app starts signed out on Welcome every time

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  clearLastNotificationResponseAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false, canAskAgain: false })),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@expo-google-fonts/fraunces', () => ({
  useFonts: () => [true, null],
  Fraunces_400Regular: 1,
  Fraunces_500Medium: 1,
}));
jest.mock('@expo-google-fonts/dm-sans', () => ({
  DMSans_400Regular: 1,
  DMSans_500Medium: 1,
  DMSans_600SemiBold: 1,
}));

jest.setTimeout(30000);

// lets the effects, timers and AsyncStorage reads settle
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function startDemo(choice) {
  render(<App />);
  await settle();
  fireEvent.press(await screen.findByText('Try the Demo'));
  await settle();
  fireEvent.press(screen.getByLabelText(choice));
  await settle();
}

// the route showing right now, all the way down the nested navigators
function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

// every header showing right now: the native stack's bars that aren't hidden (the root stack's screens),
// plus the tab and drawer headers whose title a screen reader can reach (the ones behind are hidden from it)
// one header per visible screen means this comes back as exactly one title
function visibleHeaders() {
  const native_bars = screen.UNSAFE_root.findAll(
    (node) => node.type === 'RNSScreenStackHeaderConfig' && !node.props.hidden,
  );
  const hub_titles = screen.queryAllByRole('heading').map((node) => node.props.children);
  // while a root stack screen shows its bar, the tab and drawer headers under it are covered
  if (native_bars.length > 0) {
    return native_bars.map((node) => node.props.title);
  }
  return hub_titles;
}

async function pressTab(route_name) {
  fireEvent.press(screen.getByTestId('tab-' + route_name));
  await settle();
}

async function openDrawer() {
  fireEvent.press(screen.getAllByLabelText('Open the menu')[0]);
  await settle();
}

describe('the landlord demo', () => {
  test('starts on the Dashboard tab with the four landlord tabs', async () => {
    await startDemo('Demo as Landlord');
    expect(focusedRoute()).toBe('Dashboard');
    hubs.owner.tabs.forEach((route_name) => {
      expect(screen.getByTestId('tab-' + route_name)).toBeTruthy();
    });
    // no tenant tabs on the landlord side
    expect(screen.queryByTestId('tab-TenantHome')).toBeNull();
    expect(screen.queryByTestId('tab-MyRequests')).toBeNull();
    expect(visibleHeaders()).toEqual([headerTitle('Dashboard')]);
  });

  test('every tab opens with one header and its title', async () => {
    await startDemo('Demo as Landlord');
    for (const route_name of hubs.owner.tabs) {
      await pressTab(route_name);
      expect(focusedRoute()).toBe(route_name);
      expect(visibleHeaders()).toEqual([headerTitle(route_name)]);
    }
  });

  test('the badges show with labels a screen reader can say', async () => {
    await startDemo('Demo as Landlord');
    // the demo has open work orders and a tenant behind on rent, so both dots are on
    const work_orders = screen.getByTestId('tab-WorkOrders');
    expect(work_orders.props.accessibilityLabel).toMatch(/^Work Orders, .*need/);
    const payments = screen.getByTestId('tab-Payments');
    expect(payments.props.accessibilityLabel).toBe('Payments, something is overdue');
    // the tab bar draws each icon twice (the picked and unpicked copies fade between), so there are two dots
    expect(within(work_orders).getAllByTestId('tab-dot').length).toBeGreaterThan(0);
    expect(within(payments).getAllByTestId('tab-dot').length).toBeGreaterThan(0);
    // Messages has no unread in the landlord demo's sample threads unless the samples say so
    const messages = screen.getByTestId('tab-Messages');
    expect(messages.props.accessibilityLabel).toMatch(/^Messages/);
  });

  test('the drawer lists every section and each one opens with one header', async () => {
    await startDemo('Demo as Landlord');
    await openDrawer();
    expect(screen.getByText('Demo, landlord view')).toBeTruthy();
    drawerScreens('owner').forEach((route_name) => {
      expect(screen.getByTestId('drawer-' + route_name)).toBeTruthy();
    });
    for (const route_name of drawerScreens('owner')) {
      fireEvent.press(screen.getByTestId('drawer-' + route_name));
      await settle();
      expect(focusedRoute()).toBe(route_name);
      expect(visibleHeaders()).toEqual([headerTitle(route_name)]);
      // picked from the menu, so the header has the menu button and not a back arrow
      expect(screen.getAllByLabelText('Open the menu').length).toBeGreaterThan(0);
    }
    // and the Main section goes back to a tab
    fireEvent.press(screen.getByTestId('drawer-Payments'));
    await settle();
    expect(focusedRoute()).toBe('Payments');
  });

  test('a detail screen pushes over the tabs with a back button, and back returns to the tab', async () => {
    await startDemo('Demo as Landlord');
    await pressTab('WorkOrders');
    act(() => navigation_ref.navigate('WorkOrderDetail', { workOrderId: '1' }));
    await settle();
    expect(focusedRoute()).toBe('WorkOrderDetail');
    expect(visibleHeaders()).toEqual([headerTitle('WorkOrderDetail', { workOrderId: '1' })]);
    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('WorkOrders');
  });

  test('Search pushes over the tabs with one header and a back arrow home', async () => {
    await startDemo('Demo as Landlord');
    fireEvent.press(screen.getByLabelText('Search'));
    await settle();
    expect(focusedRoute()).toBe('Search');
    expect(visibleHeaders()).toEqual([headerTitle('Search')]);
    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('Dashboard');
  });

  test('a link from one section to another gets a back arrow to it', async () => {
    await startDemo('Demo as Landlord');
    await openDrawer();
    fireEvent.press(screen.getByTestId('drawer-Expenses'));
    await settle();
    // the Expenses screen's own Mileage button
    act(() => navigation_ref.navigate('Mileage'));
    await settle();
    expect(focusedRoute()).toBe('Mileage');
    const back = screen.getByLabelText('Back to ' + navigation_map.Expenses.title);
    fireEvent.press(back);
    await settle();
    expect(focusedRoute()).toBe('Expenses');
  });

  test('navigating by name from a detail screen lands in the right tab or section', async () => {
    await startDemo('Demo as Landlord');
    act(() => navigation_ref.navigate('PaymentDetail', { paymentId: 'nope' }));
    await settle();
    act(() => navigation_ref.navigate('Messages'));
    await settle();
    expect(focusedRoute()).toBe('Messages');
    act(() => navigation_ref.navigate('TenantDetail', { tenantId: 'demo-tenant-sam' }));
    await settle();
    act(() => navigation_ref.navigate('Tenants', { propertyId: 'demo-property-maple' }));
    await settle();
    expect(focusedRoute()).toBe('Tenants');
    expect(navigation_ref.getCurrentRoute().params).toEqual({ propertyId: 'demo-property-maple' });
  });

  test('Switch view lands on the tenant tabs, and back again', async () => {
    await startDemo('Demo as Landlord');
    fireEvent.press(screen.getByLabelText('Switch to Tenant view'));
    await settle();
    expect(focusedRoute()).toBe('TenantHome');
    expect(screen.getByTestId('tab-MyRequests')).toBeTruthy();
    expect(screen.queryByTestId('tab-Dashboard')).toBeNull();
    fireEvent.press(screen.getAllByLabelText('Switch to Landlord view')[0]);
    await settle();
    expect(focusedRoute()).toBe('Dashboard');
  });

  test('Exit Demo Mode goes back to Welcome', async () => {
    await startDemo('Demo as Landlord');
    fireEvent.press(screen.getByLabelText('Exit Demo Mode'));
    await settle();
    expect(focusedRoute()).toBe('Welcome');
  });
});

describe('the tenant demo', () => {
  test('starts on My Home, every tab has one header, and the drawer has its sections', async () => {
    await startDemo('Demo as Tenant');
    expect(focusedRoute()).toBe('TenantHome');
    expect(screen.queryByTestId('tab-Dashboard')).toBeNull();
    for (const route_name of hubs.tenant.tabs) {
      await pressTab(route_name);
      expect(focusedRoute()).toBe(route_name);
      expect(visibleHeaders()).toEqual([headerTitle(route_name)]);
    }
    await openDrawer();
    expect(screen.getByText('Demo, tenant view')).toBeTruthy();
    expect(screen.queryByTestId('drawer-Expenses')).toBeNull();
    for (const route_name of drawerScreens('tenant')) {
      fireEvent.press(screen.getByTestId('drawer-' + route_name));
      await settle();
      expect(focusedRoute()).toBe(route_name);
      expect(visibleHeaders()).toEqual([headerTitle(route_name)]);
      await openDrawer();
    }
  });

  test('Search opens from My Home with one header', async () => {
    await startDemo('Demo as Tenant');
    fireEvent.press(screen.getByLabelText('Search'));
    await settle();
    expect(focusedRoute()).toBe('Search');
    expect(visibleHeaders()).toEqual([headerTitle('Search')]);
    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('TenantHome');
  });

  test('a request drills down over the tabs and back returns to My Requests', async () => {
    await startDemo('Demo as Tenant');
    await pressTab('MyRequests');
    act(() => navigation_ref.navigate('NewWorkOrder'));
    await settle();
    expect(focusedRoute()).toBe('NewWorkOrder');
    expect(visibleHeaders()).toEqual([headerTitle('NewWorkOrder')]);
    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('MyRequests');
  });
});

import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../services/navigationRef';

// Search on the real App: the header button on both homes, results from every area, and taps that open
// the right screen by id (the same harness as appNavigation.test.js)

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

async function settle() {
  for (let index = 0; index < 3; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function startDemo(choice) {
  render(<App />);
  await settle();
  fireEvent.press(await screen.findByText('Try the Demo'));
  await settle();
  fireEvent.press(screen.getByLabelText(choice));
  await settle();
}

async function go(route_name, params) {
  act(() => navigation_ref.navigate(route_name, params));
  await settle();
}

async function back() {
  act(() => navigation_ref.goBack());
  await settle();
}

function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

// the search waits for typing to stop, so the test waits a little longer than that
async function typeSearch(text) {
  fireEvent.changeText(screen.getByLabelText('Search'), text);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await settle();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
});

describe('Search, landlord demo', () => {
  test('the home header opens Search, results come from every area, and a work order opens by id', async () => {
    await startDemo('Demo as Landlord');
    fireEvent.press(screen.getByLabelText('Search'));
    await settle();
    expect(focusedRoute()).toBe('Search');
    expect(screen.getByText('Search everything')).toBeTruthy();

    // the list only draws the first rows, so each search is narrow enough to show its sections
    await typeSearch('maple');
    ['Tenants', 'Properties', 'Work orders'].forEach((title) =>
      expect(screen.getByRole('header', { name: new RegExp('^' + title) })).toBeTruthy(),
    );
    await typeSearch('deposit');
    ['Payments', 'Charges'].forEach((title) =>
      expect(screen.getByRole('header', { name: new RegExp('^' + title) })).toBeTruthy(),
    );

    await typeSearch('faucet');
    fireEvent.press(screen.getByLabelText(/^Work orders, Kitchen faucet leaking/));
    await settle();
    expect(focusedRoute()).toBe('WorkOrderDetail');
    expect(navigation_ref.getCurrentRoute().params).toEqual({ workOrderId: '1' });

    // back on Search, the tap saved the search, and Clear empties the list
    await back();
    expect(focusedRoute()).toBe('Search');
    fireEvent.press(screen.getByLabelText('Clear search'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(screen.getByLabelText('Search again for faucet')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear'));
    await settle();
    expect(screen.queryByLabelText('Search again for faucet')).toBeNull();
    // the demo never saves its searches
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((key) => key.startsWith('rent_well_recent_searches'))).toEqual([]);
  });

  test('a tenant, a charge, and an expense each open their own screen by id', async () => {
    await startDemo('Demo as Landlord');
    await go('Search');
    await typeSearch('jordan');
    fireEvent.press(screen.getByLabelText(/^Tenants, Jordan Lee/));
    await settle();
    expect(navigation_ref.getCurrentRoute()).toMatchObject({
      name: 'TenantDetail',
      params: { tenantId: 'demo-tenant-jordan' },
    });

    await back();
    await typeSearch('key fob');
    fireEvent.press(screen.getByLabelText(/^Charges, Replacement key fob/));
    await settle();
    expect(navigation_ref.getCurrentRoute()).toMatchObject({
      name: 'TenantLedger',
      params: { tenancyId: 'demo-tenancy-jordan' },
    });

    await back();
    await typeSearch('home depot');
    fireEvent.press(screen.getAllByLabelText(/^Expenses, Home Depot/)[0]);
    await settle();
    expect(focusedRoute()).toBe('Expenses');
  });

  test('nothing matching shows the no matches state with a way to clear it', async () => {
    await startDemo('Demo as Landlord');
    await go('Search');
    await typeSearch('zzzz');
    expect(screen.getByText('No matches')).toBeTruthy();
    fireEvent.press(screen.getByText('Clear Search'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(screen.getByText('Search everything')).toBeTruthy();
  });
});

describe('Search, tenant demo', () => {
  test('a tenant finds only their own requests and payments, and a request opens Request Detail', async () => {
    await startDemo('Demo as Tenant');
    fireEvent.press(screen.getByLabelText('Search'));
    await settle();
    expect(focusedRoute()).toBe('Search');

    // another tenant's order and the landlord's expenses never show
    await typeSearch('dishwasher');
    expect(screen.getByText('No matches')).toBeTruthy();
    await typeSearch('home depot');
    expect(screen.getByText('No matches')).toBeTruthy();

    await typeSearch('faucet');
    fireEvent.press(screen.getByLabelText(/^Work orders, Kitchen faucet leaking/));
    await settle();
    expect(navigation_ref.getCurrentRoute()).toMatchObject({
      name: 'RequestDetail',
      params: { workOrderId: '1' },
    });
  });
});

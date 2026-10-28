import { Alert, Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../services/navigationRef';
import { useWorkOrders } from '../context/WorkOrdersContext';

// the shared state assignment: one work order store, read and changed from screens in different tabs,
// proven on the real App with the real navigators (the same harness as appNavigation.test.js)

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

function workOrdersBadge() {
  return screen.getByTestId('tab-WorkOrders').props.accessibilityLabel;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  // the alerts answer themselves: the confirm button (the last one) gets pressed like a person would
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const last = buttons && buttons[buttons.length - 1];
    if (last && last.onPress) {
      last.onPress();
    }
  });
});

afterEach(() => {
  Alert.alert.mockRestore();
});

describe('one work order store, many screens', () => {
  test('Start Work on the detail updates the list row, the Dashboard subtitle, and the tab badge', async () => {
    await startDemo('Demo as Landlord');
    // the seed has three Open and one In Progress
    expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
    expect(workOrdersBadge()).toBe('Work Orders, 3 need you');

    await go('WorkOrders');
    expect(screen.getByLabelText('Kitchen faucet leaking, Open, Normal priority')).toBeTruthy();

    // the list row opens the detail, which changes the status
    fireEvent.press(screen.getByLabelText('Kitchen faucet leaking, Open, Normal priority'));
    await settle();
    expect(focusedRoute()).toBe('WorkOrderDetail');
    fireEvent.press(screen.getByText('Start Work'));
    await settle();
    // the detail itself shows the next step right away
    expect(screen.getByText('Mark Resolved')).toBeTruthy();

    // back on the list, the same row reads In Progress with no reload
    await back();
    expect(focusedRoute()).toBe('WorkOrders');
    expect(
      screen.getByLabelText('Kitchen faucet leaking, In Progress, Normal priority'),
    ).toBeTruthy();
    expect(workOrdersBadge()).toBe('Work Orders, 2 need you');

    await go('Dashboard');
    expect(screen.getByText('2 open, 2 in progress')).toBeTruthy();
  });

  test('a tenant request shows up on the landlord side: list, Dashboard, and badge', async () => {
    await startDemo('Demo as Tenant');
    await go('NewWorkOrder');
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Kitchen faucet leaking'),
      'Porch light out',
    );
    fireEvent.press(screen.getByText('Submit Request'));
    await settle();
    // the tenant's own list has it first
    expect(focusedRoute()).toBe('MyRequests');
    expect(screen.getByText('Porch light out')).toBeTruthy();

    // the side switch lives in the demo banner on the home
    await go('TenantHome');
    fireEvent.press(screen.getAllByLabelText('Switch to Landlord view')[0]);
    await settle();
    expect(focusedRoute()).toBe('Dashboard');
    expect(screen.getByText('4 open, 1 in progress')).toBeTruthy();
    expect(workOrdersBadge()).toBe('Work Orders, 4 need you');
    await go('WorkOrders');
    expect(screen.getByLabelText('Porch light out, Open, Normal priority')).toBeTruthy();
  });

  test('switching demo sides keeps one store: the landlord resolves, the tenant sees it', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrderDetail', { workOrderId: '1' });
    fireEvent.press(screen.getByText('Start Work'));
    await settle();
    fireEvent.press(screen.getByText('Mark Resolved'));
    await settle();

    await go('Dashboard');
    fireEvent.press(screen.getAllByLabelText('Switch to Tenant view')[0]);
    await settle();
    expect(focusedRoute()).toBe('TenantHome');
    await go('MyRequests');
    // Sam's faucet request reads Resolved on the tenant side, from the same list
    const row = screen.getByLabelText(/^Kitchen faucet leaking/);
    expect(row.props.accessibilityLabel).toMatch(/Resolved/);

    // and back to the landlord, the change is still there (nothing reset on the switch)
    await go('TenantHome');
    fireEvent.press(screen.getAllByLabelText('Switch to Landlord view')[0]);
    await settle();
    expect(screen.getByText('2 open, 1 in progress')).toBeTruthy();
  });

  test('Tenant Profile reads the same orders, so its count follows a status change', async () => {
    await startDemo('Demo as Landlord');
    await go('TenantDetail', { tenantId: 'demo-tenant-sam' });
    expect(screen.getByText('1 open work order')).toBeTruthy();
    await go('WorkOrderDetail', { workOrderId: '1' });
    fireEvent.press(screen.getByText('Start Work'));
    await settle();
    fireEvent.press(screen.getByText('Mark Resolved'));
    await settle();
    await back();
    expect(focusedRoute()).toBe('TenantDetail');
    expect(screen.getByText('No open work orders.')).toBeTruthy();
  });
});

describe('the provider is required', () => {
  function Reader() {
    const { orders } = useWorkOrders();
    return <Text>{orders.length}</Text>;
  }

  test('a screen outside WorkOrdersProvider fails loudly with a clear message', () => {
    // React logs the thrown error too, so I quiet the console for this one
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Reader />)).toThrow(/inside WorkOrdersProvider/);
    quiet.mockRestore();
  });
});

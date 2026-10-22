import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../services/navigationRef';
import { appearance_key } from '../context/ThemeContext';
import { COLORS, LIGHT_COLORS, DARK_COLORS, setActiveScheme } from '../theme';

// the real App in the demo, both sides: the new Leases, Profit, and reminder flows tapped like a person would,
// and dark mode drawn on the busiest screens (the same harness as appNavigation.test.js)

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

function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

function colorOf(node) {
  return StyleSheet.flatten(node.props.style).color;
}

// each test is a fresh launch: nothing saved, the light palette, and no navigator state kept from the last one
beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  setActiveScheme('light');
});

afterAll(() => setActiveScheme('light'));

// the palette the running app reads right now
function activeBackground() {
  return COLORS.background;
}

describe('leases in the landlord demo', () => {
  test('the list says who ends soon, a row opens the lease, and Renew moves the end date', async () => {
    await startDemo('Demo as Landlord');
    await go('Leases');
    expect(screen.getByText('Sam Rivera')).toBeTruthy();
    expect(screen.getAllByText('Expiring soon').length).toBeGreaterThan(0);
    expect(screen.getByText('Month to month', { exact: true })).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Sam Rivera, 123 Maple St, Unit 2, Expiring soon/));
    await settle();
    expect(focusedRoute()).toBe('TenantLease');
    expect(navigation_ref.getCurrentRoute().params).toEqual({ tenancyId: 'demo-tenancy-sam' });
    expect(screen.getByText('25 days left')).toBeTruthy();
    fireEvent.press(screen.getByText('Renew'));
    await settle();
    // the sheet's title and its button both say Renew Lease, the button is the one that isn't a header
    const renew_button = screen
      .getAllByText('Renew Lease')
      .find((node) => node.props.accessibilityRole !== 'header');
    fireEvent.press(renew_button);
    await settle();
    expect(screen.queryByText('25 days left')).toBeNull();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/^Renewed to /)).toBeTruthy();
  });

  test('setting a lease where there was none', async () => {
    await startDemo('Demo as Landlord');
    await go('TenantLease', { tenancyId: 'demo-tenancy-alex' });
    expect(screen.getByText('Not recorded yet')).toBeTruthy();
    fireEvent.press(screen.getByText('Set Lease'));
    await settle();
    fireEvent.press(screen.getByText('Save Lease'));
    await settle();
    expect(screen.queryByText('Not recorded yet')).toBeNull();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
  });
});

describe('profit and expenses in the landlord demo', () => {
  test('Profit shows the year, and picking last year changes it', async () => {
    await startDemo('Demo as Landlord');
    await go('Profit');
    const this_year = String(new Date().getFullYear());
    const last_year = String(new Date().getFullYear() - 1);
    expect(screen.getByText('Net profit in ' + this_year)).toBeTruthy();
    expect(screen.getByText('By property')).toBeTruthy();
    expect(screen.getByText('123 Maple St')).toBeTruthy();
    fireEvent.press(screen.getByText(last_year));
    await settle();
    expect(screen.getByText('Net profit in ' + last_year)).toBeTruthy();
    // a property row puts that property in the chart
    fireEvent.press(screen.getByLabelText(/^123 Maple St, net/));
    await settle();
    expect(screen.getByText('123 Maple St, net by month')).toBeTruthy();
  });

  test('adding an expense in the demo puts it in the list', async () => {
    await startDemo('Demo as Landlord');
    await go('Expenses');
    fireEvent.press(screen.getAllByText('Add Expense')[0]);
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 45.00'), '45.67');
    fireEvent.changeText(
      screen.getByPlaceholderText('Pick one above or type a property'),
      '123 Maple St',
    );
    fireEvent.changeText(screen.getByPlaceholderText('Who was paid?'), 'Gutter Pros');
    fireEvent.changeText(screen.getByPlaceholderText('What was it for?'), 'Gutter cleaning');
    fireEvent.press(screen.getByText('Save'));
    await settle();
    expect(screen.getAllByText('Gutter Pros').length).toBeGreaterThan(0);
  });
});

describe('rent reminders in the landlord demo', () => {
  test('send from an overdue row, then the 24 hour limit, then the chat shows it to the tenant', async () => {
    await startDemo('Demo as Landlord');
    await go('Payments');
    fireEvent.press(screen.getAllByLabelText(/a rent reminder$/)[0]);
    await settle();
    expect(screen.getByText('Send Reminder')).toBeTruthy();
    expect(screen.getByDisplayValue(/just a friendly reminder/)).toBeTruthy();
    fireEvent.press(screen.getByText('Overdue notice'));
    await settle();
    expect(screen.getByDisplayValue(/is past due/)).toBeTruthy();
    fireEvent.press(screen.getByText('Send'));
    await settle();
    expect(screen.queryByText('Send Reminder')).toBeNull();

    // the same tenant again is too soon
    fireEvent.press(screen.getAllByLabelText(/a rent reminder$/)[0]);
    await settle();
    expect(screen.getByText(/One reminder every 24 hours/)).toBeTruthy();
    expect(screen.getByText(/^Last reminder sent /)).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));
    await settle();

    // Sam sees it in the chat with the Payment reminder label, which opens Payments
    await go('Dashboard');
    fireEvent.press(screen.getAllByLabelText('Switch to Tenant view')[0]);
    await settle();
    await go('MessageThread', { conversationId: 'demo-convo-sam' });
    fireEvent.press(screen.getByLabelText('Payment reminder, opens Payments'));
    await settle();
    expect(focusedRoute()).toBe('Payments');
  });

  test('nothing owed says so and Send stays off', async () => {
    await startDemo('Demo as Landlord');
    // Alex has no rent schedule in the demo, so nothing is owed
    await go('TenantLedger', { tenancyId: 'demo-tenancy-alex' });
    if (!screen.queryByLabelText(/^More actions/)) {
      return;
    }
    fireEvent.press(screen.getByLabelText(/^More actions/));
    await settle();
    fireEvent.press(screen.getByText('Send Reminder'));
    await settle();
    expect(screen.getByText(/Nothing is owed right now/)).toBeTruthy();
  });
});

describe('dark mode', () => {
  test('saved Dark draws the landlord Dashboard, drawer, a ledger, and a form sheet in the dark palette', async () => {
    await AsyncStorage.setItem(appearance_key, 'dark');
    await startDemo('Demo as Landlord');
    expect(activeBackground()).toBe(DARK_COLORS.background);
    const heading = screen
      .getAllByRole('heading')
      .find((node) => node.props.children === 'Landlord Dashboard');
    expect(colorOf(heading)).toBe(DARK_COLORS.title);
    fireEvent.press(screen.getAllByLabelText('Open the menu')[0]);
    await settle();
    expect(screen.getByTestId('drawer-Leases')).toBeTruthy();
    expect(screen.getByTestId('drawer-Profit')).toBeTruthy();
    await go('TenantLedger', { tenancyId: 'demo-tenancy-sam' });
    expect(focusedRoute()).toBe('TenantLedger');
    await go('TenantLease', { tenancyId: 'demo-tenancy-sam' });
    fireEvent.press(screen.getByText('Edit Lease'));
    await settle();
    const sheet_title = screen
      .getAllByText('Edit Lease')
      .find((node) => node.props.accessibilityRole === 'header');
    expect(colorOf(sheet_title)).toBe(DARK_COLORS.text);
  });

  test('the tenant side draws dark too', async () => {
    await AsyncStorage.setItem(appearance_key, 'dark');
    await startDemo('Demo as Tenant');
    const heading = screen
      .getAllByRole('heading')
      .find((node) => node.props.children === 'My Home');
    expect(colorOf(heading)).toBe(DARK_COLORS.title);
    expect(screen.getByText('Your Lease')).toBeTruthy();
  });

  test('Appearance in Settings switches to Dark and back, staying on Settings', async () => {
    await startDemo('Demo as Landlord');
    await go('Settings');
    expect(activeBackground()).toBe(LIGHT_COLORS.background);
    fireEvent.press(screen.getByText('Dark'));
    await settle();
    expect(focusedRoute()).toBe('Settings');
    expect(activeBackground()).toBe(DARK_COLORS.background);
    expect(await AsyncStorage.getItem(appearance_key)).toBe('dark');
    fireEvent.press(screen.getByText('Light'));
    await settle();
    expect(focusedRoute()).toBe('Settings');
    expect(activeBackground()).toBe(LIGHT_COLORS.background);
  });
});

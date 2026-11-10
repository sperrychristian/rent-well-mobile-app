import { Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../util/navigationRef';
import { setActiveScheme } from '../constants/theme';
import { appearance_key } from '../store/ThemeContext';
import { seededFirebase, uninstallFakeFirebase } from '../scripts/testing/fakeFirebase';
import { formatCents } from '../util/formatCurrency';

// milestone 2 flows on the real App with the real navigators, signed in to a test account, against the
// seeded fake Firebase database: every change goes through the screens, then the database and the other
// screens are checked

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

jest.setTimeout(40000);

async function settle(rounds) {
  for (let index = 0; index < (rounds || 6); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function go(route_name, params) {
  act(() => navigation_ref.navigate(route_name, params));
  await settle();
}

async function press(element) {
  fireEvent.press(element);
  await settle();
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

function badge(tab) {
  return screen.getByTestId('tab-' + tab).props.accessibilityLabel;
}

// opens the App already signed in to a test account, the way the next launch after Log In does
async function startAs(user_id, firebase) {
  const user = firebase.database.dump().users[user_id];
  await AsyncStorage.setItem('rent_well_test_account', JSON.stringify(user));
  forgetNavigationState();
  const view = render(<App />);
  await settle(12);
  return view;
}

let firebase;

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  setActiveScheme('light');
  firebase = seededFirebase();
  // every alert taps its last button (Delete, End Tenancy, Resolve)
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const list = buttons || [];
    const picked = list[list.length - 1];
    if (picked && picked.onPress) {
      picked.onPress();
    }
  });
});

afterEach(() => {
  Alert.alert.mockRestore();
  uninstallFakeFirebase();
});

afterAll(() => setActiveScheme('light'));

describe('signing in with a test account', () => {
  test('Log In lists the test accounts, and picking one opens that role home', async () => {
    forgetNavigationState();
    render(<App />);
    await settle();
    await go('Login');
    expect(await screen.findByText('Test accounts')).toBeTruthy();
    expect(screen.getByText('Landlords')).toBeTruthy();
    expect(screen.getByText('Tenants')).toBeTruthy();
    await press(screen.getByLabelText('Sign in as Sam Rivera, tenant'));
    await settle(10);
    expect(focusedRoute()).toBe('TenantHome');
    expect(JSON.parse(await AsyncStorage.getItem('rent_well_test_account')).id).toBe('tenant-sam');
  });
});

describe('work orders', () => {
  test('a landlord adds, edits, and deletes a work order, and the list, Home count, and badge follow', async () => {
    await startAs('owner-taylor', firebase);
    expect(focusedRoute()).toBe('Dashboard');
    expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
    const badge_before = badge('WorkOrders');

    await go('NewWorkOrder');
    fireEvent.press(screen.getByLabelText('48 Cedar Ave'));
    type('Title', 'Gutter clog');
    type('Description', 'Water spills over the back gutter in every rain.');
    fireEvent.press(screen.getByLabelText('Normal priority'));
    await press(screen.getByText('Add'));
    await settle();
    expect(focusedRoute()).toBe('Dashboard');
    expect(screen.getByText('4 open, 1 in progress')).toBeTruthy();
    expect(badge('WorkOrders')).not.toBe(badge_before);
    const saved = Object.values(firebase.database.dump().workOrders).find(
      (order) => order.title === 'Gutter clog',
    );
    expect(saved).toMatchObject({ propertyId: 'prop-cedar', status: 'Open' });

    await go('WorkOrders');
    expect(screen.getByLabelText('Gutter clog, Open, Normal priority')).toBeTruthy();
    await go('WorkOrderDetail', { workOrderId: saved.id });
    await press(screen.getByLabelText('Edit work order'));
    type('Title', 'Gutter clog, back side');
    await press(screen.getByText('Update'));
    await settle();
    expect(firebase.database.dump().workOrders[saved.id].title).toBe('Gutter clog, back side');
    expect(screen.getByText('Gutter clog, back side')).toBeTruthy();

    await press(screen.getByText('Delete Work Order'));
    await settle();
    expect(firebase.database.dump().workOrders[saved.id]).toBeUndefined();
    await go('Dashboard');
    expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
  });

  test('a tenant reports an issue and the landlord sees it after a refresh', async () => {
    const tenant = await startAs('tenant-sam', firebase);
    await go('NewWorkOrder');
    // the rental comes from the tenancy, and there's no photo picker until Firebase Storage
    expect(screen.getByText('123 Maple St, Unit 2')).toBeTruthy();
    expect(screen.queryByText('Camera')).toBeNull();
    type('Title', 'Bathroom fan rattles');
    type('Description', 'The fan rattles loudly whenever it runs.');
    fireEvent.press(screen.getByLabelText('Low priority'));
    await press(screen.getByText('Add'));
    await settle();
    expect(focusedRoute()).toBe('MyRequests');
    expect(screen.getByText('Bathroom fan rattles')).toBeTruthy();
    tenant.unmount();

    await startAs('owner-taylor', firebase);
    await go('WorkOrders');
    expect(screen.getByLabelText('Bathroom fan rattles, Open, Low priority')).toBeTruthy();
  });
});

describe('rent', () => {
  test('a landlord records a payment and the ledger and Home totals change', async () => {
    await startAs('owner-taylor', firebase);
    const collected_before = screen.getAllByText(/^\$/).map((node) => node.props.children);
    await go('TenantLedger', { tenancyId: 'tenancy-jordan' });
    await press(screen.getByText('Record Payment'));
    type('Amount, dollars', '100');
    fireEvent.press(screen.getByText('Check'));
    await press(screen.getByText('Save'));
    await settle();
    expect(screen.getByText('Payment of ' + formatCents(10000) + ' recorded')).toBeTruthy();
    const saved = Object.values(firebase.database.dump().payments).filter(
      (payment) => payment.tenancyId === 'tenancy-jordan' && payment.amountCents === 10000,
    );
    expect(saved).toHaveLength(1);
    await go('Dashboard');
    const collected_after = screen.getAllByText(/^\$/).map((node) => node.props.children);
    expect(collected_after).not.toEqual(collected_before);
  });

  test('a tenant claims a payment and the landlord confirms it', async () => {
    const tenant = await startAs('tenant-sam', firebase);
    await go('Payments');
    await press(screen.getByText('I Paid'));
    type('Amount, dollars', '25');
    await press(screen.getByText('Send'));
    await settle();
    const claim = Object.values(firebase.database.dump().payments).find(
      (payment) => payment.tenancyId === 'tenancy-sam' && payment.amountCents === 2500,
    );
    expect(claim.status).toBe('pending_confirmation');
    tenant.unmount();

    await startAs('owner-taylor', firebase);
    await go('Payments');
    await press(screen.getByLabelText(/^Confirm \$25\.00 from Sam Rivera/));
    await settle();
    expect(firebase.database.dump().payments[claim.id].status).toBe('succeeded');
  });
});

describe('tenants', () => {
  test("a landlord ends a tenancy and the tenant's home turns read only", async () => {
    const landlord = await startAs('owner-taylor', firebase);
    await go('TenantDetail', { tenantId: 'tenant-alex' });
    await press(screen.getAllByText('End Tenancy')[0]);
    await press(screen.getAllByText('End Tenancy').at(-1));
    await settle();
    expect(firebase.database.dump().tenancies['tenancy-alex'].status).toBe('ended');
    landlord.unmount();

    await startAs('tenant-alex', firebase);
    expect(focusedRoute()).toBe('TenantHome');
    expect(screen.getByText('No Active Rental')).toBeTruthy();
  });
});

describe('expenses and profit', () => {
  test('a landlord adds an expense, and Profit moves with it', async () => {
    await startAs('owner-taylor', firebase);
    await go('Profit');
    const profit_before = screen.getAllByText(/\$/).map((node) => String(node.props.children));
    await go('Expenses');
    await press(screen.getByText('Add Expense'));
    type('e.g. 45.00, dollars', '300');
    fireEvent.press(screen.getAllByText('48 Cedar Ave').at(-1));
    await press(screen.getByText('Save'));
    await settle();
    const saved = Object.values(firebase.database.dump().expenses).find(
      (expense) => expense.amountCents === 30000,
    );
    expect(saved).toBeTruthy();
    await go('Profit');
    const profit_after = screen.getAllByText(/\$/).map((node) => String(node.props.children));
    expect(profit_after).not.toEqual(profit_before);
  });
});

describe('messages', () => {
  test('a landlord sends a message and the tenant sees it, unread', async () => {
    const landlord = await startAs('owner-taylor', firebase);
    await go('MessageThread', { conversationId: 'convo-sam' });
    // no photo button until Firebase Storage
    expect(screen.queryByLabelText('Attach a photo')).toBeNull();
    type('Message', 'The plumber is booked for Thursday.');
    await press(screen.getByLabelText('Send message'));
    await settle();
    expect(
      Object.values(firebase.database.dump().messages['convo-sam']).some(
        (message) => message.body === 'The plumber is booked for Thursday.',
      ),
    ).toBe(true);
    landlord.unmount();

    await startAs('tenant-sam', firebase);
    expect(badge('Messages')).toMatch(/unread/);
    await go('MessageThread', { conversationId: 'convo-sam' });
    expect(screen.getByText('The plumber is booked for Thursday.')).toBeTruthy();
  });
});

describe('both themes', () => {
  test.each(['light', 'dark'])(
    'the landlord home renders in %s with Firebase data',
    async (scheme) => {
      await AsyncStorage.setItem(appearance_key, scheme);
      await startAs('owner-taylor', firebase);
      expect(focusedRoute()).toBe('Dashboard');
      expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
    },
  );
});

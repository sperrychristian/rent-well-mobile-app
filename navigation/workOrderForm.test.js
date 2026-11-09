import { Alert, StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../util/navigationRef';
import { appearance_key } from '../store/ThemeContext';
import { LIGHT_COLORS, DARK_COLORS, setActiveScheme } from '../constants/theme';
import { invalid_summary } from '../features/workOrders/components/WorkOrderForm';

// the week 10 work order form on the real App with the real navigators, in both demo sides:
// a tenant's request reaches the landlord's list, Home count, and badge, the landlord's edit reaches the
// detail, the list, and the tenant, bad input never gets saved, and the discard prompt only shows when it should

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

async function press(element) {
  fireEvent.press(element);
  await settle();
}

function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

function headerTitles() {
  return screen.UNSAFE_root.findAll(
    (node) => node.type === 'RNSScreenStackHeaderConfig' && !node.props.hidden,
  ).map((node) => node.props.title);
}

function workOrdersBadge() {
  return screen.getByTestId('tab-WorkOrders').props.accessibilityLabel;
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

function discardPrompts() {
  return Alert.alert.mock.calls.filter((call) => call[0] === 'Discard changes?');
}

// answer is which button the person taps on any alert: 'last' (Discard, Resolve), or 'first' (Keep Editing)
let answer = 'last';

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  setActiveScheme('light');
  answer = 'last';
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const list = buttons || [];
    const picked = answer === 'first' ? list[0] : list[list.length - 1];
    if (picked && picked.onPress) {
      picked.onPress();
    }
  });
});

afterEach(() => {
  Alert.alert.mockRestore();
});

afterAll(() => setActiveScheme('light'));

describe('a tenant reports an issue', () => {
  test('bad input is turned away with messages, then a good one reaches the landlord side', async () => {
    await startDemo('Demo as Tenant');
    await go('NewWorkOrder');
    expect(headerTitles()).toEqual(['Add a Work Order']);

    // empty: every required field says what it needs, and nothing gets saved
    await press(screen.getByText('Add'));
    expect(focusedRoute()).toBe('NewWorkOrder');
    expect(screen.getByText('Add a title, like Kitchen faucet leaking.')).toBeTruthy();
    expect(screen.getByText('Describe the problem so it can get fixed.')).toBeTruthy();
    expect(screen.getByText('Pick how urgent it is.')).toBeTruthy();
    expect(screen.getByText(invalid_summary)).toBeTruthy();

    // the rules past required
    type('Title', 'Porch light out');
    type('Description', 'Dark');
    fireEvent.press(screen.getByLabelText('Normal priority'));
    type('Preferred date (optional)', '2026-02-30');
    await press(screen.getByText('Add'));
    expect(focusedRoute()).toBe('NewWorkOrder');
    expect(
      screen.getByText('Add a bit more detail, at least 10 characters (you have 4).'),
    ).toBeTruthy();
    expect(screen.getByText("That date doesn't exist, check the month and day.")).toBeTruthy();
    // a tenant never sees the landlord's contractor or estimate
    expect(screen.queryByLabelText('Estimated cost (optional)')).toBeNull();

    type('Description', 'The bulb by the front door went out last night.');
    type('Preferred date (optional)', '');
    await press(screen.getByText('Add'));
    // the tenant's own list has it, and leaving after a save never asks to discard
    expect(focusedRoute()).toBe('MyRequests');
    expect(screen.getByText('Porch light out')).toBeTruthy();
    expect(discardPrompts()).toHaveLength(0);

    await go('TenantHome');
    await press(screen.getAllByLabelText('Switch to Landlord view')[0]);
    expect(focusedRoute()).toBe('Dashboard');
    expect(screen.getByText('4 open, 1 in progress')).toBeTruthy();
    expect(workOrdersBadge()).toBe('Work Orders, 4 need you');
    await go('WorkOrders');
    expect(screen.getByLabelText('Porch light out, Open, Normal priority')).toBeTruthy();
  });

  test('a request can be edited while it is Open, and locks with a reason once work starts', async () => {
    await startDemo('Demo as Tenant');
    await go('RequestDetail', { workOrderId: '1' });
    await press(screen.getByLabelText('Edit request'));
    expect(focusedRoute()).toBe('NewWorkOrder');
    // the detail stays mounted under it, so the form's bar is the top one
    expect(headerTitles().at(-1)).toBe('Edit Work Order #1');
    expect(screen.getByLabelText('Title').props.value).toBe('Kitchen faucet leaking');
    expect(screen.getByText('Update')).toBeTruthy();
    // a tenant can't move the request to another rental
    expect(
      screen.getByText("The location can't change after the work order is created."),
    ).toBeTruthy();
    type('Title', 'Kitchen faucet dripping');
    type('Description', 'Drips all night, worse with hot water.');
    await press(screen.getByText('Update'));
    expect(focusedRoute()).toBe('RequestDetail');
    expect(screen.getByText('Kitchen faucet dripping')).toBeTruthy();
    expect(screen.getByText('Drips all night, worse with hot water.')).toBeTruthy();

    // the landlord starts the work, and the tenant's Edit turns into the reason
    await go('TenantHome');
    await press(screen.getAllByLabelText('Switch to Landlord view')[0]);
    await go('WorkOrderDetail', { workOrderId: '1' });
    await press(screen.getByText('Start Work'));
    await go('Dashboard');
    await press(screen.getAllByLabelText('Switch to Tenant view')[0]);
    await go('RequestDetail', { workOrderId: '1' });
    expect(screen.queryByLabelText('Edit request')).toBeNull();
    expect(
      screen.getByText(
        'Work has started, so this request is locked. Message your landlord with changes.',
      ),
    ).toBeTruthy();
  });
});

describe('a landlord edits a work order', () => {
  test('the edit shows on the detail, the list, and the tenant side', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrders');
    await go('WorkOrderDetail', { workOrderId: '1' });
    await press(screen.getByLabelText('Edit work order'));
    expect(focusedRoute()).toBe('NewWorkOrder');
    // the detail stays mounted under it, so the form's bar is the top one
    expect(headerTitles().at(-1)).toBe('Edit Work Order #1');
    // pre-filled from the shared order
    expect(screen.getByLabelText('Title').props.value).toBe('Kitchen faucet leaking');
    expect(screen.getByLabelText('Tenant name').props.value).toBe('Sam Rivera');
    expect(screen.getByLabelText('Normal priority').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Update')).toBeTruthy();

    type('Title', 'Kitchen faucet dripping');
    type('Description', 'Drips all night, worse with hot water.');
    fireEvent.press(screen.getByLabelText('Emergency priority'));
    type('Contractor (optional)', 'Wasatch Plumbing');
    type('Estimated cost (optional)', '180');
    await press(screen.getByText('Update'));

    expect(focusedRoute()).toBe('WorkOrderDetail');
    expect(screen.getByText('Kitchen faucet dripping')).toBeTruthy();
    // the detail's own contractor box follows the saved value
    expect(screen.getByPlaceholderText('Who is doing the work?').props.value).toBe(
      'Wasatch Plumbing',
    );
    expect(screen.getByText('Estimate: $180.00')).toBeTruthy();
    expect(discardPrompts()).toHaveLength(0);

    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('WorkOrders');
    expect(screen.getByLabelText('Kitchen faucet dripping, Open, Emergency priority')).toBeTruthy();

    await go('Dashboard');
    await press(screen.getAllByLabelText('Switch to Tenant view')[0]);
    await go('MyRequests');
    expect(screen.getByLabelText(/^Kitchen faucet dripping/)).toBeTruthy();
  });

  test('invalid input never reaches the shared orders', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrderDetail', { workOrderId: '1' });
    await press(screen.getByLabelText('Edit work order'));
    type('Title', 'ab');
    type('Estimated cost (optional)', '100000.01');
    await press(screen.getByText('Update'));
    expect(focusedRoute()).toBe('NewWorkOrder');
    expect(screen.getByText('The title needs at least 3 characters.')).toBeTruthy();
    expect(screen.getByText('The estimate has to be from $0 to $100,000.')).toBeTruthy();
    // leaving throws the changes away (the prompt answers Discard), and the order is untouched
    await press(screen.getByText('Cancel'));
    expect(discardPrompts()).toHaveLength(1);
    expect(focusedRoute()).toBe('WorkOrderDetail');
    expect(screen.getByText('Kitchen faucet leaking')).toBeTruthy();
    expect(screen.getByText('Estimate: Not set')).toBeTruthy();
  });

  test('a resolved order shows why it cannot be edited instead of the button', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrderDetail', { workOrderId: '4' });
    expect(screen.queryByLabelText('Edit work order')).toBeNull();
    expect(
      screen.getByText('This work order is resolved, so it can no longer be edited.'),
    ).toBeTruthy();
  });
});

describe('the discard prompt', () => {
  test('a clean form leaves without asking', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrders');
    await go('NewWorkOrder');
    await press(screen.getByText('Cancel'));
    expect(focusedRoute()).toBe('WorkOrders');
    act(() => navigation_ref.navigate('NewWorkOrder'));
    await settle();
    act(() => navigation_ref.goBack());
    await settle();
    expect(focusedRoute()).toBe('WorkOrders');
    expect(discardPrompts()).toHaveLength(0);
  });

  test('a changed form asks on Cancel and on the back button, Keep Editing stays, Discard leaves', async () => {
    await startDemo('Demo as Landlord');
    await go('WorkOrders');
    await go('NewWorkOrder');
    type('Title', 'Gutter clog');

    answer = 'first';
    await press(screen.getByText('Cancel'));
    expect(discardPrompts()).toHaveLength(1);
    expect(discardPrompts()[0][2].map((button) => button.text)).toEqual([
      'Keep Editing',
      'Discard',
    ]);
    expect(focusedRoute()).toBe('NewWorkOrder');
    expect(screen.getByLabelText('Title').props.value).toBe('Gutter clog');

    // the header back (and the iOS swipe and Android's back) all go through the same check
    act(() => navigation_ref.goBack());
    await settle();
    expect(discardPrompts()).toHaveLength(2);
    expect(focusedRoute()).toBe('NewWorkOrder');

    answer = 'last';
    act(() => navigation_ref.goBack());
    await settle();
    expect(discardPrompts()).toHaveLength(3);
    expect(focusedRoute()).toBe('WorkOrders');
    expect(screen.queryByText('Gutter clog')).toBeNull();
  });
});

describe('both themes', () => {
  test.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ])('the form draws its errors in the %s palette', async (scheme, palette) => {
    await AsyncStorage.setItem(appearance_key, scheme);
    await startDemo('Demo as Landlord');
    await go('NewWorkOrder');
    await press(screen.getByText('Add'));
    const message = screen.getByText('Add a title, like Kitchen faucet leaking.');
    expect(StyleSheet.flatten(message.props.style).color).toBe(palette.danger_text);
    expect(StyleSheet.flatten(screen.getByText('Title').props.style).color).toBe(
      palette.danger_text,
    );
  });
});

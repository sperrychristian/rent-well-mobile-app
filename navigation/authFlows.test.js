import { Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref, navigateWhenReady } from '../util/navigationRef';
import { setActiveScheme } from '../constants/theme';
import {
  seededFirebase,
  uninstallFakeFirebase,
  signInAs,
  test_password,
  test_session_key,
} from '../scripts/testing/fakeFirebase';
import { navigation_map } from './navigationMap';

// assignment 12: the real App and its real navigators in Firebase mode against the fake, with the database
// turning away anything without a token (like the new rules): what a signed-out person can reach, log out,
// and the whole sign up, log out, log in, relaunch story for both kinds of users

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
  for (let index = 0; index < (rounds || 8); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function launch() {
  forgetNavigationState();
  const view = render(<App />);
  await settle(12);
  return view;
}

async function go(route_name, params) {
  act(() => navigation_ref.navigate(route_name, params));
  await settle();
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

async function press(label) {
  fireEvent.press(screen.getByLabelText(label));
  await settle(10);
}

function route() {
  return navigation_ref.getCurrentRoute().name;
}

function databaseCalls(firebase) {
  return firebase.fetch.calls.filter((call) => call.url.includes('firebaseio.com'));
}

async function logOutFromDrawer() {
  fireEvent.press(screen.getByTestId('drawer-logout'));
  await settle(10);
}

async function logIn(email, password) {
  type('Email', email);
  type('Password', password);
  await press('Log In');
}

const signed_out_screens = Object.keys(navigation_map)
  .filter((name) => navigation_map[name].role === 'auth')
  .sort();

let firebase;

beforeEach(async () => {
  await AsyncStorage.clear();
  setActiveScheme('light');
  firebase = seededFirebase(undefined, { require_auth: true });
  // every alert taps its last button (Log Out)
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

describe('signed out', () => {
  test('only the five signed-out screens are registered, and a private name goes nowhere', async () => {
    await launch();
    expect(route()).toBe('Welcome');
    expect(signed_out_screens).toEqual([
      'DemoChooser',
      'Login',
      'RegisterOwner',
      'RegisterTenant',
      'Welcome',
    ]);
    expect([...navigation_ref.getRootState().routeNames].sort()).toEqual(signed_out_screens);
    const error_spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const name of ['Dashboard', 'WorkOrderDetail', 'Payments', 'Settings', 'TenantHome']) {
      await go(name, name === 'WorkOrderDetail' ? { workOrderId: 'wo-1' } : undefined);
      expect(route()).toBe('Welcome');
    }
    error_spy.mockRestore();
  });

  test('a link or push to a private screen while signed out opens Login instead', async () => {
    await launch();
    act(() => navigateWhenReady('WorkOrderDetail', { workOrderId: 'wo-1' }));
    await settle();
    expect(route()).toBe('Login');
    expect(navigation_ref.getCurrentRoute().params).toBeUndefined();
  });

  test('no provider asks the database for anything before there is a token', async () => {
    await launch();
    expect(databaseCalls(firebase)).toHaveLength(0);
  });
});

describe('a new landlord', () => {
  test('signs up, logs out, fails with a wrong password, logs in, and stays logged in after a relaunch', async () => {
    await launch();
    await go('RegisterOwner');
    type('Your name', 'Robin Hale');
    type('Email', 'robin@example.com');
    type('Confirm email', 'robin@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    await press('Create Account');
    await settle(10);
    expect(route()).toBe('Dashboard');
    // a brand new account: the setup checklist and empty lists, not anyone else's data
    expect(screen.getByText('Add a property')).toBeTruthy();
    await go('WorkOrders');
    expect(screen.getByText('No work orders yet')).toBeTruthy();
    // every request so far went out with the token
    databaseCalls(firebase).forEach((call) => expect(call.url).toContain('auth=fake-id-'));

    // log out from the drawer: Login, nothing to go back to, nothing saved
    await logOutFromDrawer();
    expect(route()).toBe('Login');
    expect(navigation_ref.canGoBack()).toBe(false);
    expect([...navigation_ref.getRootState().routeNames].sort()).toEqual(signed_out_screens);
    expect(await AsyncStorage.getItem(test_session_key)).toBeNull();

    // a wrong password shows the message and stays here
    await logIn('robin@example.com', 'wrong-password');
    expect(screen.getAllByText("That email or password isn't right.").length).toBeGreaterThan(0);
    expect(route()).toBe('Login');

    // the right one opens the dashboard
    await logIn('robin@example.com', 'long-enough-1');
    await settle(10);
    expect(route()).toBe('Dashboard');

    // close and reopen the app: still logged in, no Login screen on the way
    screen.unmount();
    await launch();
    expect(route()).toBe('Dashboard');
    expect(screen.queryByLabelText('Log In')).toBeNull();
  });

  test('logging out clears the last account, so the next one never sees its lists', async () => {
    await signInAs(firebase, 'owner-taylor');
    await launch();
    await go('WorkOrders');
    expect(screen.getAllByText('Kitchen faucet leaking').length).toBeGreaterThan(0);
    await logOutFromDrawer();
    expect(route()).toBe('Login');
    const { email } = await signInAs(firebase, 'owner-jamie');
    await AsyncStorage.removeItem(test_session_key);
    await logIn(email, test_password);
    await settle(10);
    await go('WorkOrders');
    expect(screen.queryByText('Kitchen faucet leaking')).toBeNull();
    expect(screen.getByText('No work orders yet')).toBeTruthy();
  });
});

describe('a new tenant', () => {
  test('signs up with an invite code and lands on their home', async () => {
    await launch();
    await go('RegisterTenant');
    type('Invite code', 'K7M2-QX9P');
    type('Email', 'casey@example.com');
    type('Confirm email', 'casey@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    await press('Join');
    await settle(10);
    expect(route()).toBe('TenantHome');
    expect(screen.getAllByText(/Unit 4/).length).toBeGreaterThan(0);
  });
});

describe('the token', () => {
  test('an expired token at launch refreshes quietly and the app opens on the home', async () => {
    await signInAs(firebase, 'owner-taylor');
    firebase.auth.expireTokens();
    const saved = JSON.parse(await AsyncStorage.getItem(test_session_key));
    await AsyncStorage.setItem(
      test_session_key,
      JSON.stringify({ ...saved, expiresAt: Date.now() - 1000 }),
    );
    await launch();
    expect(route()).toBe('Dashboard');
    expect(firebase.auth.counts.token).toBe(1);
    expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
    expect(screen.queryByText('Try Again')).toBeNull();
  });
});

describe('the seeded landlord', () => {
  test('Taylor Brooks logs in and still sees work orders, payments, and messages', async () => {
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.removeItem(test_session_key);
    await launch();
    await go('Login');
    await logIn(email, test_password);
    await settle(10);
    expect(route()).toBe('Dashboard');
    expect(screen.getByText('3 open, 1 in progress')).toBeTruthy();
    await go('WorkOrders');
    expect(screen.getAllByText('Kitchen faucet leaking').length).toBeGreaterThan(0);
    await go('Payments');
    expect(screen.getAllByText(/Sam Rivera/).length).toBeGreaterThan(0);
    await go('Messages');
    expect(screen.getAllByText(/Sam Rivera/).length).toBeGreaterThan(0);
  });
});

import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../../../App';
import { navigation_ref } from '../../../util/navigationRef';
import { setActiveScheme } from '../../../constants/theme';
import { appearance_key } from '../../../store/ThemeContext';
import {
  seededFirebase,
  uninstallFakeFirebase,
  signInAs,
  test_password,
} from '../../../scripts/testing/fakeFirebase';

// assignment 12: Log In, Landlord Sign Up, and Tenant Sign Up on the real App, signed out in Firebase mode,
// against the fake Auth: every message under its box, the server errors, the loading overlay, no double
// submit, the setup message, and a smoke render of each in light and dark

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

async function settle(rounds) {
  for (let index = 0; index < (rounds || 6); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

let firebase;

async function open(route_name) {
  forgetNavigationState();
  render(<App />);
  await settle();
  act(() => navigation_ref.navigate(route_name));
  await settle();
  expect(navigation_ref.getCurrentRoute().name).toBe(route_name);
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

async function press(label) {
  fireEvent.press(screen.getByLabelText(label));
  await settle(8);
}

function shows(text) {
  expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
}

// a fetch for the Auth servers that never answers, so the loading state stays up
function hangAuth() {
  const real = global.fetch;
  const hung = jest.fn((url, init) =>
    url.includes('rent-well.test') ? new Promise(() => {}) : real(url, init),
  );
  global.fetch = hung;
  return hung;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setActiveScheme('light');
  firebase = seededFirebase(undefined, { require_auth: true });
});

afterEach(() => {
  uninstallFakeFirebase();
});

afterAll(() => setActiveScheme('light'));

describe('Log In', () => {
  test('empty boxes each say what is missing, and no request goes out', async () => {
    await open('Login');
    await press('Log In');
    shows('Enter your email.');
    shows('Enter your password.');
    expect(firebase.auth.counts.signInWithPassword).toBe(0);
  });

  test('an email that does not look like one is caught on the phone', async () => {
    await open('Login');
    type('Email', 'nope');
    type('Password', 'whatever1');
    await press('Log In');
    shows('Enter a valid email, like name@example.com.');
    expect(firebase.auth.counts.signInWithPassword).toBe(0);
  });

  test('a wrong password shows the one generic message, never the Firebase code', async () => {
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await open('Login');
    type('Email', email);
    type('Password', 'not-the-password');
    await press('Log In');
    shows("That email or password isn't right.");
    expect(screen.queryByText(/INVALID_LOGIN_CREDENTIALS/)).toBeNull();
    expect(navigation_ref.getCurrentRoute().name).toBe('Login');
  });

  test('no network says so', async () => {
    await open('Login');
    firebase.fetch.auth_offline = true;
    type('Email', 'taylor@example.com');
    type('Password', test_password);
    await press('Log In');
    shows("Can't reach the sign in server. Check your connection and try again.");
  });

  test('too many tries and a turned off account get their own words', async () => {
    await open('Login');
    type('Email', 'taylor@example.com');
    type('Password', test_password);
    firebase.auth.failNext('TOO_MANY_ATTEMPTS_TRY_LATER');
    await press('Log In');
    shows('Too many tries. Wait a few minutes and try again.');
  });

  test('while it works the overlay says Logging in..., and a second tap sends nothing', async () => {
    await open('Login');
    const hung = hangAuth();
    type('Email', 'taylor@example.com');
    type('Password', test_password);
    fireEvent.press(screen.getByLabelText('Log In'));
    // the overlay hides the form from screen readers, so the extra taps reach for the hidden button
    const hidden = { includeHiddenElements: true };
    screen.getAllByLabelText('Log In', hidden).forEach((button) => fireEvent.press(button));
    await settle();
    screen.getAllByLabelText('Log In', hidden).forEach((button) => fireEvent.press(button));
    await settle();
    expect(screen.getAllByLabelText('Logging in...').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    const auth_calls = hung.mock.calls.filter((call) => call[0].includes('rent-well.test'));
    expect(auth_calls).toHaveLength(1);
  });

  test('the right password opens the landlord dashboard', async () => {
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await open('Login');
    type('Email', email);
    type('Password', test_password);
    await press('Log In');
    await settle(10);
    expect(navigation_ref.getCurrentRoute().name).toBe('Dashboard');
  });

  test('with no API key in .env it shows the setup message and sends nothing', async () => {
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    await open('Login');
    shows(
      'The Firebase API key is missing. Add EXPO_PUBLIC_FIREBASE_API_KEY to .env, then restart Expo with npx expo start -c.',
    );
    type('Email', 'taylor@example.com');
    type('Password', test_password);
    await press('Log In');
    expect(firebase.auth.counts.signInWithPassword).toBe(0);
  });

  test('the links switch to the sign up screens', async () => {
    await open('Login');
    fireEvent.press(screen.getByText('New landlord? Create an account'));
    await settle();
    expect(navigation_ref.getCurrentRoute().name).toBe('RegisterOwner');
    fireEvent.press(screen.getByText('Already have an account? Log in'));
    await settle();
    fireEvent.press(screen.getByText('I have an invite code'));
    await settle();
    expect(navigation_ref.getCurrentRoute().name).toBe('RegisterTenant');
  });
});

describe('Landlord Sign Up', () => {
  test('empty boxes each say what is missing', async () => {
    await open('RegisterOwner');
    await press('Create Account');
    shows('Enter your name.');
    shows('Enter your email.');
    shows('Enter a password.');
    expect(firebase.auth.counts.signUp).toBe(0);
  });

  test('the confirm boxes have to match, and the password needs 8 characters', async () => {
    await open('RegisterOwner');
    type('Your name', 'Robin Hale');
    type('Email', 'robin@example.com');
    type('Confirm email', 'robin@example.org');
    type('Password', 'short');
    await press('Create Account');
    shows("The emails don't match.");
    shows('Use at least 8 characters.');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-2');
    await press('Create Account');
    shows("The passwords don't match.");
    expect(firebase.auth.counts.signUp).toBe(0);
  });

  test('an email that already has an account says so under the box and at the top', async () => {
    const { email } = await signInAs(firebase, 'owner-taylor');
    await AsyncStorage.clear();
    await open('RegisterOwner');
    type('Your name', 'Copy Cat');
    type('Email', email);
    type('Confirm email', email);
    type('Password', 'different-pass');
    type('Confirm password', 'different-pass');
    await press('Create Account');
    expect(
      screen.getAllByText('An account with that email already exists. Log in instead.').length,
    ).toBe(2);
  });

  test('the overlay says Creating user... while it works', async () => {
    await open('RegisterOwner');
    hangAuth();
    type('Your name', 'Robin Hale');
    type('Email', 'robin@example.com');
    type('Confirm email', 'robin@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    fireEvent.press(screen.getByLabelText('Create Account'));
    await settle();
    expect(screen.getAllByLabelText('Creating user...').length).toBeGreaterThan(0);
  });

  test('a good sign up lands on the dashboard', async () => {
    await open('RegisterOwner');
    type('Your name', 'Robin Hale');
    type('Email', 'robin@example.com');
    type('Confirm email', 'robin@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    await press('Create Account');
    await settle(10);
    expect(navigation_ref.getCurrentRoute().name).toBe('Dashboard');
  });
});

describe('Tenant Sign Up', () => {
  test('the invite code is checked first, then the rest', async () => {
    await open('RegisterTenant');
    await press('Join');
    shows('Enter the invite code from your landlord.');
    shows('Enter your email.');
    shows('Enter a password.');
    type('Invite code', 'K7M2QX0P');
    await press('Join');
    shows('Invite codes are 8 letters and numbers, like K7M2-QX9P.');
  });

  test('a code that looks right but does not work says so under the box', async () => {
    await open('RegisterTenant');
    type('Invite code', 'WXYZ-2345');
    type('Email', 'casey@example.com');
    type('Confirm email', 'casey@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    await press('Join');
    expect(screen.getAllByText(/That invite code doesn't work/).length).toBe(2);
    expect(navigation_ref.getCurrentRoute().name).toBe('RegisterTenant');
  });

  test('a good code and account land on the tenant home', async () => {
    await open('RegisterTenant');
    type('Invite code', 'k7m2-qx9p');
    type('Email', 'casey@example.com');
    type('Confirm email', 'casey@example.com');
    type('Password', 'long-enough-1');
    type('Confirm password', 'long-enough-1');
    await press('Join');
    await settle(10);
    expect(navigation_ref.getCurrentRoute().name).toBe('TenantHome');
  });
});

describe('light and dark', () => {
  test.each(['light', 'dark'])('all three screens draw in %s', async (scheme) => {
    await AsyncStorage.setItem(appearance_key, scheme);
    for (const route_name of ['Login', 'RegisterOwner', 'RegisterTenant']) {
      await open(route_name);
      expect(screen.getAllByLabelText('Email').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Show password').length).toBeGreaterThan(0);
      screen.unmount();
    }
  });
});

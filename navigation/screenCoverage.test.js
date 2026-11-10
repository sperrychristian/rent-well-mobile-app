import { render, screen, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../util/navigationRef';
import { navigation_map } from './navigationMap';
import { screen_coverage } from './screenCoverage';
import { seededFirebase, uninstallFakeFirebase } from '../scripts/testing/fakeFirebase';

// one test per data screen in the coverage matrix, on the real App in Firebase mode:
// loading (the database never answers), error (no connection), and empty (an account with nothing yet)
// each one has to show something: a spinner or skeleton, the error with Try Again, or its empty screen

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
  for (let index = 0; index < (rounds || 8); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// signs in (or not), sets how the database answers, opens the App, then the screen
async function openScreen(route_name, account, params, answer) {
  const firebase = seededFirebase();
  if (account) {
    const user = firebase.database.dump().users[account];
    await AsyncStorage.setItem('rent_well_test_account', JSON.stringify(user));
  }
  if (answer === 'loading') {
    global.fetch = jest.fn(() => new Promise(() => {}));
  } else if (answer === 'error') {
    firebase.fetch.offline = true;
  }
  forgetNavigationState();
  render(<App />);
  await settle();
  if (navigation_ref.getCurrentRoute().name !== route_name) {
    act(() => navigation_ref.navigate(route_name, params));
    await settle();
  }
  expect(navigation_ref.getCurrentRoute().name).toBe(route_name);
}

const data_screens = Object.keys(screen_coverage).filter((name) => screen_coverage[name].test);

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  uninstallFakeFirebase();
});

test('every screen in the navigation map is in the coverage matrix, and back', () => {
  expect(Object.keys(screen_coverage).sort()).toEqual(Object.keys(navigation_map).sort());
});

describe.each(data_screens)('%s in Firebase mode', (route_name) => {
  const entry = screen_coverage[route_name];
  const account = entry.test.account;
  const params = entry.test.params;

  test('shows a loading state while the database is answering', async () => {
    await openScreen(route_name, account, params, 'loading');
    expect(screen.queryAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  test('shows the error with Try Again when it can not reach the database', async () => {
    await openScreen(route_name, account, params, 'error');
    expect(screen.queryAllByText('Try Again').length).toBeGreaterThan(0);
  });

  if (entry.test.empty_account) {
    test('shows its empty screen for an account with nothing yet', async () => {
      await openScreen(route_name, entry.test.empty_account, params, 'ready');
      expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
      expect(screen.queryAllByText('Try Again')).toHaveLength(0);
      expect(screen.toJSON()).not.toBeNull();
    });
  }
});

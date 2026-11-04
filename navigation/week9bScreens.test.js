import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';
import { forgetDemoCalendarEvents } from '../features/calendar/utils/deviceCalendar';
import { appearance_key } from '../context/ThemeContext';
import { LIGHT_COLORS, DARK_COLORS, setActiveScheme } from '../theme';
import { StyleSheet } from 'react-native';
import { monthLabel } from '../features/calendar/utils/calendarEvents';
import { monthOf } from '../features/payments/utils/ledgerMath';
import { todayString } from '../utils/formatDate';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../services/navigationRef';

// the week 9b screens drawn on the real App in both demo sides and both themes: Search with results,
// the no matches state, Calendar with its grid and agenda, the add sheet, and Settings
// the colors are checked against the palette the app is drawing with, so dark mode can't fall back to light

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

jest.mock('expo-calendar/legacy', () => ({
  EntityTypes: { EVENT: 'event' },
  CalendarAccessLevel: { OWNER: 'owner' },
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(() => Promise.resolve([])),
  getDefaultCalendarAsync: jest.fn(() => Promise.resolve({ id: 'default', source: { id: 's' } })),
  createCalendarAsync: jest.fn(() => Promise.resolve('rent-well-calendar')),
  createEventAsync: jest.fn(() => Promise.resolve('event-id')),
  getEventAsync: jest.fn(() => Promise.reject(new Error('gone'))),
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

function focusedRoute() {
  return navigation_ref.getCurrentRoute().name;
}

async function openFromMenu(test_id) {
  fireEvent.press(screen.getAllByLabelText('Open the menu')[0]);
  await settle();
  fireEvent.press(screen.getByTestId(test_id));
  await settle();
}

async function typeSearch(text) {
  fireEvent.changeText(screen.getByLabelText('Search'), text);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await settle();
}

function colorOf(node) {
  return StyleSheet.flatten(node.props.style).color;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  forgetDemoCalendarEvents();
  setActiveScheme('light');
  Calendar.getCalendarPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
});

afterAll(() => setActiveScheme('light'));

const cases = [
  { side: 'Demo as Landlord', scheme: 'light', palette: LIGHT_COLORS, query: 'maple' },
  { side: 'Demo as Landlord', scheme: 'dark', palette: DARK_COLORS, query: 'maple' },
  { side: 'Demo as Tenant', scheme: 'light', palette: LIGHT_COLORS, query: 'faucet' },
  { side: 'Demo as Tenant', scheme: 'dark', palette: DARK_COLORS, query: 'faucet' },
];

describe.each(cases)('$side in $scheme', ({ side, scheme, palette, query }) => {
  test('Search draws its results, highlights, and empty states in the palette', async () => {
    await AsyncStorage.setItem(appearance_key, scheme);
    await startDemo(side);
    fireEvent.press(screen.getByLabelText('Search'));
    await settle();
    expect(focusedRoute()).toBe('Search');
    expect(colorOf(screen.getByText('Search everything'))).toBe(palette.text);

    await typeSearch(query);
    expect(screen.getByText(/results?$/)).toBeTruthy();
    // the matching letters are green in this palette
    const match = screen.getAllByText(new RegExp('^' + query + '$', 'i'))[0];
    expect(colorOf(match)).toBe(palette.cta);

    await typeSearch('zzzz');
    expect(colorOf(screen.getByText('No matches'))).toBe(palette.text);
  });

  test('Calendar draws the grid, the legend, the agenda, and the add sheet', async () => {
    await AsyncStorage.setItem(appearance_key, scheme);
    await startDemo(side);
    await openFromMenu('drawer-Calendar');
    expect(focusedRoute()).toBe('Calendar');
    const title = screen.getByText(monthLabel(monthOf(todayString())));
    expect(colorOf(title)).toBe(palette.title);
    expect(screen.getByText('Past due')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(28);

    fireEvent.press(screen.getByText('Add upcoming rent due dates and lease ends'));
    await settle();
    const sheet_title = screen.getByText('Add sample events?');
    expect(colorOf(sheet_title)).toBe(palette.title);
    fireEvent.press(screen.getByText('Not Now'));
    await settle();
    expect(screen.queryByText('Add sample events?')).toBeNull();
  });

  test('Settings has no Security card in the demo', async () => {
    await AsyncStorage.setItem(appearance_key, scheme);
    await startDemo(side);
    await openFromMenu('drawer-Settings');
    expect(focusedRoute()).toBe('Settings');
    expect(screen.queryByText('Security')).toBeNull();
  });
});

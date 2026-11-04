import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';
import { forgetDemoCalendarEvents } from '../features/calendar/utils/deviceCalendar';
import { dayLabel } from '../features/calendar/utils/calendarEvents';
import { monthOf, shiftMonth } from '../features/payments/utils/ledgerMath';
import { todayString } from '../utils/formatDate';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../services/navigationRef';

// Calendar on the real App: the drawer item on both sides, the month grid and agenda, past due rows,
// and "Add to my calendar" with the demo's confirm sheet and a denied permission (the same harness as appNavigation.test.js)

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

async function openCalendar() {
  fireEvent.press(screen.getAllByLabelText('Open the menu')[0]);
  await settle();
  fireEvent.press(screen.getByTestId('drawer-Calendar'));
  await settle();
}

// last month's first day: Sam only paid part of last month, so that rent is past due on any day the test runs
const last_month_first = shiftMonth(monthOf(todayString()), -1) + '-01';

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetNavigationState();
  forgetDemoCalendarEvents();
  jest.clearAllMocks();
  Calendar.getCalendarPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  Alert.alert.mockRestore();
});

describe('Calendar, landlord demo', () => {
  test('the drawer opens it on today, and a past due rent row opens that ledger by id', async () => {
    await startDemo('Demo as Landlord');
    await openCalendar();
    expect(focusedRoute()).toBe('Calendar');
    expect(
      screen.getByLabelText(new RegExp('^' + dayLabel(todayString()) + ', today')),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/^Previous month/));
    await settle();
    fireEvent.press(screen.getByLabelText(new RegExp('^' + dayLabel(last_month_first) + ',')));
    await settle();
    const late = screen.getAllByLabelText(/^Past due, Rent due/);
    expect(late.length).toBeGreaterThan(0);
    fireEvent.press(late[0]);
    await settle();
    expect(focusedRoute()).toBe('TenantLedger');
    expect(navigation_ref.getCurrentRoute().params.tenancyId).toMatch(/^demo-tenancy-/);
  });

  test('Add upcoming asks first with the demo note, then adds [Demo] events', async () => {
    await startDemo('Demo as Landlord');
    await openCalendar();
    fireEvent.press(screen.getByText('Add upcoming rent due dates and lease ends'));
    await settle();
    expect(screen.getByText('Add sample events?')).toBeTruthy();
    expect(screen.getByText(/these are sample events/)).toBeTruthy();
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Add Sample Events'));
    await settle();
    expect(Calendar.createEventAsync).toHaveBeenCalled();
    Calendar.createEventAsync.mock.calls.forEach((call) => {
      expect(call[1].title.startsWith('[Demo] ')).toBe(true);
    });
    expect(screen.getByText(/to your calendar$/)).toBeTruthy();
  });

  test('a denied permission explains itself and offers Settings', async () => {
    Calendar.getCalendarPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const open_settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await startDemo('Demo as Landlord');
    await openCalendar();
    fireEvent.press(screen.getByText('Add upcoming rent due dates and lease ends'));
    await settle();
    expect(screen.getByText(/Your phone will ask/)).toBeTruthy();
    fireEvent.press(screen.getByText('Add Sample Events'));
    await settle();
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    const [title, , buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Calendar access is off');
    buttons.find((button) => button.text === 'Open Settings').onPress();
    expect(open_settings).toHaveBeenCalled();
    open_settings.mockRestore();
  });
});

describe('Calendar, tenant demo', () => {
  test("a tenant sees only Sam's dates, and a rent row opens Payments", async () => {
    await startDemo('Demo as Tenant');
    await openCalendar();
    expect(focusedRoute()).toBe('Calendar');
    fireEvent.press(screen.getByLabelText(/^Previous month/));
    await settle();
    fireEvent.press(screen.getByLabelText(new RegExp('^' + dayLabel(last_month_first) + ',')));
    await settle();
    expect(screen.queryByText(/Jordan/)).toBeNull();
    const late = screen.getAllByLabelText(/^Past due, Rent due/);
    fireEvent.press(late[0]);
    await settle();
    expect(focusedRoute()).toBe('Payments');
  });
});

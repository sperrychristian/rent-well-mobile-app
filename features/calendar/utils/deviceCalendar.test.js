import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';
import {
  addEventsToPhone,
  askCalendarPermission,
  calendar_events_key,
  forgetDemoCalendarEvents,
} from './deviceCalendar';
import { systemDialogActive, resetSystemDialogs } from '../../../services/appLock';

// the phone's calendar, played by a small fake that remembers what was added

jest.mock('expo-calendar/legacy', () => ({
  EntityTypes: { EVENT: 'event' },
  CalendarAccessLevel: { OWNER: 'owner' },
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  createCalendarAsync: jest.fn(),
  createEventAsync: jest.fn(),
  getEventAsync: jest.fn(),
}));

const entries = [
  { key: 'charge:rent-nov', date: '2026-11-01', title: 'Rent due, $1,450.00', subtitle: 'Sam' },
  { key: 'lease:t-sam', date: '2026-11-22', title: 'Lease ends', subtitle: 'Sam' },
];

let phone_events;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  forgetDemoCalendarEvents();
  resetSystemDialogs();
  phone_events = {};
  let next_id = 1;
  Calendar.getCalendarsAsync.mockResolvedValue([]);
  Calendar.getDefaultCalendarAsync.mockResolvedValue({ id: 'default', source: { id: 'src' } });
  Calendar.createCalendarAsync.mockResolvedValue('rent-well-calendar');
  Calendar.createEventAsync.mockImplementation(async (calendar_id, details) => {
    const id = 'event-' + next_id++;
    phone_events[id] = { calendar_id, ...details };
    return id;
  });
  Calendar.getEventAsync.mockImplementation(async (id) => {
    if (!phone_events[id]) {
      throw new Error('not found');
    }
    return phone_events[id];
  });
});

describe('adding to the phone', () => {
  test('a Rent Well calendar is made once, and the same events never go in twice', async () => {
    const first = await addEventsToPhone(entries, { user_id: 'owner-1', demo_mode: false });
    expect(first).toEqual({ added: 2, skipped: 0 });
    expect(Calendar.createCalendarAsync.mock.calls[0][0]).toMatchObject({ title: 'Rent Well' });
    expect(
      Object.values(phone_events).every((item) => item.calendar_id === 'rent-well-calendar'),
    ).toBe(true);

    const second = await addEventsToPhone(entries, { user_id: 'owner-1', demo_mode: false });
    expect(second).toEqual({ added: 0, skipped: 2 });
    expect(Object.keys(phone_events)).toHaveLength(2);
    const saved = JSON.parse(await AsyncStorage.getItem(calendar_events_key + '_owner-1'));
    expect(Object.keys(saved).sort()).toEqual(['charge:rent-nov', 'lease:t-sam']);
  });

  test('one deleted in the Calendar app goes back in the next time', async () => {
    await addEventsToPhone(entries, { user_id: 'owner-1', demo_mode: false });
    delete phone_events['event-1'];
    const again = await addEventsToPhone(entries, { user_id: 'owner-1', demo_mode: false });
    expect(again).toEqual({ added: 1, skipped: 1 });
  });

  test("an existing Rent Well calendar is reused, and the phone's default is the fallback", async () => {
    Calendar.getCalendarsAsync.mockResolvedValue([
      { id: 'mine', title: 'Rent Well', allowsModifications: true },
    ]);
    await addEventsToPhone([entries[0]], { user_id: 'owner-1', demo_mode: false });
    expect(Calendar.createCalendarAsync).not.toHaveBeenCalled();
    expect(phone_events['event-1'].calendar_id).toBe('mine');

    Calendar.getCalendarsAsync.mockResolvedValue([]);
    Calendar.createCalendarAsync.mockRejectedValue(new Error('not allowed'));
    await addEventsToPhone([entries[1]], { user_id: 'owner-2', demo_mode: false });
    expect(phone_events['event-2'].calendar_id).toBe('default');
  });

  test('the demo adds [Demo] titles and never saves to storage', async () => {
    const result = await addEventsToPhone(entries, { user_id: null, demo_mode: true });
    expect(result.added).toBe(2);
    expect(Object.values(phone_events).every((item) => item.title.startsWith('[Demo] '))).toBe(
      true,
    );
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    // still no doubles inside the same demo run
    expect(await addEventsToPhone(entries, { user_id: null, demo_mode: true })).toEqual({
      added: 0,
      skipped: 2,
    });
  });

  test('every event is all day on its date', async () => {
    await addEventsToPhone([entries[0]], { user_id: 'owner-1', demo_mode: false });
    const added = phone_events['event-1'];
    expect(added.allDay).toBe(true);
    expect(added.startDate.getDate()).toBe(1);
  });
});

describe('asking for access', () => {
  test('the app lock is paused while the system prompt is up', async () => {
    let active_during = null;
    Calendar.requestCalendarPermissionsAsync.mockImplementation(async () => {
      active_during = systemDialogActive();
      return { granted: true, canAskAgain: true };
    });
    const result = await askCalendarPermission();
    expect(result).toEqual({ granted: true, can_ask: true });
    expect(active_during).toBe(true);
  });
});

import { Platform, Linking } from 'react-native';
// the legacy functions, since the newer object API isn't in Expo Go yet and these work in both
import * as Calendar from 'expo-calendar/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKey } from '../../../utils/storageKeys';
import { LIGHT_COLORS } from '../../../theme';
import { deviceEventDetails } from './calendarEvents';
import { whileSystemDialog } from '../../../services/appLock';

// which app events are already on the phone, { event key: the phone's event id }, saved per account
export const calendar_events_key = 'rent_well_calendar_events';
const calendar_title = 'Rent Well';

// the demo never saves anything, so its list lives here and goes away when the app closes
const demo_created = {};

// granted, denied, or undetermined, plus whether the phone will still show the prompt
export async function calendarPermission() {
  const result = await Calendar.getCalendarPermissionsAsync();
  return { granted: result.granted, can_ask: result.canAskAgain !== false };
}

// the system prompt, it pauses the app lock while it's up (a prompt can send the app to the background)
export async function askCalendarPermission() {
  const result = await whileSystemDialog(() => Calendar.requestCalendarPermissionsAsync());
  return { granted: result.granted, can_ask: result.canAskAgain !== false };
}

export function openPhoneSettings() {
  return Linking.openSettings();
}

// a "Rent Well" calendar of its own when the phone allows it, otherwise the phone's default one
async function targetCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const mine = calendars.find(
    (calendar) => calendar.title === calendar_title && calendar.allowsModifications,
  );
  if (mine) {
    return mine.id;
  }
  try {
    // the brand green from the light palette, the phone shows it as the calendar's color
    if (Platform.OS === 'ios') {
      const fallback = await Calendar.getDefaultCalendarAsync();
      return await Calendar.createCalendarAsync({
        title: calendar_title,
        color: LIGHT_COLORS.cta,
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: fallback.source.id,
        source: fallback.source,
        name: 'rent-well',
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }
    return await Calendar.createCalendarAsync({
      title: calendar_title,
      color: LIGHT_COLORS.cta,
      entityType: Calendar.EntityTypes.EVENT,
      source: { isLocalAccount: true, name: calendar_title },
      name: 'rent-well',
      ownerAccount: calendar_title,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  } catch (error) {
    console.log('Could not make a Rent Well calendar, using the default one', error.message);
  }
  if (Platform.OS === 'ios') {
    const fallback = await Calendar.getDefaultCalendarAsync();
    return fallback.id;
  }
  const writable =
    calendars.find((calendar) => calendar.isPrimary && calendar.allowsModifications) ||
    calendars.find((calendar) => calendar.allowsModifications);
  return writable ? writable.id : null;
}

async function loadCreated(user_id, demo_mode) {
  if (demo_mode) {
    return { ...demo_created };
  }
  try {
    const text = await AsyncStorage.getItem(storageKey(calendar_events_key, user_id));
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.log('Could not read the added calendar events', error);
    return {};
  }
}

async function saveCreated(created, user_id, demo_mode) {
  if (demo_mode) {
    Object.assign(demo_created, created);
    return;
  }
  await AsyncStorage.setItem(
    storageKey(calendar_events_key, user_id),
    JSON.stringify(created),
  ).catch((error) => console.log('Could not save the added calendar events', error));
}

// is the event I added before still on the phone? someone may have deleted it in the Calendar app
async function stillThere(event_id) {
  try {
    const found = await Calendar.getEventAsync(event_id);
    return !!found;
  } catch {
    return false;
  }
}

// adds the events that aren't on the phone yet, gives back { added, skipped }
// permission has to be granted before this runs, the hook asks first
export async function addEventsToPhone(entries, options) {
  const user_id = options.user_id || null;
  const demo_mode = !!options.demo_mode;
  const calendar_id = await targetCalendarId();
  if (!calendar_id) {
    throw new Error('No calendar on this phone can take new events.');
  }
  const created = await loadCreated(user_id, demo_mode);
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (created[entry.key] && (await stillThere(created[entry.key]))) {
      skipped++;
      continue;
    }
    created[entry.key] = await Calendar.createEventAsync(
      calendar_id,
      deviceEventDetails(entry, demo_mode),
    );
    added++;
  }
  await saveCreated(created, user_id, demo_mode);
  return { added: added, skipped: skipped };
}

// the tests start each run with no demo events remembered
export function forgetDemoCalendarEvents() {
  Object.keys(demo_created).forEach((key) => delete demo_created[key]);
}

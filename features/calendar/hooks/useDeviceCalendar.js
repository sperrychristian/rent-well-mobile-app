import { useState } from 'react';
import { Alert } from 'react-native';
import { useToast } from '../../../components/ui/Toast';
import {
  calendarPermission,
  askCalendarPermission,
  addEventsToPhone,
  openPhoneSettings,
} from '../utils/deviceCalendar';

// "Add to my calendar": a sheet first that says what's about to happen (and in the demo, that these are
// sample events going onto the real phone), then the system prompt if it's needed, then the events
// a "no" from the phone gets a plain message and a way to Settings, it never just fails quietly
export function useDeviceCalendar(user_id, demo_mode) {
  const toast = useToast();
  // the sheet's state: null when it's closed, otherwise { entries, needs_permission }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start(entries) {
    if (entries.length === 0) {
      toast.show('Nothing coming up to add', 'calendar-outline');
      return;
    }
    let needs_permission = true;
    try {
      needs_permission = !(await calendarPermission()).granted;
    } catch (error) {
      console.log('Could not check calendar access', error.message);
    }
    setPending({ entries: entries, needs_permission: needs_permission });
  }

  function cancel() {
    setPending(null);
  }

  function explainDenied() {
    Alert.alert(
      'Calendar access is off',
      'Rent Well can only add these if it can use your calendar. Turn on Calendars for Rent Well in Settings, then try again.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openPhoneSettings() },
      ],
    );
  }

  async function confirm() {
    const entries = pending ? pending.entries : [];
    setPending(null);
    setBusy(true);
    try {
      let access = await calendarPermission();
      if (!access.granted && access.can_ask) {
        access = await askCalendarPermission();
      }
      if (!access.granted) {
        explainDenied();
        return;
      }
      const result = await addEventsToPhone(entries, { user_id: user_id, demo_mode: demo_mode });
      if (result.added === 0) {
        toast.show('Already in your calendar', 'checkmark-circle-outline');
      } else {
        toast.show(
          result.added === 1
            ? 'Added 1 event to your calendar'
            : 'Added ' + result.added + ' events to your calendar',
          'calendar-outline',
        );
      }
    } catch (error) {
      Alert.alert('Could not add to your calendar', error.message);
    } finally {
      setBusy(false);
    }
  }

  return { pending, busy, start, cancel, confirm };
}

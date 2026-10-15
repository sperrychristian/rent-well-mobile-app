import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKey } from '../../../utils/storageKeys';

// whether this account hid the setup checklist for good, saved per account so a shared phone keeps them apart
// gives back [dismissed, dismiss], dismissed is null while it's still being read (so the card doesn't flash)
// no user (signed out or the demo) never reads or writes anything
const dismissed_key = 'rent_well_onboarding_dismissed';

export function useOnboardingDismissed(user_id) {
  const [dismissed, setDismissed] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user_id) {
      return undefined;
    }
    AsyncStorage.getItem(storageKey(dismissed_key, user_id))
      .then((value) => {
        if (active) {
          setDismissed(value === 'yes');
        }
      })
      .catch(() => {
        if (active) {
          setDismissed(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user_id]);

  function dismiss() {
    setDismissed(true);
    if (user_id) {
      AsyncStorage.setItem(storageKey(dismissed_key, user_id), 'yes').catch((error) =>
        console.log('Could not save hiding the setup checklist', error),
      );
    }
  }

  return [user_id ? dismissed : true, dismiss];
}

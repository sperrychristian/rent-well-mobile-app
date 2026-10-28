import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, AppState, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { setNavigationHold, systemDialogActive } from '../../../services/appLock';
import { openHeldNavigation } from '../../../services/navigationRef';
import { canLock, shouldLockOnReturn } from '../utils/lockRules';
import { unlockWithDevice } from '../utils/biometrics';
import LockScreen from '../components/LockScreen';

// the switch is saved on this phone, not per account, like Appearance
export const biometric_unlock_key = 'rent_well_biometric_unlock';

const AppLockContext = createContext(null);

// the app lock: when the switch is on, a signed-in account has to pass Face ID, Touch ID, or the passcode
// on a launch that restores the saved session, and again after more than a minute in the background
// the lock screen covers the app instead of replacing it, so nothing underneath loses its place,
// and a push tap that comes in while it's up waits and opens once the app unlocks
export function AppLockProvider(props) {
  const { user, status, logout } = useAuth();
  const { demo_mode } = useWorkOrders();
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  // a launch that restores a saved session asks on the way in, a fresh login with a password doesn't
  const [cold_pending, setColdPending] = useState(status === 'restoring');
  const lockable = canLock({ enabled: enabled, user: user, demo_mode: demo_mode });
  const decided = loaded && status !== 'restoring';

  // the restore finished and there's nothing to lock (signed out, demo, or the switch is off), so the cold
  // start check is done and a later login never counts as one
  if (cold_pending && decided && !lockable) {
    setColdPending(false);
  }
  const show_lock = lockable && (locked || (cold_pending && decided));
  // while it's still deciding, a signed-in launch shows the cover with no buttons so the app never flashes
  const covering = show_lock || (cold_pending && !decided && !!user);
  // a push tap waits while the cover is up, set during render so it's in place before any listener runs
  setNavigationHold(covering);

  useEffect(() => {
    AsyncStorage.getItem(biometric_unlock_key)
      .then((text) => setEnabledState(text === 'on'))
      .catch((error) => console.log('Could not read the unlock setting', error))
      .finally(() => setLoaded(true));
  }, []);

  // the newest values for the AppState listener, which is only added once
  const latest = useRef({ lockable: lockable });
  useEffect(() => {
    latest.current = { lockable: lockable };
  });
  const background_at = useRef(null);
  const left_for_dialog = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        background_at.current = Date.now();
        left_for_dialog.current = systemDialogActive();
        return;
      }
      if (next === 'active') {
        if (
          latest.current.lockable &&
          shouldLockOnReturn(background_at.current, Date.now(), left_for_dialog.current)
        ) {
          setLocked(true);
        }
        background_at.current = null;
        left_for_dialog.current = false;
      }
    });
    return () => subscription.remove();
  }, []);

  // once the cover comes down, the push tap that waited behind it opens
  useEffect(() => {
    if (!covering) {
      openHeldNavigation();
    }
  }, [covering]);

  function unlock() {
    setLocked(false);
    setColdPending(false);
  }

  // turning it on checks with the phone first, so nobody turns on a lock they can't open
  // gives back true when the switch ended up the way they asked
  async function setEnabled(value) {
    if (value) {
      const check = await unlockWithDevice('Turn on unlock for Rent Well');
      if (!check.success) {
        return false;
      }
    }
    setEnabledState(value);
    await AsyncStorage.setItem(biometric_unlock_key, value ? 'on' : 'off').catch((error) =>
      console.log('Could not save the unlock setting', error),
    );
    return true;
  }

  const value = { enabled, loaded, setEnabled, locked: show_lock };

  return (
    <AppLockContext.Provider value={value}>
      {/* the app stays mounted under the cover, hidden from screen readers while it's locked */}
      <View
        style={styles.fill}
        accessibilityElementsHidden={covering}
        importantForAccessibility={covering ? 'no-hide-descendants' : 'auto'}
      >
        {props.children}
      </View>
      {covering ? (
        <LockScreen
          ready={show_lock}
          onUnlocked={unlock}
          onLogout={() => {
            unlock();
            logout();
          }}
        />
      ) : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const value = useContext(AppLockContext);
  if (!value) {
    throw new Error(
      'useAppLock() has to be used inside AppLockProvider (App.js wraps the navigator in it)',
    );
  }
  return value;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

import { Text, AppState } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppLockProvider, biometric_unlock_key } from './context/AppLockContext';
import SecurityCard from './components/SecurityCard';
import { canLock, shouldLockOnReturn, lock_after_ms } from './utils/lockRules';
import { biometricLabel, cannotCheck, countsAsFailure } from './utils/biometrics';
import { navigation_ref, navigateWhenReady } from '../../services/navigationRef';
import { whileSystemDialog, resetSystemDialogs } from '../../services/appLock';

// the app lock with a fake phone: Face ID answers how each test says, and AppState changes are played in by hand

const mock_auth = { user: null, status: 'restoring', logout: jest.fn() };
jest.mock('../auth/context/AuthContext', () => ({
  useAuth: () => mock_auth,
}));
const mock_mode = { demo_mode: false };
jest.mock('../../context/WorkOrdersContext', () => ({
  useWorkOrders: () => mock_mode,
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const { createContext } = require('react');
  return { useSafeAreaInsets: () => insets, SafeAreaInsetsContext: createContext(insets) };
});

const owner = { id: 'owner-1', role: 'owner', name: 'Olivia Owner' };
let app_state_listener = null;
let now = 1_000_000;

async function settle() {
  for (let index = 0; index < 3; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function app() {
  return (
    <AppLockProvider>
      <Text>The signed-in app</Text>
      <SecurityCard />
    </AppLockProvider>
  );
}

// the app goes to the background and comes back some seconds later
async function awayFor(seconds) {
  act(() => app_state_listener('background'));
  now += seconds * 1000;
  act(() => app_state_listener('active'));
  await settle();
}

const lock_line = 'Locked to keep your rentals private.';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  resetSystemDialogs();
  mock_auth.user = owner;
  mock_auth.status = 'signed_in';
  mock_mode.demo_mode = false;
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
    app_state_listener = listener;
    return { remove: jest.fn() };
  });
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
  LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
});

afterEach(() => {
  Date.now.mockRestore();
  AppState.addEventListener.mockRestore();
});

describe('the Security switch', () => {
  test('it checks with the phone before turning on, and stays on after a restart', async () => {
    const first = render(app());
    await settle();
    const toggle = screen.getByLabelText(/^Unlock with/);
    expect(toggle.props.value).toBe(false);
    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });
    await settle();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(biometric_unlock_key)).toBe('on');
    first.unmount();

    render(app());
    await settle();
    expect(screen.getByLabelText(/^Unlock with/).props.value).toBe(true);
  });

  test('a failed check leaves it off', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    render(app());
    await settle();
    await act(async () => {
      fireEvent(screen.getByLabelText(/^Unlock with/), 'valueChange', true);
    });
    await settle();
    expect(await AsyncStorage.getItem(biometric_unlock_key)).toBeNull();
  });

  test('the label says what this phone has', async () => {
    render(app());
    await settle();
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();
  });

  test('no hardware or nothing enrolled hides the switch and says why', async () => {
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(false);
    render(app());
    await settle();
    expect(screen.queryByLabelText(/^Unlock with/)).toBeNull();
    expect(screen.getByText(/doesn't have Face ID or Touch ID set up/)).toBeTruthy();
  });
});

describe('when the app locks', () => {
  test('a cold start that restores the session locks before the app shows, and unlocking reveals it', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    // the first answer is a cancel, so the lock screen stays up for a look
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    mock_auth.status = 'restoring';
    const view = render(app());
    mock_auth.status = 'signed_in';
    view.rerender(app());
    await settle();
    expect(screen.getByText(lock_line)).toBeTruthy();
    // it asked once on its own
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    // the app under it is hidden from screen readers
    expect(screen.queryByText('The signed-in app')).toBeNull();

    fireEvent.press(screen.getByText('Unlock with Face ID'));
    await settle();
    expect(screen.queryByText(lock_line)).toBeNull();
    expect(screen.getByText('The signed-in app')).toBeTruthy();
  });

  test('a fresh login with a password does not lock', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    mock_auth.status = 'signed_out';
    mock_auth.user = null;
    const view = render(app());
    await settle();
    mock_auth.status = 'signed_in';
    mock_auth.user = owner;
    view.rerender(app());
    await settle();
    expect(screen.queryByText(lock_line)).toBeNull();
  });

  test('61 seconds in the background locks, 30 seconds does not', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    LocalAuthentication.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    render(app());
    await settle();
    await awayFor(30);
    expect(screen.queryByText(lock_line)).toBeNull();
    await awayFor(61);
    expect(screen.getByText(lock_line)).toBeTruthy();
  });

  test('a long trip to the photo picker or a permission prompt never locks', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    render(app());
    await settle();
    let finish;
    const picker = whileSystemDialog(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await awayFor(120);
    expect(screen.queryByText(lock_line)).toBeNull();
    finish();
    await picker;
  });

  test('a push tap while locked waits, then opens after unlock', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    jest.spyOn(navigation_ref, 'isReady').mockReturnValue(true);
    const navigate = jest.spyOn(navigation_ref, 'navigate').mockImplementation(() => {});
    render(app());
    await settle();
    await awayFor(61);
    expect(screen.getByText(lock_line)).toBeTruthy();

    navigateWhenReady('WorkOrderDetail', { workOrderId: 'wo-7' });
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Unlock with Face ID'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('WorkOrderDetail', { workOrderId: 'wo-7' });
    navigation_ref.isReady.mockRestore();
    navigate.mockRestore();
  });

  test('the demo and signed out are never locked', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    mock_auth.user = null;
    mock_auth.status = 'restoring';
    mock_mode.demo_mode = true;
    const view = render(app());
    mock_auth.status = 'signed_out';
    view.rerender(app());
    await settle();
    expect(screen.queryByText(lock_line)).toBeNull();
    await awayFor(300);
    expect(screen.queryByText(lock_line)).toBeNull();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('never locked out', () => {
  test('three failed tries offer Log Out up front, and it logs out', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    LocalAuthentication.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'authentication_failed',
    });
    render(app());
    await settle();
    await awayFor(61);
    // the automatic ask was the first failure
    fireEvent.press(screen.getByText('Unlock with Face ID'));
    await settle();
    expect(screen.queryByText(/didn't work a few times/)).toBeNull();
    fireEvent.press(screen.getByText('Unlock with Face ID'));
    await settle();
    expect(screen.getByText(/didn't work a few times/)).toBeTruthy();
    fireEvent.press(screen.getByText('Log Out'));
    await settle();
    expect(mock_auth.logout).toHaveBeenCalled();
  });

  test('a phone that can no longer check anyone unlocks instead of trapping them', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    LocalAuthentication.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'passcode_not_set',
    });
    render(app());
    await settle();
    await awayFor(61);
    expect(screen.queryByText(lock_line)).toBeNull();
  });

  test('Use Passcode goes through the phone with the passcode fallback left on', async () => {
    await AsyncStorage.setItem(biometric_unlock_key, 'on');
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    render(app());
    await settle();
    await awayFor(61);
    fireEvent.press(screen.getByText('Use Passcode'));
    await settle();
    const options = LocalAuthentication.authenticateAsync.mock.calls[1][0];
    expect(options.disableDeviceFallback).toBe(false);
    expect(screen.queryByText(lock_line)).toBeNull();
  });
});

describe('the pure rules', () => {
  test('only a signed-in account with the switch on can lock', () => {
    expect(canLock({ enabled: true, user: owner, demo_mode: false })).toBe(true);
    expect(canLock({ enabled: true, user: owner, demo_mode: true })).toBe(false);
    expect(canLock({ enabled: true, user: null, demo_mode: false })).toBe(false);
    expect(canLock({ enabled: false, user: owner, demo_mode: false })).toBe(false);
  });

  test('a minute is the line, and a dialog trip never counts', () => {
    expect(shouldLockOnReturn(0, lock_after_ms + 1, false)).toBe(true);
    expect(shouldLockOnReturn(0, lock_after_ms, false)).toBe(false);
    expect(shouldLockOnReturn(0, lock_after_ms * 5, true)).toBe(false);
    expect(shouldLockOnReturn(null, lock_after_ms * 5, false)).toBe(false);
  });

  test('labels match the phone', () => {
    expect(biometricLabel([2], 'ios')).toBe('Face ID');
    expect(biometricLabel([1], 'ios')).toBe('Touch ID');
    expect(biometricLabel([], 'ios')).toBe('Face ID or Touch ID');
    expect(biometricLabel([1], 'android')).toBe('fingerprint');
    expect(biometricLabel([1, 2], 'android')).toBe('fingerprint or face unlock');
  });

  test('which answers count as failures and which mean the phone cannot check', () => {
    expect(countsAsFailure('authentication_failed')).toBe(true);
    expect(countsAsFailure('user_cancel')).toBe(false);
    expect(cannotCheck('passcode_not_set')).toBe(true);
    expect(cannotCheck('user_cancel')).toBe(false);
  });
});

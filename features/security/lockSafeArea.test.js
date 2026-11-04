import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLockProvider, biometric_unlock_key } from './context/AppLockContext';

// the lock screen sits outside the navigator, so it has to bring its own safe area
// this one uses the real safe area library (no mock), the web QA found the crash this guards against

const mock_auth = {
  user: { id: 'owner-1', role: 'owner' },
  status: 'restoring',
  logout: jest.fn(),
};
jest.mock('../auth/context/AuthContext', () => ({ useAuth: () => mock_auth }));
jest.mock('../../context/WorkOrdersContext', () => ({
  useWorkOrders: () => ({ demo_mode: false }),
}));
// the real library, only with the phone's starting size filled in like a device has it
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  },
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([2])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: false, error: 'user_cancel' })),
}));

test('a cold start lock draws with no safe area provider above it', async () => {
  await AsyncStorage.setItem(biometric_unlock_key, 'on');
  const view = render(
    <AppLockProvider>
      <Text>The signed-in app</Text>
    </AppLockProvider>,
  );
  mock_auth.status = 'signed_in';
  view.rerender(
    <AppLockProvider>
      <Text>The signed-in app</Text>
    </AppLockProvider>,
  );
  for (let index = 0; index < 3; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  expect(screen.getByText('Locked to keep your rentals private.')).toBeTruthy();
});

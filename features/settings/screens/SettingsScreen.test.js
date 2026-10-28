import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from './SettingsScreen';

// Settings reads the account and the demo from these, the tests set them instead of signing in
const mock_state = { user: null, demo_mode: true, demo_role: 'owner' };
jest.mock('../../auth/context/AuthContext', () => ({
  useAuth: () => ({ user: mock_state.user, logout: jest.fn() }),
}));
jest.mock('../../../context/WorkOrdersContext', () => ({
  useWorkOrders: () => ({
    demo_mode: mock_state.demo_mode,
    demo_role: mock_state.demo_role,
    mileage_rate: 0.7,
    exitDemo: jest.fn(),
    switchDemoRole: jest.fn(),
  }),
}));
// the Security card reads the app lock, its own tests are in features/security
jest.mock('../../security/context/AppLockContext', () => ({
  useAppLock: () => ({ enabled: false, loaded: true, setEnabled: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const { createContext } = require('react');
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaInsetsContext: createContext(insets),
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Take the tour in Settings', () => {
  test('the demo has the row, and it opens the tour for the side that is showing', async () => {
    mock_state.user = null;
    mock_state.demo_mode = true;
    mock_state.demo_role = 'tenant';
    render(<SettingsScreen navigation={{ navigate: jest.fn() }} />);
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: /^Take the tour/ }));
    expect(screen.getByText('Try the tenant side')).toBeTruthy();
  });

  test('a signed-in account has no tour row', async () => {
    mock_state.user = { id: 'owner-1', role: 'owner', name: 'Olivia', email: 'o@example.com' };
    mock_state.demo_mode = false;
    render(<SettingsScreen navigation={{ navigate: jest.fn() }} />);
    await act(async () => {});
    expect(screen.queryByText('Take the tour')).toBeNull();
  });
});

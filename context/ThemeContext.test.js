import { useEffect } from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme, resolveScheme, appearance_key } from './ThemeContext';
import { COLORS, LIGHT_COLORS, DARK_COLORS, setActiveScheme } from '../theme';

// the phone's own setting, changed by the tests to check System follows it live
const mock_system = { scheme: 'light' };
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mock_system.scheme,
}));

const peek = { theme: null };
function Peek() {
  const theme = useTheme();
  useEffect(() => {
    peek.theme = theme;
  });
  // reading COLORS while drawing has to give the active palette
  return <Text testID="page">{COLORS.background}</Text>;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mock_system.scheme = 'light';
  setActiveScheme('light');
});

afterAll(() => setActiveScheme('light'));

describe('resolveScheme', () => {
  test('System follows the phone, Light and Dark win, anything else is System', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('purple', 'dark')).toBe('dark');
  });
});

describe('the theme provider', () => {
  test('nothing saved means System, and it follows the phone live', async () => {
    const view = render(
      <ThemeProvider>
        <Peek />
      </ThemeProvider>,
    );
    await settle();
    expect(peek.theme).toMatchObject({ ready: true, preference: 'system', scheme: 'light' });
    expect(view.getByTestId('page').props.children).toBe(LIGHT_COLORS.background);
    mock_system.scheme = 'dark';
    view.rerender(
      <ThemeProvider>
        <Peek />
      </ThemeProvider>,
    );
    await settle();
    expect(peek.theme.scheme).toBe('dark');
    expect(view.getByTestId('page').props.children).toBe(DARK_COLORS.background);
  });

  test('a saved choice is read before anything is ready, and a new one is saved on the phone', async () => {
    await AsyncStorage.setItem(appearance_key, 'dark');
    render(
      <ThemeProvider>
        <Peek />
      </ThemeProvider>,
    );
    await settle();
    expect(peek.theme).toMatchObject({ preference: 'dark', scheme: 'dark', is_dark: true });
    expect(peek.theme.colors.background).toBe(DARK_COLORS.background);
    await act(async () => {
      peek.theme.setPreference('light');
    });
    await settle();
    expect(peek.theme.scheme).toBe('light');
    expect(await AsyncStorage.getItem(appearance_key)).toBe('light');
    expect(COLORS.text).toBe(LIGHT_COLORS.text);
  });

  test('a broken saved value falls back to System', async () => {
    await AsyncStorage.setItem(appearance_key, 'neon');
    mock_system.scheme = 'dark';
    render(
      <ThemeProvider>
        <Peek />
      </ThemeProvider>,
    );
    await settle();
    expect(peek.theme).toMatchObject({ preference: 'system', scheme: 'dark' });
  });
});

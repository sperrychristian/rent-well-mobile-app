import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../../../App';
import { navigation_ref } from '../../../util/navigationRef';
import { quick_stack_scale } from './ExpensesScreen';

// the Expenses quick actions at 360 wide: "Tax Summary" never splits inside a word,
// at the normal size it gets the room it needs, and with big text the buttons stack one per row

const mock_window = { width: 360, height: 640, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mock_window,
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

jest.setTimeout(30000);

async function settle() {
  for (let index = 0; index < 4; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function openExpenses() {
  forgetNavigationState();
  render(<App />);
  await settle();
  fireEvent.press(await screen.findByText('Try the Demo'));
  await settle();
  fireEvent.press(screen.getByLabelText('Demo as Landlord'));
  await settle();
  act(() => navigation_ref.navigate('Expenses'));
  await settle();
}

// the button around a label, and the row around that button
function buttonFor(title) {
  return screen.getByRole('button', { name: title });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('at the normal size the label keeps the whole button width minus a small padding', async () => {
  mock_window.fontScale = 1;
  await openExpenses();
  const label = screen.getByText('Tax Summary');
  // one text node, free to wrap at its space, never cut to a fixed number of lines
  expect(label.props.children).toBe('Tax Summary');
  expect(label.props.numberOfLines).toBeUndefined();
  const button = StyleSheet.flatten(buttonFor('Tax Summary').props.style);
  expect(button.paddingHorizontal).toBeLessThan(10);
  expect(button.flex).toBe(1);
});

test('at the largest font scale the quick actions stack so no single word has to split', async () => {
  mock_window.fontScale = 3.1;
  expect(mock_window.fontScale).toBeGreaterThanOrEqual(quick_stack_scale);
  await openExpenses();
  const label = screen.getByText('Tax Summary');
  expect(label.props.numberOfLines).toBeUndefined();
  // the label is not shrunk to fit, font scaling stays on
  expect(label.props.allowFontScaling).not.toBe(false);
  const button = StyleSheet.flatten(buttonFor('Tax Summary').props.style);
  expect(button.flex).toBe(0);
  expect(button.flexBasis).toBe('auto');
  // the row is the nearest view above the button that lays its children out
  let node = buttonFor('Tax Summary').parent;
  const isRow = (style) => style && style.flexDirection && style.borderRadius === undefined;
  while (
    node &&
    !(typeof node.props.style !== 'function' && isRow(StyleSheet.flatten(node.props.style)))
  ) {
    node = node.parent;
  }
  expect(StyleSheet.flatten(node.props.style).flexDirection).toBe('column');
});

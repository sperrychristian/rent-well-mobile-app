import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../../../App';
import { navigation_ref } from '../../../util/navigationRef';
import { buildYearEndCsv, buildExpensesCsv } from './exportExpenses';
import { buildYearEndData } from './expenseStats';
import { seed_expenses } from '../../../data/expenses';
import { seed_trips } from '../../../data/expenseExtras';
import { seededFirebase, uninstallFakeFirebase } from '../../../scripts/testing/fakeFirebase';

// receipt photos are off for a Firebase landlord until Storage, so the Year-End Report, its CSV, and the
// expenses CSV leave out every receipt line for them, the demo keeps them, and the money is the same in both

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

const receipt_words = /receipt/i;

// the test setup draws each icon as its name (like receipt-outline), which nobody reads, so those are skipped
function receiptText() {
  return screen
    .queryAllByText(receipt_words)
    .filter((node) => !/-outline$/.test(String(node.props.children)));
}

describe('the CSV exports', () => {
  const data = buildYearEndData('2026', seed_expenses, seed_trips, 0.7);

  test('the year-end CSV has the receipt line in the demo and drops only that line for Firebase', () => {
    const demo = buildYearEndCsv('2026', data, 0.7);
    const firebase = buildYearEndCsv('2026', data, 0.7, { show_receipts: false });
    expect(demo).toMatch(receipt_words);
    expect(firebase).not.toMatch(receipt_words);
    const without_receipt_line = demo
      .split('\n')
      .filter((line) => !receipt_words.test(line))
      .join('\n');
    expect(firebase).toBe(without_receipt_line);
  });

  test('the expenses CSV drops the Receipts column for Firebase and keeps every total', () => {
    const demo = buildExpensesCsv(seed_expenses, {});
    const firebase = buildExpensesCsv(seed_expenses, {}, { show_receipts: false });
    expect(demo.split('\n')[0]).toContain('Receipts');
    expect(firebase).not.toMatch(receipt_words);
    const totals = (csv) => csv.slice(csv.indexOf('Deductible totals by category'));
    expect(totals(firebase)).toBe(totals(demo));
    expect(firebase.split('\n').length).toBe(demo.split('\n').length);
  });
});

async function settle(rounds) {
  for (let index = 0; index < (rounds || 6); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// the totals that don't depend on how a mode names its properties: the year's deductible total (first)
// and the vendor totals (last), the per property rows group by "Unit 1" in the demo and by property in Firebase
function moneyOnScreen() {
  const amounts = screen.getAllByText(/^\$[\d,]+\.\d\d$/).map((node) => node.props.children);
  return [amounts[0], ...amounts.slice(-4)].join(' ');
}

describe('the Year-End Report screen', () => {
  let demo_money = '';

  beforeEach(async () => {
    await AsyncStorage.clear();
    forgetNavigationState();
  });

  afterEach(() => uninstallFakeFirebase());

  test('the demo shows the Receipts card and the No receipt tags', async () => {
    render(<App />);
    await settle();
    fireEvent.press(await screen.findByText('Try the Demo'));
    await settle();
    fireEvent.press(screen.getByLabelText('Demo as Landlord'));
    await settle();
    act(() => navigation_ref.navigate('YearEndReport', { yearId: '2026' }));
    await settle();
    expect(screen.getByText('Receipts')).toBeTruthy();
    expect(screen.getByText(/have a receipt attached/)).toBeTruthy();
    demo_money = moneyOnScreen();
    act(() => navigation_ref.navigate('Expenses'));
    await settle();
    expect(screen.getAllByText('No receipt').length).toBeGreaterThan(0);
  });

  test('a Firebase landlord sees no receipt wording, and the totals match the demo', async () => {
    const firebase = seededFirebase();
    await AsyncStorage.setItem(
      'rent_well_test_account',
      JSON.stringify(firebase.database.dump().users['owner-taylor']),
    );
    render(<App />);
    await settle(10);
    act(() => navigation_ref.navigate('YearEndReport', { yearId: '2026' }));
    await settle();
    expect(screen.queryByText('Receipts')).toBeNull();
    expect(receiptText()).toHaveLength(0);
    expect(moneyOnScreen()).toBe(demo_money);
    act(() => navigation_ref.navigate('Expenses'));
    await settle();
    expect(screen.queryAllByText('No receipt')).toHaveLength(0);
    expect(receiptText()).toHaveLength(0);
  });
});

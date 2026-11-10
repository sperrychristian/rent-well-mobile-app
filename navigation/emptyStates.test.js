import { screen } from '@testing-library/react-native';
import { settle, openDemo, openAs, go, search, press } from './emptyStatesHarness';
import {
  installFakeFirebase,
  seededFirebase,
  uninstallFakeFirebase,
} from '../scripts/testing/fakeFirebase';
import { buildSeedData } from '../scripts/seedData';

// the list empty states on the real App: nothing saved at all says "yet" with the add action, a search or
// filter with no hits says "match" with Clear Filters, and Clear Filters brings the whole list back
// (the demo's "yet" cases are in emptyStatesDemo.test.js, which empties the demo's sample data)

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

jest.setTimeout(40000);

const expense_search = 'Search notes, vendor, category, or property';
const order_search = 'Search by issue, tenant, or property';

afterEach(() => uninstallFakeFirebase());

describe('Firebase: a brand-new landlord sees the "yet" messages', () => {
  test.each([
    ['Expenses', 'No expenses yet', 'Add Expense'],
    ['WorkOrders', 'No work orders yet', 'Add a Work Order'],
    ['Mileage', 'No trips yet', 'Add Trip'],
    ['Checklist', 'No checklists yet', 'New Checklist'],
  ])('%s', async (route_name, title, action) => {
    const firebase = seededFirebase();
    await openAs(firebase, 'owner-jamie');
    await go(route_name);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByText(action).length).toBeGreaterThan(0);
    expect(screen.queryByText('Clear Filters')).toBeNull();
  });
});

describe('Firebase: a filter with no hits says "match", and Clear Filters restores the list', () => {
  test('Expenses', async () => {
    const firebase = seededFirebase();
    await openAs(firebase, 'owner-taylor');
    await go('Expenses');
    search(expense_search, 'nothing like this');
    expect(screen.getByText('No expenses match')).toBeTruthy();
    await press(screen.getByText('Clear Filters'));
    expect(screen.queryByText('No expenses match')).toBeNull();
    expect(screen.getAllByText(/State Farm/).length).toBeGreaterThan(0);
  });

  test('Work Orders', async () => {
    const firebase = seededFirebase();
    await openAs(firebase, 'owner-taylor');
    await go('WorkOrders');
    search(order_search, 'nothing like this');
    expect(screen.getByText('No work orders match')).toBeTruthy();
    await press(screen.getByText('Clear Filters'));
    expect(screen.getByText('Water heater not working')).toBeTruthy();
  });

  test('Mileage (every trip is from an older year, this year has none)', async () => {
    const tree = buildSeedData(new Date());
    Object.values(tree.mileage).forEach((trip) => {
      trip.date = '2024' + trip.date.slice(4);
    });
    const firebase = installFakeFirebase(tree);
    await openAs(firebase, 'owner-taylor');
    await go('Mileage');
    expect(screen.getByText('No trips match')).toBeTruthy();
    await press(screen.getByText('Clear Filters'));
    expect(screen.getByText('Showed the unit to a prospective tenant')).toBeTruthy();
  });

  test('Checklists (no signed checklist, then the Complete filter)', async () => {
    const tree = buildSeedData(new Date());
    Object.keys(tree.checklists)
      .filter((id) => tree.checklists[id].completed)
      .forEach((id) => delete tree.checklists[id]);
    const firebase = installFakeFirebase(tree);
    await openAs(firebase, 'owner-taylor');
    await go('Checklist');
    await press(screen.getByText('Complete'));
    expect(screen.getByText('No checklists match')).toBeTruthy();
    await press(screen.getByText('Clear Filters'));
    expect(screen.getAllByLabelText(/Move-Out checklist/).length).toBe(1);
  });
});

describe('the demo: a filter with no hits says "match", and Clear Filters restores the list', () => {
  test('Expenses', async () => {
    await openDemo();
    await go('Expenses');
    search(expense_search, 'nothing like this');
    expect(screen.getByText('No expenses match')).toBeTruthy();
    expect(screen.queryByText('No expenses yet')).toBeNull();
    await press(screen.getByText('Clear Filters'));
    expect(screen.getAllByText(/State Farm/).length).toBeGreaterThan(0);
  });

  test('Work Orders', async () => {
    await openDemo();
    await go('WorkOrders');
    search(order_search, 'nothing like this');
    expect(screen.getByText('No work orders match')).toBeTruthy();
    await press(screen.getByText('Clear Filters'));
    await settle();
    expect(screen.getByText('Water heater not working')).toBeTruthy();
  });
});

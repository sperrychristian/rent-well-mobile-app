import { screen } from '@testing-library/react-native';
import { openDemo, go, press } from './emptyStatesHarness';

// the demo's own empty states: the sample lists are swapped out here (empty for the "yet" cases, and a year
// or a status with nothing in it for the "match" cases), everything else about the demo stays the same

// each sample list is one shared array, filled in place per test, so every file that imported it sees the change
jest.mock('../data/expenses', () => ({ seed_expenses: [] }));
jest.mock('../data/expenseExtras', () => ({
  ...jest.requireActual('../data/expenseExtras'),
  seed_trips: [],
}));
jest.mock('../features/checklist/data/sampleChecklists', () => ({ sample_checklists: [] }));
// the work orders are read once when the app loads, so the demo starts with none in this file
jest.mock('../data/workOrders', () => ({ work_orders: [] }));
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

const demo_trips = require('../data/expenseExtras').seed_trips;
const demo_checklists = require('../features/checklist/data/sampleChecklists').sample_checklists;

function fill(list, items) {
  list.splice(0, list.length, ...items);
}

beforeEach(() => {
  fill(demo_trips, []);
  fill(demo_checklists, []);
});

test.each([
  ['Expenses', 'No expenses yet', 'Add Expense'],
  ['WorkOrders', 'No work orders yet', 'Add a Work Order'],
  ['Mileage', 'No trips yet', 'Add Trip'],
  ['Checklist', 'No checklists yet', 'New Checklist'],
])('an empty demo %s says the "yet" message', async (route_name, title, action) => {
  await openDemo();
  await go(route_name);
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getAllByText(action).length).toBeGreaterThan(0);
  expect(screen.queryByText('Clear Filters')).toBeNull();
});

test('Mileage: a year with no trips says "match", and Clear Filters goes to the year that has them', async () => {
  fill(demo_trips, [
    {
      id: 't1',
      date: '2024-05-02',
      property: '48 Cedar Ave',
      miles: 12,
      purpose: 'Spring walkthrough',
    },
  ]);
  await openDemo();
  await go('Mileage');
  expect(screen.getByText('No trips match')).toBeTruthy();
  await press(screen.getByText('Clear Filters'));
  expect(screen.getByText('Spring walkthrough')).toBeTruthy();
});

test('Checklists: a status with none says "match", and Clear Filters shows them all', async () => {
  const actual = jest.requireActual(
    '../features/checklist/data/sampleChecklists',
  ).sample_checklists;
  fill(
    demo_checklists,
    actual.filter((checklist) => !checklist.completed),
  );
  await openDemo();
  await go('Checklist');
  await press(screen.getByText('Complete'));
  expect(screen.getByText('No checklists match')).toBeTruthy();
  await press(screen.getByText('Clear Filters'));
  expect(screen.getAllByLabelText(/Move-Out checklist/).length).toBe(1);
});

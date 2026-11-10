import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  importExpenses,
} from './expenses';
import { setSessionUser } from './session';
import { fromApiExpense, toApiExpense } from '../../features/expenses/utils/expenseApi';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

const taylor = { id: 'owner-taylor', role: 'owner', name: 'Taylor Brooks' };

beforeEach(() => setSessionUser(taylor));
afterEach(() => {
  uninstallFakeFirebase();
  setSessionUser(null);
});

function body(fields, property_id) {
  return toApiExpense(
    { category: 'Repairs', vendor: '', notes: '', date: '2026-10-10', ...fields },
    property_id === undefined ? 'prop-maple' : property_id,
    null,
  );
}

test('the seeded expenses come back newest first in the app shape', async () => {
  seededFirebase();
  const page = await getExpenses();
  expect(page.nextCursor).toBeNull();
  expect(page.expenses).toHaveLength(8);
  const first = fromApiExpense(page.expenses[0]);
  expect(first.amount).toBeGreaterThan(0);
  expect(page.expenses[0].spentOn >= page.expenses[7].spentOn).toBe(true);
});

test('create, update, and delete an expense, cents stay whole numbers', async () => {
  const firebase = seededFirebase();
  const created = await createExpense(body({ amount: 19.99, vendor: 'Hardware Hut' }));
  expect(created.amountCents).toBe(1999);
  expect(fromApiExpense(created).property).toBe('123 Maple St');
  const updated = await updateExpense(created.id, body({ amount: 25, vendor: '' }, null));
  expect(updated.amountCents).toBe(2500);
  expect(firebase.database.dump().expenses[created.id].vendor).toBeUndefined();
  expect(firebase.database.dump().expenses[created.id].propertyId).toBeUndefined();
  await deleteExpense(created.id);
  expect(firebase.database.dump().expenses[created.id]).toBeUndefined();
});

test('a bad amount or date is turned away before anything is saved', async () => {
  const firebase = seededFirebase();
  const writes = () => firebase.fetch.calls.filter((call) => call.method !== 'GET').length;
  await expect(createExpense(body({ amount: 0 }))).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  await expect(createExpense(body({ amount: 5, date: '1999-01-01' }))).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  expect(writes()).toBe(0);
});

test('the import gives a result per row in one write, and a retry never doubles up', async () => {
  const firebase = seededFirebase();
  const items = [
    { clientId: 'phone-1', ...body({ amount: 10 }) },
    { clientId: 'phone-2', ...body({ amount: 0 }) },
    { clientId: 'phone-1', ...body({ amount: 10 }) },
  ];
  const first = await importExpenses(items);
  expect(first.results.map((row) => row.status)).toEqual(['created', 'failed', 'failed']);
  const second = await importExpenses([items[0]]);
  expect(second.results[0].status).toBe('existing');
  const with_client = Object.values(firebase.database.dump().expenses).filter(
    (expense) => expense.clientId === 'phone-1',
  );
  expect(with_client).toHaveLength(1);
});

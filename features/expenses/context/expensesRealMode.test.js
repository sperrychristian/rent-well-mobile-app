import { useEffect } from 'react';
import { Alert } from 'react-native';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkOrdersProvider, useWorkOrders } from '../../../context/WorkOrdersContext';
import { ExpensesProvider, useExpenses } from './ExpensesContext';
import * as api from '../../../services/api';

// a real landlord, with the server's expense routes mocked the way docs/API.md says they answer

const mock_user = { id: 'owner-1', role: 'owner', name: 'Olivia Owner' };
jest.mock('../../auth/context/AuthContext', () => ({
  useAuth: () => ({ user: mock_user }),
}));
jest.mock('../../tenants/context/TenantsContext', () => ({
  useTenants: () => ({ properties: [{ id: 'p-maple', name: 'Maple Court' }] }),
}));
jest.mock('../../../services/socket', () => ({ onSocketEvent: () => () => {} }));
jest.mock('../../../services/api', () => ({
  getExpenses: jest.fn(),
  createExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
  importExpenses: jest.fn(),
  uploadImage: jest.fn(),
}));

const server_expense = (id, amount_cents, extra) => ({
  id: id,
  propertyId: 'p-maple',
  property: { id: 'p-maple', name: 'Maple Court' },
  category: 'repairs',
  vendor: null,
  description: 'Expense ' + id,
  amountCents: amount_cents,
  spentOn: '2026-10-01',
  paymentMethod: null,
  taxDeductible: true,
  receiptKey: null,
  workOrderId: null,
  notes: null,
  clientId: null,
  ...(extra || {}),
});

// a peek at both hooks from inside the providers, filled in an effect so the render stays pure
const peek = { expenses: null, all: null };
function Peek() {
  const expenses = useExpenses();
  const all = useWorkOrders();
  useEffect(() => {
    peek.expenses = expenses;
    peek.all = all;
  });
  return null;
}

async function settle() {
  for (let index = 0; index < 4; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderReal() {
  render(
    <WorkOrdersProvider user_id={mock_user.id}>
      <ExpensesProvider>
        <Peek />
      </ExpensesProvider>
    </WorkOrdersProvider>,
  );
  await settle();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.getExpenses
    .mockResolvedValueOnce({ expenses: [server_expense('e1', 18000)], nextCursor: 'e1' })
    .mockResolvedValueOnce({ expenses: [server_expense('e2', 2500)], nextCursor: null });
});

describe('expenses for a real landlord', () => {
  test('every page loads, the app shape comes back through useWorkOrders, and a copy is saved', async () => {
    await renderReal();
    expect(api.getExpenses).toHaveBeenCalledTimes(2);
    expect(api.getExpenses.mock.calls[1][0]).toMatchObject({ cursor: 'e1' });
    expect(peek.all.expenses.map((expense) => expense.id)).toEqual(['e1', 'e2']);
    expect(peek.all.expenses[0]).toMatchObject({ amount: 180, property: 'Maple Court' });
    expect(peek.expenses.is_remote).toBe(true);
    expect(peek.expenses.categories).toHaveLength(10);
    const saved = JSON.parse(await AsyncStorage.getItem('rent_well_expenses_cache_owner-1'));
    expect(saved).toHaveLength(2);
  });

  test('offline, the saved copy shows with a notice', async () => {
    await AsyncStorage.setItem(
      'rent_well_expenses_cache_owner-1',
      JSON.stringify([{ id: 'cached', amount: 5, date: '2026-01-01', receipts: [] }]),
    );
    api.getExpenses.mockReset();
    api.getExpenses.mockRejectedValue(
      Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }),
    );
    await renderReal();
    expect(peek.expenses.from_cache).toBe(true);
    expect(peek.all.expenses.map((expense) => expense.id)).toEqual(['cached']);
  });

  test('adding shows right away, then the server copy replaces it, and a work order link goes along', async () => {
    await renderReal();
    api.createExpense.mockResolvedValue(server_expense('e3', 4500, { workOrderId: 'wo-9' }));
    await act(async () => {
      await peek.all.addExpense('wo-9', {
        amount: 45,
        category: 'Repairs',
        date: '2026-10-05',
        property: 'Maple Court, Unit 2B',
        notes: 'Faucet part',
        receipts: [],
      });
    });
    expect(api.createExpense.mock.calls[0][0]).toMatchObject({
      propertyId: 'p-maple',
      amountCents: 4500,
      workOrderId: 'wo-9',
      description: 'Faucet part',
    });
    expect(peek.all.expenses[0].id).toBe('e3');
    expect(peek.all.orders.length).toBeGreaterThan(0);
  });

  test('a failed save goes back to how it was and says why, an unknown property never sends', async () => {
    await renderReal();
    api.createExpense.mockRejectedValue(new Error("Can't reach the server."));
    await act(async () => {
      await peek.all.addExpense(null, {
        amount: 1,
        category: 'Other',
        date: '2026-10-05',
        receipts: [],
      });
    });
    expect(peek.all.expenses.map((expense) => expense.id)).toEqual(['e1', 'e2']);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Couldn't save the expense",
      "Can't reach the server.",
    );
    await act(async () => {
      await peek.all.addExpense(null, {
        amount: 1,
        date: '2026-10-05',
        property: 'Nowhere',
        receipts: [],
      });
    });
    expect(api.createExpense).toHaveBeenCalledTimes(1);
  });

  test('delete removes it, and a failed delete puts it back', async () => {
    await renderReal();
    api.deleteExpense.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('nope'));
    await act(async () => {
      await peek.all.deleteExpense('e1');
    });
    expect(peek.all.expenses.map((expense) => expense.id)).toEqual(['e2']);
    await act(async () => {
      await peek.all.deleteExpense('e2');
    });
    expect(peek.all.expenses.map((expense) => expense.id)).toEqual(['e2']);
  });
});

describe('importing the old phone expenses', () => {
  const phone = [
    {
      id: 'seed-1',
      amount: 1240,
      category: 'Insurance',
      date: '2026-01-15',
      property: '',
      receipts: [],
    },
    {
      id: 'local-a',
      amount: 23.99,
      category: 'Supplies',
      date: '2025-08-14',
      property: 'Maple Court',
      receipts: [],
    },
    {
      id: 'local-b',
      amount: 10,
      category: 'Repairs',
      date: '2099-01-01',
      property: '',
      receipts: [],
    },
  ];

  test('only what the server has is cleared, a failure stays for a retry that never doubles', async () => {
    await AsyncStorage.setItem('rent_well_expenses_owner-1', JSON.stringify(phone));
    await renderReal();
    expect(peek.expenses.legacy_count).toBe(2);
    api.getExpenses.mockResolvedValue({ expenses: [], nextCursor: null });
    api.importExpenses.mockResolvedValueOnce({
      results: [
        { index: 0, clientId: 'local-a', status: 'created', id: 's-a', error: null },
        {
          index: 1,
          clientId: 'local-b',
          status: 'failed',
          id: null,
          error: { code: 'INVALID_SPENT_ON', message: "spentOn can't be in the future" },
        },
      ],
      createdCount: 1,
      existingCount: 0,
      failedCount: 1,
    });
    let result;
    await act(async () => {
      result = await peek.expenses.importLegacy();
    });
    await settle();
    expect(api.importExpenses.mock.calls[0][0].map((item) => item.clientId)).toEqual([
      'local-a',
      'local-b',
    ]);
    expect(result).toMatchObject({ imported: 1, failed: 1 });
    expect(peek.expenses.legacy_count).toBe(1);
    const left = JSON.parse(await AsyncStorage.getItem('rent_well_expenses_owner-1'));
    expect(left.map((expense) => expense.id)).toEqual(['seed-1', 'local-b']);

    // the retry sends just the one left, and the server answering existing for it clears it too
    api.importExpenses.mockResolvedValueOnce({
      results: [{ index: 0, clientId: 'local-b', status: 'existing', id: 's-b', error: null }],
      createdCount: 0,
      existingCount: 1,
      failedCount: 0,
    });
    await act(async () => {
      result = await peek.expenses.importLegacy();
    });
    await settle();
    expect(api.importExpenses.mock.calls[1][0].map((item) => item.clientId)).toEqual(['local-b']);
    expect(peek.expenses.legacy_count).toBe(0);
  });

  test('a whole import that fails clears nothing', async () => {
    await AsyncStorage.setItem('rent_well_expenses_owner-1', JSON.stringify(phone));
    await renderReal();
    api.importExpenses.mockRejectedValueOnce(new Error("Can't reach the server."));
    await act(async () => {
      await peek.expenses.importLegacy();
    });
    await settle();
    expect(peek.expenses.legacy_count).toBe(2);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Couldn't upload the expenses",
      "Can't reach the server.",
    );
  });
});

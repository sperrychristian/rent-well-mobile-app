import { useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemoteExpensesContext } from './remoteExpensesContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders, useLocalWorkOrders } from '../../../context/WorkOrdersContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import {
  getExpenses,
  createExpense,
  updateExpense as updateExpenseRequest,
  deleteExpense as deleteExpenseRequest,
  importExpenses,
  uploadImage,
} from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import { legacyExpensesFor } from '../../workOrders/utils/workOrderHelpers';
import {
  fromApiExpense,
  toApiExpense,
  toImportItem,
  findPropertyId,
  legacyExpenses,
  inBatches,
  isReceiptKey,
  server_categories,
  server_payment_methods,
} from '../utils/expenseApi';
import { expense_categories, payment_methods } from '../../../data/expenseOptions';

// expenses on the server for a real landlord, the phone's own list everywhere else (the demo, tenants, signed out)
// the screens keep calling useWorkOrders() and useExpenses() the same way in both modes

// the last list the server sent, per account, so Expenses still opens offline
function cacheKey(user_id) {
  return 'rent_well_expenses_cache_' + user_id;
}

// a receipt the landlord just picked is a file on the phone, it has to be uploaded to get a key first
async function receiptKeyFor(receipts) {
  const first = receipts && receipts.length > 0 ? receipts[0] : null;
  if (!first) {
    return null;
  }
  if (isReceiptKey(first)) {
    return first;
  }
  return uploadImage(first, 'image/jpeg');
}

export function ExpensesProvider(props) {
  const { user } = useAuth();
  const local = useLocalWorkOrders();
  const is_real_owner = !!user && !local.demo_mode && user.role === 'owner';
  if (!is_real_owner) {
    return props.children;
  }
  // a new key starts the store over for a different account
  return (
    <RemoteExpensesStore key={user.id} user={user}>
      {props.children}
    </RemoteExpensesStore>
  );
}

function RemoteExpensesStore(props) {
  const user_id = props.user.id;
  const local = useLocalWorkOrders();
  const { properties } = useTenants();
  const [expenses, setExpenses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [from_cache, setFromCache] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(null);
  const list_ref = useRef([]);

  function keep(next) {
    list_ref.current = next;
    setExpenses(next);
  }

  // every page, newest first, then the copy for offline goes in AsyncStorage
  async function loadAll(quiet) {
    try {
      const all = [];
      let cursor = null;
      do {
        const page = await getExpenses({ limit: 100, cursor: cursor });
        all.push(...page.expenses.map(fromApiExpense));
        cursor = page.nextCursor;
      } while (cursor);
      keep(all);
      setStatus('ready');
      setFromCache(false);
      setErrorMessage('');
      AsyncStorage.setItem(cacheKey(user_id), JSON.stringify(all)).catch((error) =>
        console.log('Could not save the expenses copy', error.message),
      );
    } catch (error) {
      console.log('Could not load expenses', error.message);
      setErrorMessage(error.message);
      if (!quiet && list_ref.current.length === 0) {
        setStatus('error');
      }
    }
  }

  const latest = useRef({ loadAll });
  useEffect(() => {
    latest.current = { loadAll };
  });

  // the saved copy shows right away, then the server's list replaces it
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(cacheKey(user_id))
      .then((text) => {
        if (active && text && list_ref.current.length === 0) {
          keep(JSON.parse(text));
          setFromCache(true);
          setStatus('ready');
        }
      })
      .catch(() => {})
      .finally(() => latest.current.loadAll(false));
    // a socket reconnect might mean the phone was offline, so it checks again
    const stop_connect = onSocketEvent('connect', () => latest.current.loadAll(true));
    return () => {
      active = false;
      stop_connect();
    };
  }, [user_id]);

  // the screens don't wait on a save, so a failed one says so here and the list goes back to how it was
  function failed(title, error) {
    console.log(title, error.message);
    Alert.alert(title, error.message);
  }

  // the property has to be one of the landlord's, or blank for a general expense
  function propertyIdOrAlert(name) {
    const property_id = findPropertyId(name, properties);
    if (property_id === undefined) {
      Alert.alert(
        'Pick one of your properties',
        '"' +
          name +
          '" isn\'t one of your properties. Pick one, or leave it blank for a general expense.',
      );
    }
    return property_id;
  }

  async function addExpense(order_id, fields) {
    const property_id = propertyIdOrAlert(fields.property);
    if (property_id === undefined) {
      return false;
    }
    const temp_id = 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const shown = {
      category: 'Repairs',
      vendor: '',
      notes: '',
      receipts: [],
      is_capital: false,
      ...fields,
      id: temp_id,
      work_order_id: order_id || null,
    };
    keep([shown, ...list_ref.current]);
    try {
      const receipt_key = await receiptKeyFor(fields.receipts);
      const created = await createExpense(
        toApiExpense({ ...shown, work_order_id: order_id || null }, property_id, receipt_key),
      );
      keep(list_ref.current.map((item) => (item.id === temp_id ? fromApiExpense(created) : item)));
      return true;
    } catch (error) {
      keep(list_ref.current.filter((item) => item.id !== temp_id));
      failed("Couldn't save the expense", error);
      return false;
    }
  }

  async function updateExpense(expense_id, changes) {
    const before = list_ref.current.find((item) => item.id === expense_id);
    if (!before) {
      return false;
    }
    const merged = { ...before, ...changes };
    const property_id = propertyIdOrAlert(merged.property);
    if (property_id === undefined) {
      return false;
    }
    keep(list_ref.current.map((item) => (item.id === expense_id ? merged : item)));
    try {
      const receipt_key = await receiptKeyFor(merged.receipts);
      const saved = await updateExpenseRequest(
        expense_id,
        toApiExpense(merged, property_id, receipt_key),
      );
      keep(list_ref.current.map((item) => (item.id === expense_id ? fromApiExpense(saved) : item)));
      return true;
    } catch (error) {
      keep(list_ref.current.map((item) => (item.id === expense_id ? before : item)));
      failed("Couldn't save the change", error);
      return false;
    }
  }

  async function deleteExpense(expense_id) {
    const before = list_ref.current;
    keep(before.filter((item) => item.id !== expense_id));
    try {
      await deleteExpenseRequest(expense_id);
      return true;
    } catch (error) {
      keep(before);
      failed("Couldn't delete the expense", error);
      return false;
    }
  }

  // ----- moving the phone's old expenses up -----

  const legacy = legacyExpenses(local.expenses);

  // uploads every old phone expense (with its first receipt), 500 at a time, then clears only the ones the
  // server says it has (created or existing), so a failure never loses anything and a retry never doubles up
  async function importLegacy() {
    const items = legacyExpenses(local.expenses);
    if (items.length === 0 || importing) {
      return { imported: 0, failed: 0 };
    }
    setImporting({ done: 0, total: items.length });
    const kept_failures = [];
    let imported = 0;
    try {
      const prepared = [];
      for (const expense of items) {
        try {
          const receipt = expense.receipts && expense.receipts[0];
          const receipt_key = receipt ? await uploadImage(receipt, 'image/jpeg') : null;
          prepared.push({ expense, item: toImportItem(expense, properties, receipt_key) });
        } catch (error) {
          // a receipt that won't upload keeps that expense on the phone for the next try
          kept_failures.push({ expense, message: error.message });
        }
        setImporting({ done: prepared.length + kept_failures.length, total: items.length });
      }
      for (const batch of inBatches(prepared, 500)) {
        const result = await importExpenses(batch.map((entry) => entry.item));
        result.results.forEach((row) => {
          const entry = batch[row.index];
          if (row.status === 'created' || row.status === 'existing') {
            imported++;
            local.deleteExpense(entry.expense.id);
          } else {
            kept_failures.push({
              expense: entry.expense,
              message: row.error ? row.error.message : 'Not imported',
            });
          }
        });
      }
    } catch (error) {
      setImporting(null);
      failed("Couldn't upload the expenses", error);
      return { imported: imported, failed: items.length - imported };
    }
    setImporting(null);
    await loadAll(true);
    return { imported: imported, failed: kept_failures.length, failures: kept_failures };
  }

  const property_names = properties.map((property) => property.name);

  // the useWorkOrders() value with the server's expenses in it, so every screen that reads expenses
  // (Expenses, Year-End, the Dashboard, and the work order screens' order.expenses) gets the server's list
  function withServerExpenses(base) {
    const orders = base.orders.map((order) => ({
      ...order,
      expenses: legacyExpensesFor(expenses, order.id),
    }));
    return {
      ...base,
      orders: orders,
      getOrder: (order_id) => orders.find((order) => order.id === order_id),
      expenses: expenses,
      addExpense: addExpense,
      updateExpense: updateExpense,
      deleteExpense: deleteExpense,
      // the server has no undelete, so the Expenses screen asks first instead of offering undo
      restoreExpense: () => {},
      expenses_remote: true,
    };
  }

  // a plain object every render: the provider only renders again when its own data or a context above it
  // changes, and every screen reading expenses renders again then anyway
  const value = {
    withServerExpenses: withServerExpenses,
    status: status,
    from_cache: from_cache,
    error_message: error_message,
    refreshing: refreshing,
    refresh: async () => {
      setRefreshing(true);
      await loadAll(false);
      setRefreshing(false);
    },
    property_names: property_names,
    legacy_count: legacy.length,
    importing: importing,
    importLegacy: importLegacy,
    expenses: expenses,
  };

  return (
    <RemoteExpensesContext.Provider value={value}>{props.children}</RemoteExpensesContext.Provider>
  );
}

// the one expenses interface for both modes: the list and its actions, plus what the form offers
// (the server's 10 categories and payment methods in real mode, the phone's longer lists otherwise)
export function useExpenses() {
  const all = useWorkOrders();
  const remote = useContext(RemoteExpensesContext);
  return {
    expenses: all.expenses,
    addExpense: all.addExpense,
    updateExpense: all.updateExpense,
    deleteExpense: all.deleteExpense,
    restoreExpense: all.restoreExpense,
    is_remote: !!remote,
    status: remote ? remote.status : 'ready',
    from_cache: remote ? remote.from_cache : false,
    error_message: remote ? remote.error_message : '',
    refreshing: remote ? remote.refreshing : false,
    refresh: remote ? remote.refresh : () => Promise.resolve(),
    categories: remote ? server_categories.map((item) => item.label) : expense_categories,
    payment_methods: remote ? server_payment_methods.map((item) => item.label) : payment_methods,
    property_names: remote ? remote.property_names : all.properties,
    legacy_count: remote ? remote.legacy_count : 0,
    importing: remote ? remote.importing : null,
    importLegacy: remote ? remote.importLegacy : () => Promise.resolve({ imported: 0, failed: 0 }),
  };
}

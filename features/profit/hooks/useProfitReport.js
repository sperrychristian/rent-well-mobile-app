import { useEffect, useRef, useState } from 'react';
import { useExpenses } from '../../expenses/context/ExpensesContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { useLedger } from '../../payments/context/LedgerContext';
import { getProfitReport, getTaxSummary, getTaxSummaryCsv } from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import {
  buildProfitReport,
  buildTaxSummary,
  taxSummaryToCsv,
  taxSummaryText,
  paymentsFromLedgers,
  expenseRows,
  fromApiProfitReport,
  fromApiTaxSummary,
} from '../utils/profitMath';
import { formatCents } from '../../../utils/formatCurrency';

// the demo (and anyone not signed in as a landlord) works the report out from the data on hand
// with the same rules as the server, so both modes show the same numbers for the same data
function localInputs(tenants, ledger_store, expenses) {
  const properties = tenants.properties.map((property) => ({
    id: property.id,
    name: property.name,
  }));
  return {
    properties: properties,
    payments: paymentsFromLedgers(ledger_store.ledgers || []),
    expenses: expenseRows(expenses, properties),
  };
}

function localReport(year, property_id, inputs) {
  if (!property_id) {
    return buildProfitReport({ year: Number(year), ...inputs });
  }
  return buildProfitReport({
    year: Number(year),
    properties: inputs.properties.filter((property) => property.id === property_id),
    payments: inputs.payments.filter((payment) => payment.property_id === property_id),
    expenses: inputs.expenses.filter((expense) => expense.property_id === property_id),
    include_general: false,
  });
}

// one year's profit report, the server's for a real landlord (GET /reports/profit), local otherwise
// property_id narrows it to one property (the chart filter), null is everything
export function useProfitReport(year, property_id) {
  const expense_store = useExpenses();
  const tenants = useTenants();
  const ledger_store = useLedger();
  const is_remote = expense_store.is_remote;
  const [remote, setRemote] = useState({ key: null, report: null, status: 'loading', error: '' });
  const [reload_count, setReloadCount] = useState(0);
  const request_key = year + ':' + (property_id || 'all') + ':' + reload_count;
  const latest_key = useRef(request_key);

  useEffect(() => {
    latest_key.current = request_key;
    if (!is_remote) {
      return;
    }
    getProfitReport(Number(year), property_id || undefined)
      .then((api_report) => {
        if (latest_key.current === request_key) {
          setRemote({
            key: request_key,
            report: fromApiProfitReport(api_report),
            status: 'ready',
            error: '',
          });
        }
      })
      .catch((error) => {
        console.log('Could not load the profit report', error.message);
        if (latest_key.current === request_key) {
          setRemote((current) => ({
            ...current,
            key: request_key,
            status: 'error',
            error: error.message,
          }));
        }
      });
  }, [is_remote, request_key, year, property_id]);

  // a payment or a change somewhere else moves the numbers, so a ledger update or reconnect asks again
  useEffect(() => {
    if (!is_remote) {
      return undefined;
    }
    const again = () => setReloadCount((count) => count + 1);
    const stop_ledger = onSocketEvent('ledger:updated', again);
    const stop_connect = onSocketEvent('connect', again);
    return () => {
      stop_ledger();
      stop_connect();
    };
  }, [is_remote]);

  if (!is_remote) {
    const inputs = localInputs(tenants, ledger_store, expense_store.expenses);
    return {
      status: 'ready',
      report: localReport(year, property_id, inputs),
      error: '',
      reload: () => {},
      properties: inputs.properties,
    };
  }
  const properties = tenants.properties.map((property) => ({
    id: property.id,
    name: property.name,
  }));
  return {
    // the last report stays on screen while a new year or property loads
    status: remote.report
      ? remote.key === request_key
        ? remote.status
        : 'refreshing'
      : remote.status,
    report: remote.report,
    error: remote.error,
    reload: () => setReloadCount((count) => count + 1),
    properties: properties,
  };
}

// the tax summary exports: the server's CSV and JSON for a real landlord, the local port otherwise
export function useTaxSummary() {
  const expense_store = useExpenses();
  const tenants = useTenants();
  const ledger_store = useLedger();

  function localSummary(year) {
    return buildTaxSummary({
      year: Number(year),
      ...localInputs(tenants, ledger_store, expense_store.expenses),
    });
  }

  return {
    csv: async (year) =>
      expense_store.is_remote
        ? getTaxSummaryCsv(Number(year))
        : taxSummaryToCsv(localSummary(year)),
    text: async (year) => {
      const summary = expense_store.is_remote
        ? fromApiTaxSummary(await getTaxSummary(Number(year)))
        : localSummary(year);
      return taxSummaryText(summary, formatCents);
    },
  };
}

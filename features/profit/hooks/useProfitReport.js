import { useExpenses } from '../../../store/ExpensesContext';
import { useTenants } from '../../../store/TenantsContext';
import { useLedger } from '../../../store/LedgerContext';
import {
  buildProfitReport,
  buildTaxSummary,
  taxSummaryToCsv,
  taxSummaryText,
  paymentsFromLedgers,
  expenseRows,
} from '../utils/profitMath';
import { formatCents } from '../../../util/formatCurrency';

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

// one year's profit report, worked out on the phone from the expenses and ledgers already loaded,
// in the demo and with Firebase alike (profitMath.js is the port of the old server's report, with parity tests)
// property_id narrows it to one property (the chart filter), null is everything
// with Firebase it's loading until both stores have loaded, and an error if either one couldn't load
export function useProfitReport(year, property_id) {
  const expense_store = useExpenses();
  const tenants = useTenants();
  const ledger_store = useLedger();
  const inputs = localInputs(tenants, ledger_store, expense_store.expenses);
  const statuses = [expense_store.status, ledger_store.status];
  const status = statuses.includes('error')
    ? 'error'
    : statuses.includes('loading')
      ? 'loading'
      : 'ready';
  return {
    status: status,
    report: status === 'ready' ? localReport(year, property_id, inputs) : null,
    error: expense_store.error_message || ledger_store.error_message || '',
    reload: () => {
      expense_store.refresh();
      ledger_store.refresh();
    },
    properties: inputs.properties,
  };
}

// the tax summary exports, worked out on the phone with the same rules in both modes (CSV goes out through the share sheet)
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
    csv: async (year) => taxSummaryToCsv(localSummary(year)),
    text: async (year) => taxSummaryText(localSummary(year), formatCents),
  };
}

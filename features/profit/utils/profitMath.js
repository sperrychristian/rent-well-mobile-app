import { findPropertyId, categoryValue } from '../../expenses/utils/expenseApi';

// the profit report and the tax summary, a port of the server's (rent-well-api src/reports), so the demo
// computes the same numbers the real report does. everything is integer cents
// rows in here use the server's own shapes:
//   payments: { property_id, paid_on, amount_cents, kind (payment or refund), applies_to (rent or deposit), status }
//   expenses: { property_id (null for general), spent_on, amount_cents, category, tax_deductible }
// and the results come out snake_case, the same shape fromApiProfitReport makes from the real response

export function monthsOfYear(year) {
  return Array.from({ length: 12 }, (_, index) => year + '-' + String(index + 1).padStart(2, '0'));
}

function lastDayOf(month) {
  const [year, number] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return month + '-' + String(days).padStart(2, '0');
}

// the one definition of rent collected: money that landed (succeeded), in the rent pool (never deposits),
// with refunds taken off, on its paid_on date
export function isCollectedRentMoney(payment) {
  return payment.status === 'succeeded' && payment.applies_to === 'rent';
}

export function rentCollectedCents(payments, first_day, last_day) {
  return payments
    .filter(
      (payment) =>
        isCollectedRentMoney(payment) &&
        payment.paid_on >= first_day &&
        payment.paid_on <= last_day,
    )
    .reduce(
      (sum, payment) =>
        sum + (payment.kind === 'refund' ? -payment.amount_cents : payment.amount_cents),
      0,
    );
}

function expensesCents(expenses, first_day, last_day) {
  return expenses
    .filter((expense) => expense.spent_on >= first_day && expense.spent_on <= last_day)
    .reduce((sum, expense) => sum + expense.amount_cents, 0);
}

// one row: rent, expenses, and net per month plus the year
function profitRow(year, payments, expenses) {
  const months = monthsOfYear(year).map((month) => {
    const first_day = month + '-01';
    const last_day = lastDayOf(month);
    const rent_collected_cents = rentCollectedCents(payments, first_day, last_day);
    const expenses_cents = expensesCents(expenses, first_day, last_day);
    return {
      month: month,
      rent_collected_cents: rent_collected_cents,
      expenses_cents: expenses_cents,
      net_cents: rent_collected_cents - expenses_cents,
    };
  });
  const sum = (key) => months.reduce((total, month) => total + month[key], 0);
  return {
    months: months,
    rent_collected_cents: sum('rent_collected_cents'),
    expenses_cents: sum('expenses_cents'),
    net_cents: sum('net_cents'),
  };
}

// every property gets a row (zeros too), plus any property id that shows up in a payment or expense
function propertyIds(properties, payments, expenses) {
  return [
    ...new Set([
      ...properties.map((property) => property.id),
      ...payments.map((payment) => payment.property_id),
      ...expenses.filter((expense) => expense.property_id).map((expense) => expense.property_id),
    ]),
  ];
}

// include_general is false when the report is for one property, like ?propertyId= on the server
export function buildProfitReport(options) {
  const { year, properties, payments, expenses } = options;
  const include_general = options.include_general !== false;
  const by_id = new Map(properties.map((property) => [property.id, property]));
  return {
    year: year,
    properties: propertyIds(properties, payments, expenses).map((property_id) => ({
      property: by_id.get(property_id) || { id: property_id, name: null },
      ...profitRow(
        year,
        payments.filter((payment) => payment.property_id === property_id),
        expenses.filter((expense) => expense.property_id === property_id),
      ),
    })),
    general: include_general
      ? profitRow(
          year,
          [],
          expenses.filter((expense) => !expense.property_id),
        )
      : null,
    total: profitRow(
      year,
      payments,
      include_general ? expenses : expenses.filter((expense) => expense.property_id),
    ),
  };
}

// ----- the tax summary (Schedule E) -----

export const schedule_e_categories = [
  { category: 'advertising', line: 5, label: 'Advertising' },
  { category: 'travel', line: 6, label: 'Auto and travel' },
  { category: 'insurance', line: 9, label: 'Insurance' },
  { category: 'professional_fees', line: 10, label: 'Legal and other professional fees' },
  { category: 'mortgage_interest', line: 12, label: 'Mortgage interest paid to banks, etc.' },
  { category: 'repairs', line: 14, label: 'Repairs' },
  { category: 'supplies', line: 15, label: 'Supplies' },
  { category: 'taxes', line: 16, label: 'Taxes' },
  { category: 'utilities', line: 17, label: 'Utilities' },
  { category: 'other', line: 19, label: 'Other' },
];

// one block: rent collected for the year, deductible expenses by Schedule E line, and the rest on its own line
function taxBlock(year, payments, expenses) {
  const first_day = year + '-01-01';
  const last_day = year + '-12-31';
  const in_year = expenses.filter(
    (expense) => expense.spent_on >= first_day && expense.spent_on <= last_day,
  );
  const deductible = in_year.filter((expense) => expense.tax_deductible);
  const categories = schedule_e_categories.map((entry) => ({
    ...entry,
    amount_cents: deductible
      .filter((expense) => expense.category === entry.category)
      .reduce((sum, expense) => sum + expense.amount_cents, 0),
  }));
  const income_cents = rentCollectedCents(payments, first_day, last_day);
  const deductible_expenses_cents = categories.reduce((sum, entry) => sum + entry.amount_cents, 0);
  return {
    income_cents: income_cents,
    categories: categories,
    deductible_expenses_cents: deductible_expenses_cents,
    non_deductible_expenses_cents: in_year
      .filter((expense) => !expense.tax_deductible)
      .reduce((sum, expense) => sum + expense.amount_cents, 0),
    net_cents: income_cents - deductible_expenses_cents,
  };
}

export function buildTaxSummary(options) {
  const { year, properties, payments, expenses } = options;
  const by_id = new Map(properties.map((property) => [property.id, property]));
  return {
    year: year,
    properties: propertyIds(properties, payments, expenses).map((property_id) => ({
      property: by_id.get(property_id) || { id: property_id, name: null },
      ...taxBlock(
        year,
        payments.filter((payment) => payment.property_id === property_id),
        expenses.filter((expense) => expense.property_id === property_id),
      ),
    })),
    general: taxBlock(
      year,
      [],
      expenses.filter((expense) => !expense.property_id),
    ),
    total: taxBlock(year, payments, expenses),
  };
}

// quote a field with a comma, quote, or newline, doubling inner quotes (RFC 4180)
function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// cents to "1234.56" with whole-number math, no float rounding
export function centsToDecimal(amount_cents) {
  const sign = amount_cents < 0 ? '-' : '';
  const absolute = Math.abs(amount_cents);
  return sign + Math.floor(absolute / 100) + '.' + String(absolute % 100).padStart(2, '0');
}

const tax_csv_header = [
  'year',
  'scope',
  'property_id',
  'property_name',
  'schedule_e_line',
  'category',
  'label',
  'amount_cents',
  'amount',
];

function blockRows(year, scope, property, block) {
  const row = (line, category, label, amount_cents) => [
    year,
    scope,
    property && property.id ? property.id : '',
    property && property.name
      ? property.name
      : scope === 'general'
        ? 'General (no property)'
        : 'All properties',
    line,
    category,
    label,
    amount_cents,
    centsToDecimal(amount_cents),
  ];
  return [
    row(3, 'rents_received', 'Rents received', block.income_cents),
    ...block.categories.map((entry) =>
      row(entry.line, entry.category, entry.label, entry.amount_cents),
    ),
    row(20, 'total_expenses', 'Total expenses', block.deductible_expenses_cents),
    row(21, 'net', 'Income or (loss)', block.net_cents),
    row(
      '',
      'non_deductible',
      'Not tax deductible (not in totals)',
      block.non_deductible_expenses_cents,
    ),
  ];
}

// the same CSV the server sends: a header, a block per property, then general, then all, CRLF line endings
export function taxSummaryToCsv(summary) {
  const rows = [
    tax_csv_header,
    ...summary.properties.flatMap((entry) =>
      blockRows(summary.year, 'property', entry.property, entry),
    ),
    ...blockRows(summary.year, 'general', null, summary.general),
    ...blockRows(summary.year, 'all', null, summary.total),
  ];
  return rows.map((fields) => fields.map(csvField).join(',')).join('\r\n') + '\r\n';
}

// ----- the app's data in the server's shapes (the demo) -----

// the demo ledgers' payments as server rows, each ledger knows its property
export function paymentsFromLedgers(ledgers) {
  const rows = [];
  ledgers.forEach((ledger) =>
    (ledger.payments || []).forEach((payment) =>
      rows.push({
        property_id: ledger.property_id,
        paid_on: payment.paid_on,
        amount_cents: payment.amount_cents,
        kind: payment.is_refund ? 'refund' : 'payment',
        applies_to: payment.applies_to,
        status: payment.status,
      }),
    ),
  );
  return rows;
}

// the app's expenses as server rows: a property name finds its property (or it's general), the label its
// category, and is_capital is the app's word for "not tax deductible"
export function expenseRows(expenses, properties) {
  return expenses.map((expense) => {
    const property_id = expense.property_id || findPropertyId(expense.property, properties);
    return {
      property_id: property_id || null,
      spent_on: expense.date,
      amount_cents:
        typeof expense.amount_cents === 'number'
          ? expense.amount_cents
          : Math.round(Number(expense.amount || 0) * 100),
      category: categoryValue(expense.category),
      tax_deductible: !expense.is_capital,
    };
  });
}

// ----- the server's responses in the same shape -----

function fromApiRow(row) {
  if (!row) {
    return null;
  }
  return {
    rent_collected_cents: row.rentCollectedCents,
    expenses_cents: row.expensesCents,
    net_cents: row.netCents,
    months: (row.months || []).map((month) => ({
      month: month.month,
      rent_collected_cents: month.rentCollectedCents,
      expenses_cents: month.expensesCents,
      net_cents: month.netCents,
    })),
  };
}

export function fromApiProfitReport(api_report) {
  return {
    year: api_report.year,
    properties: (api_report.properties || []).map((row) => ({
      property: row.property,
      ...fromApiRow(row),
    })),
    general: fromApiRow(api_report.general),
    total: fromApiRow(api_report.total),
  };
}

function fromApiTaxBlock(block) {
  return {
    income_cents: block.incomeCents,
    categories: (block.categories || []).map((entry) => ({
      category: entry.category,
      line: entry.scheduleELine,
      label: entry.label,
      amount_cents: entry.amountCents,
    })),
    deductible_expenses_cents: block.deductibleExpensesCents,
    non_deductible_expenses_cents: block.nonDeductibleExpensesCents,
    net_cents: block.netCents,
  };
}

export function fromApiTaxSummary(api_summary) {
  return {
    year: api_summary.year,
    properties: (api_summary.properties || []).map((entry) => ({
      property: entry.property,
      ...fromApiTaxBlock(entry),
    })),
    general: fromApiTaxBlock(api_summary.general),
    total: fromApiTaxBlock(api_summary.total),
  };
}

// ----- words on screen -----

// "Jan" to "Dec", for the chart and the month rows
export const month_short = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// a readable version of the tax summary for the text share
export function taxSummaryText(summary, formatCents) {
  const lines = [
    'Rent Well tax summary for ' + summary.year,
    'Schedule E style, not tax advice',
    '',
  ];
  const block = (title, entry) => {
    lines.push(title);
    lines.push('  Rents received: ' + formatCents(entry.income_cents));
    entry.categories
      .filter((category) => category.amount_cents !== 0)
      .forEach((category) =>
        lines.push(
          '  Line ' +
            category.line +
            ', ' +
            category.label +
            ': ' +
            formatCents(category.amount_cents),
        ),
      );
    lines.push('  Total expenses: ' + formatCents(entry.deductible_expenses_cents));
    lines.push('  Income or (loss): ' + formatCents(entry.net_cents));
    if (entry.non_deductible_expenses_cents) {
      lines.push('  Not tax deductible: ' + formatCents(entry.non_deductible_expenses_cents));
    }
    lines.push('');
  };
  summary.properties.forEach((entry) => block(entry.property.name || 'A deleted property', entry));
  block('General (no property)', summary.general);
  block('All properties', summary.total);
  return lines.join('\n');
}

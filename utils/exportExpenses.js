import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { totalsByCategory, sumAmounts } from './expenseStats';

// wraps a value in quotes when it has a comma, quote, or line break so the columns don't shift
function csvField(value) {
  const text = String(value === null || value === undefined ? '' : value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

// writes the csv text to a temporary file and opens the phone's share sheet
async function shareCsvText(csv, file_name, dialog_title) {
  const file = new File(Paths.cache, file_name);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(csv);

  const can_share = await Sharing.isAvailableAsync();
  if (!can_share) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: dialog_title,
    UTI: 'public.comma-separated-values-text',
  });
}

// every expense as a row, then the category totals underneath for tax time
export function buildExpensesCsv(expenses, order_titles) {
  const header = [
    'Date',
    'Property',
    'Category',
    'Vendor',
    'Amount',
    'Payment method',
    'Capital improvement',
    'Billed to tenant',
    'Recovered',
    'Notes',
    'Receipts',
    'Work order',
  ];
  const lines = [header.join(',')];

  [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((expense) => {
      const row = [
        expense.date,
        expense.property,
        expense.category,
        expense.vendor,
        expense.amount.toFixed(2),
        expense.payment_method,
        expense.is_capital ? 'Yes' : 'No',
        expense.billed_to_tenant ? 'Yes' : 'No',
        (expense.recovered || 0).toFixed(2),
        expense.notes,
        (expense.receipts || []).length,
        expense.work_order_id ? order_titles[expense.work_order_id] || '' : '',
      ];
      lines.push(row.map(csvField).join(','));
    });

  lines.push('');
  lines.push('Deductible totals by category');
  lines.push('Category,Total');
  totalsByCategory(expenses).forEach((row) => {
    lines.push(csvField(row.category) + ',' + row.total.toFixed(2));
  });
  lines.push(
    'Total deductible,' + sumAmounts(expenses.filter((expense) => !expense.is_capital)).toFixed(2),
  );
  lines.push(
    'Capital improvements (depreciated),' +
      sumAmounts(expenses.filter((expense) => expense.is_capital)).toFixed(2),
  );

  return lines.join('\n');
}

export async function shareExpensesCsv(expenses, year, order_titles) {
  const csv = buildExpensesCsv(expenses, order_titles);
  await shareCsvText(csv, 'rent-well-expenses-' + year + '.csv', 'Export expenses');
}

// one block per property, then the all properties totals, receipts coverage, and vendor totals
export function buildYearEndCsv(year, data, mileage_rate) {
  const lines = ['Rent Well year-end summary for ' + year, ''];

  data.per_property.forEach((item) => {
    lines.push('Property,' + csvField(item.property));
    lines.push('Category,Total');
    item.categories.forEach((row) => {
      lines.push(csvField(row.category) + ',' + row.total.toFixed(2));
    });
    lines.push('Total deductible,' + item.deductible.toFixed(2));
    lines.push('Capital improvements (depreciated),' + item.capital.toFixed(2));
    lines.push('Miles driven,' + item.miles.toFixed(1));
    lines.push(
      'Mileage deduction at ' + mileage_rate + ' per mile,' + item.mileage_deduction.toFixed(2),
    );
    lines.push('');
  });

  lines.push('All properties');
  lines.push('Total deductible,' + data.deductible.toFixed(2));
  lines.push('Capital improvements (depreciated),' + data.capital.toFixed(2));
  lines.push('Miles driven,' + data.miles.toFixed(1));
  lines.push('Mileage deduction,' + data.mileage_deduction.toFixed(2));
  lines.push('Expenses with a receipt,' + data.with_receipts + ' of ' + data.expense_count);
  lines.push('');
  lines.push('Vendor,Total paid');
  data.vendors.forEach((row) => {
    lines.push(csvField(row.vendor) + ',' + row.total.toFixed(2));
  });

  return lines.join('\n');
}

export async function shareYearEndCsv(year, data, mileage_rate) {
  const csv = buildYearEndCsv(year, data, mileage_rate);
  await shareCsvText(csv, 'rent-well-year-end-' + year + '.csv', 'Export year-end summary');
}

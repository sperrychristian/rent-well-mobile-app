import { parseAmountToCents, formatCurrency } from '../../../utils/formatCurrency';

// pure helpers between the app's expense shape and the server's (docs/API.md, Expenses)
// the screens keep the shape they've always used (amount in dollars, a category label, a property name),
// and these turn it into the server's camelCase with integer cents and back

// the server's 10 categories in its own order, with the labels the app already uses for them
export const server_categories = [
  { value: 'advertising', label: 'Advertising' },
  { value: 'travel', label: 'Auto and travel' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'professional_fees', label: 'Legal and professional fees' },
  { value: 'mortgage_interest', label: 'Mortgage interest' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

// the old phone-only categories the server doesn't have, so an imported one lands on the closest line
const extra_category_values = {
  'Cleaning and maintenance': 'repairs',
  Commissions: 'professional_fees',
  'Management fees': 'professional_fees',
  'Other interest': 'other',
};

export const server_payment_methods = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'other', label: 'Other' },
];

// the phone's old payment words, "Card" was always a credit or debit card
const extra_payment_values = { Card: 'credit_card' };

export function categoryValue(label) {
  const found = server_categories.find((item) => item.label === label);
  if (found) {
    return found.value;
  }
  return extra_category_values[label] || 'other';
}

export function categoryLabel(value) {
  const found = server_categories.find((item) => item.value === value);
  return found ? found.label : 'Other';
}

export function paymentValue(label) {
  if (!label) {
    return null;
  }
  const found = server_payment_methods.find((item) => item.label === label);
  if (found) {
    return found.value;
  }
  return extra_payment_values[label] || 'other';
}

export function paymentLabel(value) {
  const found = server_payment_methods.find((item) => item.value === value);
  return found ? found.label : 'Other';
}

// server keys start like this, local receipts are file uris, so a receipt can be either
export function isReceiptKey(text) {
  return typeof text === 'string' && text.indexOf('attachments/') === 0;
}

// the server's expense in the app's shape
// is_capital stays the app's word for "not tax deductible" (capital improvements are depreciated instead)
export function fromApiExpense(api_expense) {
  return {
    id: api_expense.id,
    amount: api_expense.amountCents / 100,
    amount_cents: api_expense.amountCents,
    category: categoryLabel(api_expense.category),
    date: api_expense.spentOn,
    property: api_expense.property ? api_expense.property.name : '',
    property_id: api_expense.propertyId || null,
    vendor: api_expense.vendor || '',
    payment_method: api_expense.paymentMethod ? paymentLabel(api_expense.paymentMethod) : '',
    is_capital: api_expense.taxDeductible === false,
    billed_to_tenant: false,
    recovered: 0,
    // the server's description is the line the app always showed as notes
    notes: api_expense.description || '',
    server_notes: api_expense.notes || '',
    receipts: api_expense.receiptKey ? [api_expense.receiptKey] : [],
    work_order_id: api_expense.workOrderId || null,
    client_id: api_expense.clientId || null,
  };
}

// a property name to its id: an exact name, or "Maple Court, Unit 2B" to Maple Court
// gives back undefined when it doesn't match any property (so the caller can say so), null for a blank one
export function findPropertyId(name, properties) {
  const trimmed = (name || '').trim();
  if (trimmed === '') {
    return null;
  }
  const exact = properties.find((property) => property.name === trimmed);
  if (exact) {
    return exact.id;
  }
  const by_prefix = properties.find((property) => trimmed.indexOf(property.name + ',') === 0);
  return by_prefix ? by_prefix.id : undefined;
}

// the description is required (1 to 500), so an expense with no notes uses its vendor, then its category
export function descriptionFor(fields) {
  const text =
    (fields.notes || '').trim() || (fields.vendor || '').trim() || fields.category || 'Expense';
  return text.slice(0, 500);
}

// the app's fields to the server's create or patch body
// receipt_key is the uploaded key (or null), property_id comes from findPropertyId
export function toApiExpense(fields, property_id, receipt_key) {
  const amount_cents =
    typeof fields.amount_cents === 'number'
      ? fields.amount_cents
      : parseAmountToCents(String(fields.amount));
  const body = {
    propertyId: property_id === undefined ? null : property_id,
    category: categoryValue(fields.category),
    vendor: (fields.vendor || '').trim() || null,
    description: descriptionFor(fields),
    amountCents: amount_cents,
    spentOn: fields.date,
    paymentMethod: paymentValue(fields.payment_method),
    taxDeductible: !fields.is_capital,
    receiptKey: receipt_key || null,
    workOrderId: fields.work_order_id || null,
  };
  if (fields.server_notes) {
    body.notes = fields.server_notes;
  }
  return body;
}

// one old phone expense as an import item: its own id is the clientId, so a retry never makes a double
// a property the server doesn't know is kept in the notes, so nothing the landlord typed is lost
export function toImportItem(expense, properties, receipt_key) {
  const property_id = findPropertyId(expense.property, properties);
  const kept = [];
  if (property_id === undefined && expense.property) {
    kept.push('Property on the phone: ' + expense.property);
  }
  if (expense.billed_to_tenant) {
    kept.push('Billed to tenant, recovered ' + formatCurrency(Number(expense.recovered || 0)));
  }
  const item = {
    clientId: String(expense.id).slice(0, 100),
    ...toApiExpense(
      { ...expense, server_notes: kept.join('\n') || null },
      property_id,
      receipt_key,
    ),
  };
  if (!item.notes) {
    delete item.notes;
  }
  // a work order link from the phone only means something if it's a server work order
  if (item.workOrderId && !/^[0-9a-f-]{36}$/i.test(item.workOrderId)) {
    item.workOrderId = null;
  }
  return item;
}

// the phone's own expenses worth moving: the fake seed ones from the first launch stay behind
export function legacyExpenses(expenses) {
  return (expenses || []).filter((expense) => String(expense.id).indexOf('seed-') !== 0);
}

// splits a list into batches of up to size (the import route takes 500 at a time)
export function inBatches(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

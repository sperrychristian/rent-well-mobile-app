import {
  fromApiExpense,
  toApiExpense,
  toImportItem,
  findPropertyId,
  legacyExpenses,
  inBatches,
  categoryValue,
  categoryLabel,
  paymentValue,
  isReceiptKey,
  descriptionFor,
} from './expenseApi';

const properties = [
  { id: 'p-maple', name: 'Maple Court' },
  { id: 'p-cedar', name: '48 Cedar Ave' },
];

const api_expense = {
  id: 'e1',
  propertyId: 'p-maple',
  property: { id: 'p-maple', name: 'Maple Court' },
  category: 'repairs',
  vendor: 'Wasatch Plumbing',
  description: 'Replace kitchen faucet',
  amountCents: 18000,
  spentOn: '2026-10-03',
  paymentMethod: 'credit_card',
  taxDeductible: true,
  receiptKey: 'attachments/u/abc.jpg',
  workOrderId: 'wo-1',
  notes: 'Under warranty for a year',
  clientId: null,
};

describe('server expenses in the app shape', () => {
  test('cents, labels, and the receipt key come across', () => {
    expect(fromApiExpense(api_expense)).toMatchObject({
      id: 'e1',
      amount: 180,
      amount_cents: 18000,
      category: 'Repairs',
      date: '2026-10-03',
      property: 'Maple Court',
      property_id: 'p-maple',
      payment_method: 'Credit card',
      is_capital: false,
      notes: 'Replace kitchen faucet',
      server_notes: 'Under warranty for a year',
      receipts: ['attachments/u/abc.jpg'],
      work_order_id: 'wo-1',
    });
    expect(
      fromApiExpense({ ...api_expense, taxDeductible: false, property: null, propertyId: null }),
    ).toMatchObject({
      is_capital: true,
      property: '',
    });
  });

  test('and back again, in whole cents with the server words', () => {
    const app = fromApiExpense(api_expense);
    expect(toApiExpense(app, 'p-maple', 'attachments/u/abc.jpg')).toEqual({
      propertyId: 'p-maple',
      category: 'repairs',
      vendor: 'Wasatch Plumbing',
      description: 'Replace kitchen faucet',
      amountCents: 18000,
      spentOn: '2026-10-03',
      paymentMethod: 'credit_card',
      taxDeductible: true,
      receiptKey: 'attachments/u/abc.jpg',
      workOrderId: 'wo-1',
      notes: 'Under warranty for a year',
    });
    // a new one from the form has a dollar amount, which turns into exact cents
    expect(
      toApiExpense({ amount: 19.99, category: 'Supplies', date: '2026-01-02' }, null, null),
    ).toMatchObject({
      amountCents: 1999,
      category: 'supplies',
      description: 'Supplies',
      propertyId: null,
      taxDeductible: true,
    });
  });

  test('the old phone categories and payment words land somewhere sensible', () => {
    expect(categoryValue('Cleaning and maintenance')).toBe('repairs');
    expect(categoryValue('Management fees')).toBe('professional_fees');
    expect(categoryValue('Made up')).toBe('other');
    expect(categoryLabel('mortgage_interest')).toBe('Mortgage interest');
    expect(paymentValue('Card')).toBe('credit_card');
    expect(paymentValue('Venmo')).toBe('venmo');
    expect(paymentValue('')).toBeNull();
  });

  test('property names find their property, a unit after a comma still matches', () => {
    expect(findPropertyId('Maple Court', properties)).toBe('p-maple');
    expect(findPropertyId('Maple Court, Unit 2B', properties)).toBe('p-maple');
    expect(findPropertyId('', properties)).toBeNull();
    expect(findPropertyId('Somewhere else', properties)).toBeUndefined();
  });

  test('a description is always there, from notes, the vendor, or the category', () => {
    expect(descriptionFor({ notes: '  ', vendor: 'Home Depot', category: 'Supplies' })).toBe(
      'Home Depot',
    );
    expect(descriptionFor({ category: 'Taxes' })).toBe('Taxes');
    expect(isReceiptKey('attachments/a.jpg')).toBe(true);
    expect(isReceiptKey('file:///tmp/a.jpg')).toBe(false);
  });
});

describe('moving old phone expenses up', () => {
  test('the seed expenses stay behind, everything else goes', () => {
    expect(
      legacyExpenses([{ id: 'seed-1' }, { id: '1700000000000' }, { id: 'abc' }]).map(
        (item) => item.id,
      ),
    ).toEqual(['1700000000000', 'abc']);
  });

  test('an import item keeps its id as clientId and loses nothing it can not map', () => {
    const item = toImportItem(
      {
        id: '1700000000000',
        amount: 23.99,
        category: 'Other interest',
        date: '2025-08-14',
        property: 'The lake cabin',
        vendor: '',
        payment_method: 'Card',
        is_capital: false,
        billed_to_tenant: true,
        recovered: 10,
        notes: 'Smoke detector batteries',
        work_order_id: '5',
      },
      properties,
      null,
    );
    expect(item).toMatchObject({
      clientId: '1700000000000',
      propertyId: null,
      category: 'other',
      description: 'Smoke detector batteries',
      amountCents: 2399,
      spentOn: '2025-08-14',
      paymentMethod: 'credit_card',
      workOrderId: null,
    });
    expect(item.notes).toContain('Property on the phone: The lake cabin');
    expect(item.notes).toContain('Billed to tenant, recovered $10.00');
  });

  test('batches are at most the size given', () => {
    const items = Array.from({ length: 1203 }, (_, index) => index);
    expect(inBatches(items, 500).map((batch) => batch.length)).toEqual([500, 500, 203]);
  });
});

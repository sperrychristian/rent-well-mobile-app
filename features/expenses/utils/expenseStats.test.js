import {
  sumAmounts,
  sumMiles,
  totalsByCategory,
  totalsByProperty,
  totalsByVendor,
  sumBilled,
  sumRecovered,
  splitAmount,
  formatMoney,
  buildYearEndData,
} from '../expenseStats';

// a small mixed set: one capital improvement, one billed to a tenant, one with no vendor
const expenses = [
  {
    amount: 100,
    category: 'Repairs',
    property: 'A',
    vendor: 'Plumber',
    is_capital: false,
    date: '2026-03-01',
    receipts: ['r1'],
  },
  {
    amount: 50,
    category: 'Supplies',
    property: 'B',
    vendor: 'Hardware',
    is_capital: false,
    date: '2026-04-01',
    receipts: [],
  },
  {
    amount: 25,
    category: 'Repairs',
    property: 'B',
    vendor: '',
    is_capital: false,
    date: '2026-05-01',
    receipts: [],
    billed_to_tenant: true,
    recovered: 10,
  },
  {
    amount: 1000,
    category: 'Repairs',
    property: 'A',
    vendor: 'Plumber',
    is_capital: true,
    date: '2026-06-01',
    receipts: ['r2'],
  },
  {
    amount: 70,
    category: 'Utilities',
    property: 'A',
    vendor: 'Power Co',
    is_capital: false,
    date: '2025-12-31',
    receipts: [],
  },
];

describe('sumAmounts and sumMiles', () => {
  test('add up every item, including capital improvements', () => {
    expect(sumAmounts(expenses)).toBe(1245);
    expect(sumMiles([{ miles: 12.5 }, { miles: 7.5 }])).toBe(20);
  });

  test('empty lists add up to zero', () => {
    expect(sumAmounts([])).toBe(0);
    expect(sumMiles([])).toBe(0);
  });
});

describe('totalsByCategory', () => {
  test('leaves out capital improvements and sorts biggest first', () => {
    expect(totalsByCategory(expenses)).toEqual([
      { category: 'Repairs', total: 125 },
      { category: 'Utilities', total: 70 },
      { category: 'Supplies', total: 50 },
    ]);
  });
});

describe('totalsByProperty', () => {
  test('includes capital improvements and sorts biggest first', () => {
    expect(totalsByProperty(expenses)).toEqual([
      { property: 'A', total: 1170 },
      { property: 'B', total: 75 },
    ]);
  });
});

describe('totalsByVendor', () => {
  test('skips expenses with no vendor and sorts biggest first', () => {
    expect(totalsByVendor(expenses)).toEqual([
      { vendor: 'Plumber', total: 1100 },
      { vendor: 'Power Co', total: 70 },
      { vendor: 'Hardware', total: 50 },
    ]);
  });
});

describe('sumBilled and sumRecovered', () => {
  test('billed only counts expenses billed to a tenant', () => {
    expect(sumBilled(expenses)).toBe(25);
  });

  test('recovered treats a missing value as zero', () => {
    expect(sumRecovered(expenses)).toBe(10);
  });
});

describe('splitAmount', () => {
  test('gives the leftover pennies to the first parts so the parts add back up', () => {
    const parts = splitAmount(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(parts.reduce((sum, part) => sum + part, 0) * 100)).toBe(10000);
  });

  test('works with tiny and even amounts', () => {
    expect(splitAmount(0.05, 2)).toEqual([0.03, 0.02]);
    expect(splitAmount(90, 3)).toEqual([30, 30, 30]);
  });
});

describe('formatMoney', () => {
  test('adds a dollar sign, two decimals, and thousands commas', () => {
    expect(formatMoney(1240)).toBe('$1,240.00');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(999.5)).toBe('$999.50');
    expect(formatMoney(1234567.891)).toBe('$1,234,567.89');
  });

  test('rounds to the nearest cent before adding commas', () => {
    expect(formatMoney(999.999)).toBe('$1,000.00');
  });
});

describe('buildYearEndData', () => {
  const trips = [
    { date: '2026-02-10', property: 'A', miles: 10 },
    { date: '2026-02-11', property: 'C', miles: 5 },
    { date: '2025-02-11', property: 'A', miles: 100 },
  ];
  const data = buildYearEndData('2026', expenses, trips, 0.5);

  test('only uses the chosen year', () => {
    expect(data.expense_count).toBe(4);
    expect(data.miles).toBe(15);
    expect(data.mileage_deduction).toBe(7.5);
  });

  test('splits deductible and capital totals', () => {
    expect(data.deductible).toBe(175);
    expect(data.capital).toBe(1000);
  });

  test('lists every property from expenses or trips, sorted', () => {
    expect(data.per_property.map((item) => item.property)).toEqual(['A', 'B', 'C']);
    const property_a = data.per_property[0];
    expect(property_a.deductible).toBe(100);
    expect(property_a.capital).toBe(1000);
    expect(property_a.miles).toBe(10);
    expect(property_a.mileage_deduction).toBe(5);
    expect(data.per_property[2]).toEqual({
      property: 'C',
      categories: [],
      deductible: 0,
      capital: 0,
      miles: 5,
      mileage_deduction: 2.5,
    });
  });

  test('counts receipts and lists the expenses missing one', () => {
    expect(data.with_receipts).toBe(2);
    expect(data.missing_receipts.map((expense) => expense.amount)).toEqual([50, 25]);
  });

  test('vendor totals cover the year only', () => {
    expect(data.vendors).toEqual([
      { vendor: 'Plumber', total: 1100 },
      { vendor: 'Hardware', total: 50 },
    ]);
  });
});

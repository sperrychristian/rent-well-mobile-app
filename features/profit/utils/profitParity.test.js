import {
  buildProfitReport,
  buildTaxSummary,
  taxSummaryToCsv,
  rentCollectedCents,
  centsToDecimal,
  paymentsFromLedgers,
  expenseRows,
  fromApiProfitReport,
  fromApiTaxSummary,
  taxSummaryText,
} from './profitMath';
import { monthSummary } from '../../payments/utils/ledgerMath';
import { buildSampleLedgers } from '../../payments/data/sampleLedger';
import { formatCents } from '../../../utils/formatCurrency';

// the backend's own report cases (rent-well-api tests/reportMath.test.js), run against the app's port
// in the style of the ledger's backendParity test, so the demo's profit numbers can't drift from the server's

let sequence = 0;
const payment = (property_id, paid_on, amount_cents, extra) => {
  sequence += 1;
  return {
    id: 'p-' + sequence,
    property_id,
    paid_on,
    amount_cents,
    kind: 'payment',
    applies_to: 'rent',
    status: 'succeeded',
    ...(extra || {}),
  };
};
const expense = (property_id, spent_on, amount_cents, extra) => ({
  property_id,
  spent_on,
  amount_cents,
  category: 'repairs',
  tax_deductible: true,
  ...(extra || {}),
});
const maple = { id: 'maple', name: 'Maple Court' };
const birch = { id: 'birch', name: 'Birch House' };
const month = (row, number) => row.months[number - 1];

describe('profit report (backend vectors)', () => {
  test('rent counts only landed rent money, refunds netted, voided and claims excluded', () => {
    const report = buildProfitReport({
      year: 2026,
      properties: [maple],
      payments: [
        payment('maple', '2026-03-01', 120000),
        payment('maple', '2026-03-05', 20000, { kind: 'refund' }),
        payment('maple', '2026-03-06', 99999, { status: 'voided' }),
        payment('maple', '2026-03-07', 88888, { status: 'pending_confirmation' }),
        payment('maple', '2026-03-08', 77777, { status: 'rejected' }),
        payment('maple', '2026-03-09', 150000, { applies_to: 'deposit' }),
      ],
      expenses: [],
    });
    expect(month(report.properties[0], 3).rent_collected_cents).toBe(100000);
    expect(report.properties[0].rent_collected_cents).toBe(100000);
  });

  test('a partial month: rent and expenses land in the month of their date only', () => {
    const report = buildProfitReport({
      year: 2026,
      properties: [maple],
      payments: [payment('maple', '2026-02-28', 50000), payment('maple', '2026-03-01', 70000)],
      expenses: [expense('maple', '2026-02-28', 10000), expense('maple', '2026-03-31', 3000)],
    });
    const row = report.properties[0];
    expect(month(row, 2)).toEqual({
      month: '2026-02',
      rent_collected_cents: 50000,
      expenses_cents: 10000,
      net_cents: 40000,
    });
    expect(month(row, 3)).toMatchObject({ rent_collected_cents: 70000, expenses_cents: 3000 });
    expect(month(row, 4)).toMatchObject({
      rent_collected_cents: 0,
      expenses_cents: 0,
      net_cents: 0,
    });
    expect(row).toMatchObject({
      rent_collected_cents: 120000,
      expenses_cents: 13000,
      net_cents: 107000,
    });
  });

  test('year boundaries: Dec 31 and Jan 1 of the neighboring years are left out', () => {
    const report = buildProfitReport({
      year: 2026,
      properties: [maple],
      payments: [
        payment('maple', '2025-12-31', 1000),
        payment('maple', '2026-01-01', 2000),
        payment('maple', '2026-12-31', 4000),
        payment('maple', '2027-01-01', 8000),
      ],
      expenses: [
        expense('maple', '2025-12-31', 100),
        expense('maple', '2026-12-31', 300),
        expense('maple', '2027-01-01', 900),
      ],
    });
    const row = report.properties[0];
    expect(month(row, 1).rent_collected_cents).toBe(2000);
    expect(month(row, 12)).toMatchObject({ rent_collected_cents: 4000, expenses_cents: 300 });
    expect(row).toMatchObject({ rent_collected_cents: 6000, expenses_cents: 300 });
  });

  test('properties with no activity still get a zero row, general expenses are separate', () => {
    const report = buildProfitReport({
      year: 2026,
      properties: [maple, birch],
      payments: [payment('maple', '2026-05-01', 100000)],
      expenses: [expense(null, '2026-05-02', 25000, { category: 'professional_fees' })],
    });
    expect(report.properties.map((row) => row.property.id)).toEqual(['maple', 'birch']);
    expect(report.properties[1]).toMatchObject({
      rent_collected_cents: 0,
      expenses_cents: 0,
      net_cents: 0,
    });
    expect(report.properties[1].months).toHaveLength(12);
    expect(report.general).toMatchObject({
      rent_collected_cents: 0,
      expenses_cents: 25000,
      net_cents: -25000,
    });
    expect(report.total).toMatchObject({
      rent_collected_cents: 100000,
      expenses_cents: 25000,
      net_cents: 75000,
    });
  });

  test('a single-property report drops general expenses', () => {
    const report = buildProfitReport({
      year: 2026,
      properties: [maple],
      payments: [],
      expenses: [expense('maple', '2026-05-02', 500), expense(null, '2026-05-02', 25000)],
      include_general: false,
    });
    expect(report.general).toBeNull();
    expect(report.total.expenses_cents).toBe(500);
  });

  test('rent collected is the exact number for a month', () => {
    const ledger_payments = [
      payment('maple', '2026-10-01', 120000),
      payment('maple', '2026-10-15', 30000, { kind: 'refund' }),
      payment('maple', '2026-10-20', 5000, { status: 'voided' }),
      payment('maple', '2026-09-30', 1000),
    ];
    const report = buildProfitReport({
      year: 2026,
      properties: [maple],
      payments: ledger_payments,
      expenses: [],
    });
    expect(month(report.properties[0], 10).rent_collected_cents).toBe(90000);
    expect(rentCollectedCents(ledger_payments, '2026-10-01', '2026-10-31')).toBe(90000);
  });
});

describe('tax summary (backend vectors)', () => {
  const summary = () =>
    buildTaxSummary({
      year: 2026,
      properties: [{ id: 'maple', name: 'Maple Court, "East"' }],
      payments: [payment('maple', '2026-04-01', 200000), payment('maple', '2025-04-01', 999)],
      expenses: [
        expense('maple', '2026-04-02', 18000, { category: 'repairs' }),
        expense('maple', '2026-04-03', 12000, { category: 'insurance' }),
        expense('maple', '2026-04-04', 5000, { category: 'supplies', tax_deductible: false }),
        expense(null, '2026-06-01', 40000, { category: 'professional_fees' }),
      ],
    });

  test('income, deductible categories in Schedule E order, and net', () => {
    const result = summary();
    const [property_block] = result.properties;
    expect(property_block).toMatchObject({
      income_cents: 200000,
      deductible_expenses_cents: 30000,
      non_deductible_expenses_cents: 5000,
      net_cents: 170000,
    });
    expect(property_block.categories.map((entry) => entry.line)).toEqual([
      5, 6, 9, 10, 12, 14, 15, 16, 17, 19,
    ]);
    expect(
      property_block.categories.find((entry) => entry.category === 'supplies').amount_cents,
    ).toBe(0);
    expect(result.general).toMatchObject({
      income_cents: 0,
      deductible_expenses_cents: 40000,
      net_cents: -40000,
    });
    expect(result.total).toMatchObject({
      income_cents: 200000,
      deductible_expenses_cents: 70000,
      net_cents: 130000,
    });
  });

  test('CSV: header, one block per scope, quoting, CRLF', () => {
    const csv = taxSummaryToCsv(summary());
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'year,scope,property_id,property_name,schedule_e_line,category,label,amount_cents,amount',
    );
    expect(lines[1]).toBe(
      '2026,property,maple,"Maple Court, ""East""",3,rents_received,Rents received,200000,2000.00',
    );
    expect(lines).toContain(
      '2026,general,,General (no property),10,professional_fees,Legal and other professional fees,40000,400.00',
    );
    expect(lines).toContain('2026,all,,All properties,21,net,Income or (loss),130000,1300.00');
    expect(lines).toHaveLength(1 + 3 * 14 + 1);
    expect(centsToDecimal(-1505)).toBe('-15.05');
  });

  test('the text version reads the same numbers', () => {
    const text = taxSummaryText(summary(), formatCents);
    expect(text).toContain('Rents received: $2,000.00');
    expect(text).toContain('Line 10, Legal and other professional fees: $400.00');
    expect(text).toContain('Not tax deductible: $50.00');
  });
});

describe('the demo uses the same rules on its own data', () => {
  test('demo rent collected per month matches the ledger month summary', () => {
    const today = new Date().toISOString().slice(0, 10);
    const ledgers = buildSampleLedgers(today);
    const properties = [
      { id: 'demo-prop-maple', name: '123 Maple St' },
      { id: 'demo-prop-cedar', name: '48 Cedar Ave' },
    ];
    const report = buildProfitReport({
      year: Number(today.slice(0, 4)),
      properties,
      payments: paymentsFromLedgers(ledgers),
      expenses: [],
    });
    const this_month = today.slice(0, 7);
    const from_ledger = monthSummary(ledgers, this_month, today).collected_cents;
    expect(report.total.months[Number(this_month.slice(5)) - 1].rent_collected_cents).toBe(
      from_ledger,
    );
  });

  test('app expenses become server rows: property by name, category, and the capital switch', () => {
    const rows = expenseRows(
      [
        {
          amount: 12.5,
          category: 'Repairs',
          date: '2026-03-02',
          property: '123 Maple St, Unit 2',
          is_capital: false,
        },
        {
          amount: 900,
          category: 'Cleaning and maintenance',
          date: '2026-03-03',
          property: '',
          is_capital: true,
        },
      ],
      [{ id: 'demo-prop-maple', name: '123 Maple St' }],
    );
    expect(rows).toEqual([
      {
        property_id: 'demo-prop-maple',
        spent_on: '2026-03-02',
        amount_cents: 1250,
        category: 'repairs',
        tax_deductible: true,
      },
      {
        property_id: null,
        spent_on: '2026-03-03',
        amount_cents: 90000,
        category: 'repairs',
        tax_deductible: false,
      },
    ]);
  });

  test('the server responses map into the same shape', () => {
    const api_month = {
      month: '2026-01',
      rentCollectedCents: 240000,
      expensesCents: 18000,
      netCents: 222000,
    };
    const row = {
      rentCollectedCents: 240000,
      expensesCents: 18000,
      netCents: 222000,
      months: [api_month],
    };
    const mapped = fromApiProfitReport({
      year: 2026,
      propertyId: null,
      properties: [{ property: maple, ...row }],
      general: null,
      total: row,
    });
    expect(mapped.properties[0]).toMatchObject({
      property: maple,
      rent_collected_cents: 240000,
      net_cents: 222000,
      months: [
        {
          month: '2026-01',
          rent_collected_cents: 240000,
          expenses_cents: 18000,
          net_cents: 222000,
        },
      ],
    });
    expect(mapped.general).toBeNull();
    const block = {
      incomeCents: 1,
      categories: [{ category: 'repairs', scheduleELine: 14, label: 'Repairs', amountCents: 2 }],
      deductibleExpensesCents: 2,
      nonDeductibleExpensesCents: 0,
      netCents: -1,
    };
    expect(
      fromApiTaxSummary({ year: 2026, properties: [], general: block, total: block }).total,
    ).toEqual({
      income_cents: 1,
      categories: [{ category: 'repairs', line: 14, label: 'Repairs', amount_cents: 2 }],
      deductible_expenses_cents: 2,
      non_deductible_expenses_cents: 0,
      net_cents: -1,
    });
  });
});

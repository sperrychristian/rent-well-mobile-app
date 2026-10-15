import {
  addDays,
  daysBetween,
  isDate,
  shiftMonth,
  rentDueDates,
  rentChargeId,
  nextScheduledDue,
  allocate,
  chargeStatus,
  deriveLedger,
  syncLedger,
  monthSummary,
  collectedShare,
  paymentEffect,
} from './ledgerMath';
import {
  rent_due_date_vectors,
  ledger_vectors,
  late_fee_vector,
  month_summary_vector,
} from './ledgerVectors';

describe('dates as text', () => {
  test('adds days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
    expect(daysBetween('2026-10-14', '2026-10-01')).toBe(-13);
  });

  test('isDate only takes real calendar dates', () => {
    expect(isDate('2026-02-28')).toBe(true);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-2-3')).toBe(false);
    expect(isDate(null)).toBe(false);
  });

  test('shiftMonth steps over year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', -12)).toBe('2025-10');
  });
});

describe('rent from the schedule (shared vectors)', () => {
  rent_due_date_vectors.forEach((vector) => {
    test(vector.name, () => {
      expect(rentDueDates(vector.schedule, vector.through)).toEqual(vector.expect);
    });
  });

  test('the charge id is the tenancy and month, and next due skips today', () => {
    expect(rentChargeId('t1', '2026-10-01')).toBe('rent-t1-2026-10');
    const schedule = rent_due_date_vectors[0].schedule;
    expect(nextScheduledDue(schedule, '2026-10-14')).toBe('2026-11-01');
    expect(nextScheduledDue(schedule, '2026-09-30')).toBe('2026-10-01');
    expect(nextScheduledDue(null, '2026-10-14')).toBeNull();
  });
});

describe('deriveLedger (shared vectors)', () => {
  ledger_vectors.forEach((vector) => {
    test(vector.name, () => {
      const derived = deriveLedger(vector.ledger, vector.today);
      expect(derived.balance_cents).toBe(vector.expect.balance_cents);
      expect(derived.due_now_cents).toBe(vector.expect.due_now_cents);
      expect(derived.overdue_count).toBe(vector.expect.overdue_count);
      expect(derived.overdue_cents).toBe(vector.expect.overdue_cents);
      expect(derived.deposit_held_cents).toBe(vector.expect.deposit_held_cents);
      expect(derived.row_status).toBe(vector.expect.row_status);
      expect(derived.next_due).toEqual(vector.expect.next_due);
      Object.entries(vector.expect.statuses).forEach(([id, status]) => {
        expect({ id, status: derived.charges.find((charge) => charge.id === id).status }).toEqual({
          id,
          status,
        });
      });
      // every amount stays whole cents
      expect(Number.isInteger(derived.balance_cents)).toBe(true);
    });
  });
});

describe('payments and charges', () => {
  test('only confirmed payments count, refunds count backwards', () => {
    const base = { amount_cents: 1000, is_refund: false };
    expect(paymentEffect({ ...base, status: 'succeeded' })).toBe(1000);
    expect(paymentEffect({ ...base, status: 'succeeded', is_refund: true })).toBe(-1000);
    // the server's names: only succeeded counts, a claim (pending_confirmation) and the provider ones never do
    [
      'pending_confirmation',
      'pending',
      'processing',
      'failed',
      'returned',
      'rejected',
      'voided',
    ].forEach((status) => expect(paymentEffect({ ...base, status })).toBe(0));
  });

  test('allocate pays the oldest charge first', () => {
    const charges = [
      { id: 'b', kind: 'rent', amount_cents: 100, due_date: '2026-10-01' },
      { id: 'a', kind: 'rent', amount_cents: 100, due_date: '2026-09-01' },
    ];
    const payments = [
      {
        id: 'p',
        amount_cents: 150,
        status: 'succeeded',
        applies_to: 'rent',
        paid_on: '2026-10-01',
      },
    ];
    // allocate gives back the pools now, like the server's allocatePool
    expect(allocate(charges, payments)).toEqual({
      remaining: { a: 0, b: 50 },
      credit_cents: 0,
      debt_cents: 0,
    });
  });

  test('status order: voided, paid, overdue, partial, then due, due soon, or upcoming', () => {
    // grace days only apply to rent, like the server
    const charge = { kind: 'rent', amount_cents: 100, due_date: '2026-10-01' };
    expect(chargeStatus({ ...charge, voided_at: 'x' }, 100, '2026-10-20', 0)).toBe('voided');
    expect(chargeStatus(charge, 0, '2026-10-20', 0)).toBe('paid');
    expect(chargeStatus(charge, 40, '2026-10-20', 5)).toBe('overdue');
    expect(chargeStatus(charge, 40, '2026-10-03', 5)).toBe('partial');
    expect(chargeStatus(charge, 100, '2026-10-01', 5)).toBe('due');
    expect(chargeStatus(charge, 100, '2026-09-20', 5)).toBe('upcoming');
    expect(chargeStatus(charge, 100, '2026-09-24', 5)).toBe('due_soon');
    expect(chargeStatus({ ...charge, kind: 'other' }, 100, '2026-10-02', 5)).toBe('overdue');
  });
});

describe('syncLedger and late fees (shared vector)', () => {
  test('adds the rent and one late fee, and nothing the second time', () => {
    const once = syncLedger(late_fee_vector.ledger, late_fee_vector.today);
    expect(once.charges.map((charge) => charge.id).sort()).toEqual(
      [...late_fee_vector.expect_ids].sort(),
    );
    const fee = once.charges.find((charge) => charge.kind === 'late_fee');
    expect(fee).toMatchObject(late_fee_vector.expect_fee);
    expect(deriveLedger(once, late_fee_vector.today).balance_cents).toBe(
      late_fee_vector.expect_balance_cents,
    );
    const twice = syncLedger(once, late_fee_vector.today);
    expect(twice).toBe(once);
  });

  test('an ended tenancy or no schedule gets nothing new', () => {
    const ended = { ...late_fee_vector.ledger, tenancy_status: 'ended' };
    expect(syncLedger(ended, late_fee_vector.today)).toBe(ended);
    const unscheduled = { ...late_fee_vector.ledger, schedule: null };
    expect(syncLedger(unscheduled, late_fee_vector.today)).toBe(unscheduled);
  });
});

describe('monthSummary (shared vector)', () => {
  test('expected, collected, outstanding, overdue, and pending for the month', () => {
    const summary = monthSummary(
      month_summary_vector.ledgers,
      month_summary_vector.month,
      month_summary_vector.today,
    );
    const expected = month_summary_vector.expect;
    expect(summary.expected_cents).toBe(expected.expected_cents);
    expect(summary.collected_cents).toBe(expected.collected_cents);
    expect(summary.outstanding_cents).toBe(expected.outstanding_cents);
    expect(summary.overdue_count).toBe(expected.overdue_count);
    expect(summary.overdue_cents).toBe(expected.overdue_cents);
    expect(summary.pending.length).toBe(expected.pending_count);
  });

  test('collectedShare stays between 0 and 1 in whole thousandths', () => {
    expect(collectedShare(160000, 240000)).toBe(0.666);
    expect(collectedShare(300000, 240000)).toBe(1);
    expect(collectedShare(0, 0)).toBe(0);
    expect(collectedShare(5, 0)).toBe(1);
    expect(collectedShare(-5, 100)).toBe(0);
  });
});

import {
  chargePill,
  paymentPill,
  rowPill,
  methodLabel,
  chargeKindLabel,
  formatBalance,
  monthTitle,
  shortDate,
  groupByMonth,
  validatePayment,
  validateCharge,
  validateSchedule,
  validateReason,
  hasErrors,
  buildReceiptText,
  timelineFor,
} from './ledgerHelpers';
import { toneColors } from '../../../components/ui/uiHelpers';
import { meetsAA } from '../../../utils/contrast';

const today = '2026-10-14';

describe('status words', () => {
  test('every pill has words, an icon, and a readable tone', () => {
    ['paid', 'partial', 'due', 'overdue', 'upcoming', 'voided', 'nope'].forEach((status) => {
      const pill = chargePill(status);
      expect(pill.label.length).toBeGreaterThan(0);
      expect(pill.icon).toBeTruthy();
      const tone = toneColors(pill.tone);
      expect(meetsAA(tone.text, tone.tint)).toBe(true);
    });
    expect(paymentPill('pending').label).toBe('Waiting for confirmation');
    expect(paymentPill('rejected').tone).toBe('danger');
    expect(rowPill('paid').label).toBe('All paid up');
    expect(rowPill('overdue').label).toBe('Overdue');
  });

  test('method and kind labels', () => {
    expect(methodLabel('bank_transfer')).toBe('Bank transfer');
    expect(methodLabel('crypto')).toBe('Other');
    expect(chargeKindLabel('deposit')).toBe('Security deposit');
  });
});

describe('balances and dates', () => {
  test('owed, paid up, or credit', () => {
    expect(formatBalance(120000)).toEqual({ text: '$1,200.00 due', tone: 'danger', short: 'Due' });
    expect(formatBalance(0).text).toBe('All paid up');
    expect(formatBalance(-2500)).toEqual({
      text: '$25.00 credit',
      tone: 'success',
      short: 'Credit',
    });
  });

  test('month titles and short dates', () => {
    expect(monthTitle('2026-10')).toBe('October 2026');
    expect(monthTitle('bad')).toBe('bad');
    expect(shortDate('2026-11-01')).toBe('Nov 1');
    expect(shortDate('nope')).toBe('');
  });

  test('groupByMonth puts the newest month and item first and skips bad dates', () => {
    const groups = groupByMonth([
      { id: 'a', date: '2026-09-01' },
      { id: 'b', date: '2026-10-01' },
      { id: 'c', date: '2026-10-12' },
      { id: 'd', date: 'nope' },
    ]);
    expect(groups.map((group) => group.title)).toEqual(['October 2026', 'September 2026']);
    expect(groups[0].items.map((item) => item.id)).toEqual(['c', 'b']);
  });
});

describe('form checks', () => {
  const good_payment = {
    amount_text: '1,200.50',
    method: 'zelle',
    paid_on: '2026-10-02',
    applies_to: 'rent',
    is_refund: false,
    note: ' October ',
  };

  test('a good payment comes back in whole cents', () => {
    const result = validatePayment(good_payment, today, false);
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      amount_cents: 120050,
      method: 'zelle',
      paid_on: '2026-10-02',
      applies_to: 'rent',
      is_refund: false,
      note: 'October',
    });
  });

  test('every bad field gets its own message', () => {
    const result = validatePayment(
      { amount_text: 'abc', method: 'crypto', paid_on: '2026-10-30', applies_to: 'x', note: '' },
      today,
      false,
    );
    expect(Object.keys(result.errors).sort()).toEqual([
      'amount',
      'applies_to',
      'method',
      'paid_on',
    ]);
    expect(validatePayment({ ...good_payment, amount_text: '0' }, today).errors.amount).toMatch(
      /more than/,
    );
    expect(
      validatePayment({ ...good_payment, amount_text: '100001' }, today).errors.amount,
    ).toMatch(/limit/);
  });

  test('a tenant claim can not be a refund', () => {
    const result = validatePayment({ ...good_payment, is_refund: true }, today, true);
    expect(result.errors.is_refund).toBeTruthy();
    expect(result.value.is_refund).toBe(false);
  });

  test('charges need a kind, a description, an amount, and a date', () => {
    expect(
      validateCharge({ kind: 'other', description: 'Key', amount_text: '25', due_date: today })
        .errors,
    ).toEqual({});
    const bad = validateCharge({ kind: 'x', description: ' ', amount_text: '', due_date: 'x' });
    expect(Object.keys(bad.errors).sort()).toEqual(['amount', 'description', 'due_date', 'kind']);
  });

  test('schedules: day 1 to 28, grace 0 to 27, an optional late fee', () => {
    const good = validateSchedule({
      amount_text: '1450',
      due_day_text: '1',
      grace_text: '5',
      late_fee_text: '50',
      start_date: '2026-11-01',
    });
    expect(good.errors).toEqual({});
    expect(good.value).toEqual({
      amount_cents: 145000,
      due_day: 1,
      grace_days: 5,
      late_fee_cents: 5000,
      start_date: '2026-11-01',
    });
    const no_fee = validateSchedule({
      ...good.value,
      amount_text: '10',
      due_day_text: '28',
      grace_text: '',
      late_fee_text: '',
      start_date: today,
    });
    expect(no_fee.errors).toEqual({});
    expect(no_fee.value.late_fee_cents).toBe(0);
    expect(no_fee.value.grace_days).toBe(0);
    const bad = validateSchedule({
      amount_text: '0',
      due_day_text: '31',
      grace_text: '40',
      late_fee_text: 'x',
      start_date: 'soon',
    });
    expect(Object.keys(bad.errors).sort()).toEqual([
      'amount',
      'due_day',
      'grace',
      'late_fee',
      'start_date',
    ]);
  });

  test('reasons are 3 to 300 characters', () => {
    expect(validateReason('no').error).toBeTruthy();
    expect(validateReason('  Bounced check ').value).toBe('Bounced check');
    expect(validateReason('Bounced check').error).toBeNull();
    expect(validateReason('x'.repeat(301)).error).toBeTruthy();
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ a: 'b' })).toBe(true);
  });
});

describe('receipts and timelines', () => {
  const ledger = { tenant_name: 'Sam Rivera', property_name: '123 Maple St', unit_label: 'Unit 2' };
  const payment = {
    id: 'pay-1',
    amount_cents: 145000,
    method: 'zelle',
    paid_on: '2026-10-02',
    applies_to: 'rent',
    is_refund: false,
    status: 'confirmed',
    note: 'October rent',
    events: [
      { type: 'confirmed', at: '2026-10-03T10:00:00.000Z' },
      { type: 'claimed', at: '2026-10-02T09:00:00.000Z' },
    ],
  };

  test('the receipt has every fact on its own line', () => {
    const text = buildReceiptText(payment, ledger, today);
    expect(text).toContain('Tenant: Sam Rivera');
    expect(text).toContain('Property: 123 Maple St, Unit 2');
    expect(text).toContain('Amount: $1,450.00');
    expect(text).toContain('Method: Zelle');
    expect(text).toContain('Status: Confirmed');
    expect(text).toContain('Note: October rent');
    expect(text).toContain('Reference: pay-1');
    expect(text).toContain('Made in Rent Well on 2026-10-14');
  });

  test('refunds, rejections, and voids say so', () => {
    expect(buildReceiptText({ ...payment, is_refund: true }, ledger, today)).toContain(
      'Amount: Refund of $1,450.00',
    );
    expect(
      buildReceiptText(
        { ...payment, status: 'rejected', reject_reason: 'Not received' },
        ledger,
        today,
      ),
    ).toContain('Rejected because: Not received');
  });

  test('the timeline is oldest first with words for each step', () => {
    expect(timelineFor(payment).map((event) => event.title)).toEqual([
      'Tenant said they paid',
      'Confirmed by the landlord',
    ]);
    expect(timelineFor({ events: undefined })).toEqual([]);
  });
});

describe('upcoming rent', () => {
  const { upcomingRent } = require('./ledgerHelpers');
  const schedule = {
    amount_cents: 120000,
    due_day: 1,
    grace_days: 5,
    late_fee_cents: 0,
    start_date: '2026-08-01',
  };
  test('the next schedule date, even when older rent is owed', () => {
    expect(upcomingRent({ schedule, tenancy_status: 'active' }, '2026-10-14')).toEqual({
      date: '2026-11-01',
      amount_cents: 120000,
    });
    expect(upcomingRent({ schedule, tenancy_status: 'ended' }, '2026-10-14')).toBeNull();
    expect(upcomingRent({ schedule: null }, '2026-10-14')).toBeNull();
  });
});

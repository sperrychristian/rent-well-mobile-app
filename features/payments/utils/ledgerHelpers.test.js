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
    expect(paymentPill('pending_confirmation').label).toBe('Waiting for confirmation');
    // every status the server can send has words, a line icon, and a readable tone, even the provider ones
    [
      'pending_confirmation',
      'pending',
      'processing',
      'succeeded',
      'failed',
      'returned',
      'rejected',
      'voided',
    ].forEach((status) => {
      const pill = paymentPill(status);
      expect(pill.label).not.toBe('Unknown');
      expect(pill.icon).toMatch(/-outline$/);
      const tone = toneColors(pill.tone);
      expect(meetsAA(tone.text, tone.tint)).toBe(true);
    });
    expect(chargePill('due_soon').label).toBe('Due soon');
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
      reference: '',
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
      validatePayment({ ...good_payment, amount_text: '1000001' }, today).errors.amount,
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

  test('reasons are 3 to 500 characters (the server allows 500)', () => {
    expect(validateReason('no').error).toBeTruthy();
    expect(validateReason('  Bounced check ').value).toBe('Bounced check');
    expect(validateReason('Bounced check').error).toBeNull();
    expect(validateReason('x'.repeat(500)).error).toBeNull();
    expect(validateReason('x'.repeat(501)).error).toBeTruthy();
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
    status: 'succeeded',
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

describe('home screen lines', () => {
  const { ownerPaymentsLine, tenantRentLine } = require('./ledgerHelpers');
  const { buildSampleLedgers } = require('../data/sampleLedger');
  const today = '2026-10-14';

  test('the landlord sees overdue first, then claims, then all paid up', () => {
    const ledgers = buildSampleLedgers(today);
    expect(ownerPaymentsLine(ledgers, today)).toMatchObject({ text: '1 overdue', tone: 'danger' });
    const no_sam = ledgers.filter((ledger) => ledger.tenancy_id !== 'demo-tenancy-sam');
    expect(ownerPaymentsLine(no_sam, today)).toMatchObject({
      text: '1 claim to review',
      claims: 1,
    });
    const alex = ledgers.filter((ledger) => ledger.tenancy_id === 'demo-tenancy-alex');
    expect(ownerPaymentsLine(alex, today).text).toBe('All paid up');
    expect(ownerPaymentsLine([], today).text).toBe('Set up rent');
  });

  test('the tenant sees overdue, due now, or the next rent date', () => {
    const ledgers = buildSampleLedgers(today);
    const find = (id) => ledgers.find((ledger) => ledger.tenancy_id === id);
    expect(tenantRentLine(find('demo-tenancy-sam'), today)).toEqual({
      text: '$2,000.00 overdue',
      tone: 'danger',
    });
    expect(tenantRentLine(find('demo-tenancy-priya'), today).text).toBe('Rent due now: $580.00');
    // Alex is $200 ahead, so the next rent shows what's actually left to pay
    expect(tenantRentLine(find('demo-tenancy-alex'), today).text).toBe('Rent due Nov 1: $780.00');
    expect(tenantRentLine(null, today).text).toBe('No rent set up yet');
  });
});

describe('behindSummary', () => {
  const { behindSummary } = require('./ledgerHelpers');
  const { buildSampleLedgers } = require('../data/sampleLedger');
  test('counts current tenants with overdue money and adds it up', () => {
    const today = '2026-10-14';
    const ledgers = buildSampleLedgers(today);
    expect(behindSummary(ledgers, today)).toEqual({ count: 1, cents: 200000 });
    expect(behindSummary([], today)).toEqual({ count: 0, cents: 0 });
  });
});

describe('status lines for the Hearth rows', () => {
  const { chargeStatusLine, paymentStatusLine } = require('./ledgerHelpers');
  const charge = { due_date: '2026-10-01', amount_cents: 120000, remaining_cents: 120000 };

  test('charges say when they were or are due', () => {
    expect(chargeStatusLine({ ...charge, status: 'overdue' })).toEqual({
      text: 'Overdue, was due Oct 1',
      tone: 'danger',
      icon: 'alert-circle-outline',
    });
    expect(chargeStatusLine({ ...charge, status: 'overdue', remaining_cents: 45000 }).text).toBe(
      'Overdue, $450.00 left, was due Oct 1',
    );
    expect(chargeStatusLine({ ...charge, status: 'paid', remaining_cents: 0 }).tone).toBe(
      'success',
    );
    expect(chargeStatusLine({ ...charge, status: 'upcoming' }).text).toBe('Due Oct 1');
    expect(chargeStatusLine({ ...charge, status: 'voided', void_reason: 'Typo' }).text).toBe(
      'Voided: Typo',
    );
  });

  test('payments say how and when', () => {
    const payment = { paid_on: '2026-09-02', method: 'zelle', is_refund: false };
    expect(paymentStatusLine({ ...payment, status: 'succeeded' }).text).toBe('Paid Sep 2 by Zelle');
    expect(paymentStatusLine({ ...payment, status: 'succeeded', is_refund: true }).text).toBe(
      'Refunded Sep 2 by Zelle',
    );
    expect(paymentStatusLine({ ...payment, status: 'pending_confirmation' }).tone).toBe('warning');
    expect(paymentStatusLine({ ...payment, status: 'processing' }).text).toBe(
      'Processing, started Sep 2 by Zelle',
    );
    expect(
      paymentStatusLine({ ...payment, status: 'failed', failure_reason: 'Insufficient funds' })
        .text,
    ).toBe('Failed: Insufficient funds');
    expect(paymentStatusLine({ ...payment, status: 'returned' }).tone).toBe('danger');
    expect(paymentStatusLine({ ...payment, status: 'rejected' }).tone).toBe('danger');
  });
});

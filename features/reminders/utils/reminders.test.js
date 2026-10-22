import {
  buildReminderText,
  firstName,
  formatLongDate,
  reminderTarget,
  reminderWindow,
  demoPreview,
  demoSend,
  fromApiPreview,
  isRentReminder,
  canSendLine,
} from './reminderHelpers';
import { buildSampleLedgers } from '../../payments/data/sampleLedger';

// the backend's own reminder cases (rent-well-api tests/reminderMath.test.js) against the app's port,
// with the ledgers in the app's shape, plus the demo routes' rules and error codes

let sequence = 0;
const charge = (due_date, amount_cents, extra) => {
  sequence += 1;
  return {
    id: 'c-' + sequence,
    created_at: '2026-01-01T00:00:00.' + String(sequence).padStart(3, '0') + 'Z',
    kind: 'rent',
    amount_cents,
    due_date,
    voided_at: null,
    ...(extra || {}),
  };
};
const payment = (paid_on, amount_cents, extra) => {
  sequence += 1;
  return {
    id: 'p-' + sequence,
    created_at: '2026-01-01T00:00:00.' + String(sequence).padStart(3, '0') + 'Z',
    applies_to: 'rent',
    is_refund: false,
    status: 'succeeded',
    amount_cents,
    paid_on,
    ...(extra || {}),
  };
};
const ledgerOf = (charges, payments) => ({
  tenancy_id: 't1',
  tenancy_status: 'active',
  tenant_name: 'Tara Jean Tenant',
  property_name: 'Maple Court',
  unit_label: 'Unit 2B',
  schedule: null,
  charges,
  payments,
});

const base = {
  tenant_name: 'Tara Jean Tenant',
  amount_cents: 145000,
  due_on: '2026-10-01',
  payment_instructions: 'Zelle to owner@example.com',
  property_name: 'Maple Court',
  unit_label: 'Unit 2B',
};

describe('buildReminderText (backend vectors)', () => {
  test('friendly: warm, first name, dollars with cents, due date, how to pay', () => {
    expect(buildReminderText({ ...base, kind: 'friendly' })).toBe(
      'Hi Tara, just a friendly reminder that your balance of $1,450.00 for Maple Court, Unit 2B was due October 1. How to pay: Zelle to owner@example.com. If you have already sent it, you can mark it paid in the app. Thanks so much!',
    );
  });

  test('overdue notice: firm but polite', () => {
    expect(buildReminderText({ ...base, kind: 'overdue_notice', amount_cents: 5 })).toBe(
      'Hi Tara, your balance of $0.05 for Maple Court, Unit 2B is past due. It was due October 1. Please send payment as soon as possible. How to pay: Zelle to owner@example.com. If you have already paid, please mark it paid in the app so I can confirm it. Thank you.',
    );
  });

  test('no instructions and no unit', () => {
    const text = buildReminderText({
      ...base,
      kind: 'friendly',
      payment_instructions: null,
      unit_label: null,
    });
    expect(text).toContain(
      'for Maple Court was due October 1. You can pay the way you usually do.',
    );
  });

  test('long instructions get shortened, the amount and date never do', () => {
    const text = buildReminderText({
      ...base,
      kind: 'overdue_notice',
      payment_instructions: 'x'.repeat(1000),
    });
    expect(text.length).toBeLessThanOrEqual(600);
    expect(text).toContain('$1,450.00');
    expect(text).toContain('October 1');
    expect(text).toContain('…');
    expect(text.endsWith('Thank you.')).toBe(true);
  });

  test('names and dates', () => {
    expect(firstName('  Rory   Roommate ')).toBe('Rory');
    expect(firstName('')).toBe('there');
    expect(formatLongDate('2026-12-31')).toBe('December 31');
    expect(formatLongDate('2027-01-01')).toBe('January 1');
  });
});

describe('reminderTarget (backend vectors)', () => {
  test('the balance owed by today and the oldest unpaid charge', () => {
    const sept = charge('2026-09-01', 100000);
    const oct = charge('2026-10-01', 100000);
    const nov = charge('2026-11-01', 100000);
    const target = reminderTarget(
      ledgerOf([nov, oct, sept], [payment('2026-09-02', 40000)]),
      '2026-10-22',
    );
    expect(target.amount_cents).toBe(160000);
    expect(target.charge.id).toBe(sept.id);
  });

  test('nothing owed: paid up or only future charges', () => {
    expect(
      reminderTarget(
        ledgerOf([charge('2026-10-01', 1000)], [payment('2026-10-01', 1000)]),
        '2026-10-22',
      ),
    ).toBeNull();
    expect(reminderTarget(ledgerOf([charge('2026-11-01', 1000)], []), '2026-10-22')).toBeNull();
  });

  test('voided charges and pending claims do not change what is owed', () => {
    const target = reminderTarget(
      ledgerOf(
        [
          charge('2026-10-01', 1000, { voided_at: '2026-10-02T00:00:00Z' }),
          charge('2026-10-05', 2000),
        ],
        [payment('2026-10-06', 2000, { status: 'pending_confirmation' })],
      ),
      '2026-10-22',
    );
    expect(target.amount_cents).toBe(2000);
    expect(target.charge.due_date).toBe('2026-10-05');
  });

  test('an unpaid deposit counts, a charge due today counts', () => {
    expect(
      reminderTarget(ledgerOf([charge('2026-10-22', 1500, { kind: 'deposit' })], []), '2026-10-22')
        .amount_cents,
    ).toBe(1500);
  });
});

describe('the 24 hour window', () => {
  test('exactly 24 hours later is allowed, a minute before is not', () => {
    const sent = '2026-10-20T16:04:00.000Z';
    expect(reminderWindow(null, new Date())).toEqual({ can_send: true, can_send_at: null });
    expect(reminderWindow(sent, new Date('2026-10-21T16:03:00.000Z'))).toEqual({
      can_send: false,
      can_send_at: '2026-10-21T16:04:00.000Z',
    });
    expect(reminderWindow(sent, new Date('2026-10-21T16:04:00.000Z')).can_send).toBe(true);
    expect(canSendLine('2026-10-21T16:04:00.000Z')).toMatch(
      /^You can send the next one Oct 21 at /,
    );
  });
});

describe('the demo routes', () => {
  const today = new Date().toISOString().slice(0, 10);
  const ledgers = buildSampleLedgers(today);
  const sam = ledgers.find((ledger) => ledger.tenancy_id === 'demo-tenancy-sam');
  const now = new Date();

  test('a preview for a tenant who owes, with the suggested words', () => {
    const preview = demoPreview(sam, [], 'friendly', 'Zelle to the landlord', now, today);
    expect(preview.amount_cents).toBeGreaterThan(0);
    expect(preview.can_send_now).toBe(true);
    expect(preview.message_text).toContain('Hi Sam, just a friendly reminder');
    expect(preview.message_text).toContain('How to pay: Zelle to the landlord.');
  });

  test('sending twice in a day is REMINDER_TOO_SOON with when it can go again', () => {
    const first = demoSend(sam, [], 'overdue_notice', 'Please pay', '', now, today);
    expect(first.message_text).toBe('Please pay');
    let caught = null;
    try {
      demoSend(sam, [first.entry], 'friendly', undefined, '', now, today);
    } catch (error) {
      caught = error;
    }
    expect(caught.code).toBe('REMINDER_TOO_SOON');
    expect(caught.info.canSendAt).toBe(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
  });

  test('nothing owed and an ended tenancy have the server codes', () => {
    const paid = ledgerOf([charge(today, 1000)], [payment(today, 1000)]);
    expect(() => demoPreview(paid, [], 'friendly', '', now, today)).toThrow(
      expect.objectContaining({ code: 'NOTHING_OWED' }),
    );
    expect(() =>
      demoPreview({ ...sam, tenancy_status: 'ended' }, [], 'friendly', '', now, today),
    ).toThrow(expect.objectContaining({ code: 'NO_ACTIVE_TENANCY' }));
    expect(() => demoSend(sam, [], 'friendly', '   ', '', now, today)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  test('the server preview maps across and a reminder message is recognized', () => {
    expect(
      fromApiPreview({
        kind: 'friendly',
        messageText: 'Hi',
        amountCents: 145000,
        chargeId: 'c',
        dueOn: '2026-10-01',
        lastReminderAt: '2026-10-20T16:04:00.000Z',
        canSendNow: false,
        canSendAt: '2026-10-21T16:04:00.000Z',
      }),
    ).toEqual({
      kind: 'friendly',
      message_text: 'Hi',
      amount_cents: 145000,
      charge_id: 'c',
      due_on: '2026-10-01',
      last_reminder_at: '2026-10-20T16:04:00.000Z',
      can_send_now: false,
      can_send_at: '2026-10-21T16:04:00.000Z',
    });
    expect(isRentReminder({ metadata: { type: 'rent_reminder' } })).toBe(true);
    expect(isRentReminder({ metadata: null })).toBe(false);
  });
});

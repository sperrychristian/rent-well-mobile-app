import { buildSampleLedgers, buildSampleInstructions } from '../data/sampleLedger';
import {
  demoCreatePayment,
  demoConfirmPayment,
  demoRejectPayment,
  demoVoidPayment,
  demoAddCharge,
  demoVoidCharge,
  demoSetSchedule,
} from './demoLedger';
import { deriveLedger } from './ledgerMath';
import { apiLedger, apiPayment, apiSummary } from './ledgerApiFixtures';
import {
  fromApiLedger,
  fromApiSummary,
  toApiClaim,
  makeIdempotencyKey,
  toApiPayment,
  toApiSchedule,
  toApiCharge,
  replaceLedger,
  findPayment,
} from './ledgerApi';

const now = '2026-10-14T15:00:00.000Z';
let next_id = 0;
function makeId() {
  next_id++;
  return 'test-' + next_id;
}

function derived(ledgers, tenancy_id, today) {
  return deriveLedger(
    ledgers.find((ledger) => ledger.tenancy_id === tenancy_id),
    today,
  );
}

// the demo story has to hold up no matter what day the demo runs
describe('sample ledgers tell the same story any day', () => {
  ['2026-10-14', '2026-11-01', '2027-01-31', '2026-03-29', '2028-02-28'].forEach((today) => {
    test(today, () => {
      const ledgers = buildSampleLedgers(today);
      expect(ledgers.map((ledger) => ledger.tenancy_id)).toEqual([
        'demo-tenancy-sam',
        'demo-tenancy-jordan',
        'demo-tenancy-priya',
        'demo-tenancy-alex',
        'demo-tenancy-morgan',
      ]);
      const sam = derived(ledgers, 'demo-tenancy-sam', today);
      expect(sam.row_status).toBe('overdue');
      expect(sam.charges.some((charge) => charge.kind === 'late_fee')).toBe(true);
      expect(derived(ledgers, 'demo-tenancy-jordan', today).row_status).toBe('pending');
      const priya = derived(ledgers, 'demo-tenancy-priya', today);
      expect(priya.row_status).toBe('due');
      expect(priya.charges[0].status).toBe('partial');
      const alex = derived(ledgers, 'demo-tenancy-alex', today);
      expect(alex.row_status).toBe('credit');
      expect(alex.balance_cents).toBe(-20000);
      const morgan = derived(ledgers, 'demo-tenancy-morgan', today);
      expect(morgan.balance_cents).toBe(0);
      expect(morgan.deposit_held_cents).toBe(0);
      // nothing is ever dated after today
      ledgers.forEach((ledger) =>
        ledger.payments.forEach((payment) => expect(payment.paid_on <= today).toBe(true)),
      );
      // every amount is whole cents
      ledgers.forEach((ledger) =>
        [...ledger.charges, ...ledger.payments].forEach((item) =>
          expect(Number.isSafeInteger(item.amount_cents)).toBe(true),
        ),
      );
    });
  });

  test('every demo property has payment instructions', () => {
    const instructions = buildSampleInstructions();
    expect(Object.keys(instructions).sort()).toEqual(['demo-prop-cedar', 'demo-prop-maple']);
  });
});

describe('demo actions', () => {
  const today = '2026-10-14';

  test('tenant claims, landlord confirms, and the balance drops by exactly that much', () => {
    let ledgers = buildSampleLedgers(today);
    const before = derived(ledgers, 'demo-tenancy-sam', today).balance_cents;
    const claim = demoCreatePayment(
      ledgers,
      'demo-tenancy-sam',
      { amount_cents: 45000, method: 'zelle', paid_on: today, applies_to: 'rent', note: '' },
      'tenant',
      now,
      today,
      makeId,
    );
    ledgers = claim.ledgers;
    expect(claim.payment.status).toBe('pending_confirmation');
    expect(claim.payment.source).toBe('tenant');
    // a claim doesn't move the balance until it's confirmed
    expect(derived(ledgers, 'demo-tenancy-sam', today).balance_cents).toBe(before);
    const confirmed = demoConfirmPayment(ledgers, claim.payment.id, now, today);
    expect(confirmed.payment.status).toBe('succeeded');
    expect(confirmed.payment.events.map((e) => e.type)).toEqual(['claimed', 'confirmed']);
    expect(derived(confirmed.ledgers, 'demo-tenancy-sam', today).balance_cents).toBe(
      before - 45000,
    );
    // a second confirm is turned away like the server would
    expect(() => demoConfirmPayment(confirmed.ledgers, claim.payment.id, now, today)).toThrow(
      /already confirmed/,
    );
  });

  test('reject keeps the reason and never moves the balance', () => {
    const ledgers = buildSampleLedgers(today);
    const before = derived(ledgers, 'demo-tenancy-jordan', today).balance_cents;
    const result = demoRejectPayment(ledgers, 'demo-pay-jordan-claim', 'Not received', now, today);
    expect(result.payment.status).toBe('rejected');
    expect(result.payment.reject_reason).toBe('Not received');
    expect(derived(result.ledgers, 'demo-tenancy-jordan', today).balance_cents).toBe(before);
    // the key fob isn't due yet, so once the claim is gone Jordan is all paid up
    expect(derived(result.ledgers, 'demo-tenancy-jordan', today).row_status).toBe('paid');
  });

  test('owner records a payment (confirmed right away) and can void it', () => {
    let ledgers = buildSampleLedgers(today);
    const before = derived(ledgers, 'demo-tenancy-priya', today).balance_cents;
    const recorded = demoCreatePayment(
      ledgers,
      'demo-tenancy-priya',
      { amount_cents: 58000, method: 'cash', paid_on: today, applies_to: 'rent', note: 'Rest' },
      'owner',
      now,
      today,
      makeId,
    );
    expect(recorded.payment.status).toBe('succeeded');
    ledgers = recorded.ledgers;
    expect(derived(ledgers, 'demo-tenancy-priya', today).balance_cents).toBe(before - 58000);
    expect(derived(ledgers, 'demo-tenancy-priya', today).row_status).toBe('paid');
    const voided = demoVoidPayment(ledgers, recorded.payment.id, 'Check bounced', now, today);
    expect(voided.payment.void_reason).toBe('Check bounced');
    expect(derived(voided.ledgers, 'demo-tenancy-priya', today).balance_cents).toBe(before);
    // voiding twice is the server's PAYMENT_NOT_VOIDABLE now
    expect(() => demoVoidPayment(voided.ledgers, recorded.payment.id, 'x', now, today)).toThrow(
      /Only a confirmed payment/,
    );
  });

  test('tenants cannot refund, and a former tenant cannot claim', () => {
    const ledgers = buildSampleLedgers(today);
    const value = { amount_cents: 100, method: 'cash', paid_on: today, applies_to: 'rent' };
    expect(() =>
      demoCreatePayment(
        ledgers,
        'demo-tenancy-sam',
        { ...value, is_refund: true },
        'tenant',
        now,
        today,
        makeId,
      ),
    ).toThrow(/landlord can record a refund/);
    expect(() =>
      demoCreatePayment(ledgers, 'demo-tenancy-morgan', value, 'tenant', now, today, makeId),
    ).toThrow(/read-only/);
  });

  test('charges add to the balance and voiding takes them back off', () => {
    const ledgers = buildSampleLedgers(today);
    const before = derived(ledgers, 'demo-tenancy-alex', today).balance_cents;
    const added = demoAddCharge(
      ledgers,
      'demo-tenancy-alex',
      { kind: 'other', description: 'Lockout', amount_cents: 7500, due_date: today },
      now,
      today,
      makeId,
    );
    const charge = added.ledger.charges[added.ledger.charges.length - 1];
    expect(derived(added.ledgers, 'demo-tenancy-alex', today).balance_cents).toBe(before + 7500);
    const voided = demoVoidCharge(added.ledgers, charge.id, 'Added by mistake', now, today);
    expect(derived(voided.ledgers, 'demo-tenancy-alex', today).balance_cents).toBe(before);
    expect(() => demoVoidCharge(voided.ledgers, charge.id, 'again', now, today)).toThrow(
      /already voided/,
    );
    // the real server takes a charge on an ended tenancy (move-out damage), so the demo does too
    const on_ended = demoAddCharge(
      ledgers,
      'demo-tenancy-morgan',
      { kind: 'other', description: 'Carpet cleaning', amount_cents: 15000, due_date: today },
      now,
      today,
      makeId,
    );
    expect(on_ended.ledger.charges.some((item) => item.description === 'Carpet cleaning')).toBe(
      true,
    );
  });

  test('a schedule change keeps rent already charged and uses the new amount from its start', () => {
    const ledgers = buildSampleLedgers(today);
    const result = demoSetSchedule(
      ledgers,
      'demo-tenancy-alex',
      {
        amount_cents: 100000,
        due_day: 1,
        grace_days: 3,
        late_fee_cents: 4000,
        start_date: '2026-11-01',
      },
      '2026-11-02',
    );
    const rent = result.ledger.charges.filter((charge) => charge.kind === 'rent');
    expect(rent.find((charge) => charge.due_date === '2026-10-01').amount_cents).toBe(98000);
    expect(rent.find((charge) => charge.due_date === '2026-11-01').amount_cents).toBe(100000);
  });
});

describe('api mapping (the real server shapes in docs/API.md)', () => {
  test('a server ledger turns into the app shape and keeps the server math as is', () => {
    const ledger = fromApiLedger(apiLedger());
    expect(ledger).toMatchObject({
      tenancy_id: 'ten-1',
      tenancy_status: 'active',
      tenant_name: 'Tara Tenant',
      property_id: 'prop-1',
      property_name: 'Maple Court',
      unit_label: 'Unit 2B',
      payment_instructions: 'Zelle to owner@example.com',
      today: '2026-10-14',
    });
    expect(ledger.schedule).toMatchObject({
      amount_cents: 120000,
      due_day: 1,
      grace_days: 5,
      late_fee_cents: 5000,
      start_date: '2026-08-01',
    });
    expect(ledger.charges[0]).toMatchObject({
      due_date: '2026-10-01',
      overdue_on: '2026-10-07',
      status: 'overdue',
      remaining_cents: 120000,
    });
    const claim = ledger.payments[0];
    expect(claim).toMatchObject({
      status: 'pending_confirmation',
      source: 'tenant',
      is_refund: false,
      counts: false,
    });
    expect(ledger.payments[2].reference).toBe('1042');
    // deriveLedger hands back the server's numbers instead of working them out again
    const derived = deriveLedger(ledger, '2030-01-01');
    expect(derived).toMatchObject({
      balance_cents: 120000,
      overdue_count: 1,
      overdue_cents: 120000,
      deposit_held_cents: 120000,
      pending_cents: 7500,
      next_due: null,
      row_status: 'overdue',
    });
    expect(derived.pending_payments.map((payment) => payment.id)).toEqual(['pay-claim']);
    expect(findPayment([ledger], 'pay-claim').ledger.tenancy_id).toBe('ten-1');
    expect(findPayment([ledger], 'nope')).toBeNull();
    expect(replaceLedger([ledger], { ...ledger, tenant_name: 'T' })[0].tenant_name).toBe('T');
    expect(replaceLedger([], ledger)).toHaveLength(1);
  });

  test('an ended tenancy, a refund, and a next due date map across', () => {
    const ledger = fromApiLedger(
      apiLedger({
        isActive: false,
        balances: { ...apiLedger().balances, nextDue: { dueOn: '2026-11-01', amountCents: 50000 } },
        payments: [apiPayment('pay-r', { kind: 'refund', appliesTo: 'deposit' })],
      }),
    );
    expect(ledger.tenancy_status).toBe('ended');
    expect(ledger.payments[0].is_refund).toBe(true);
    expect(deriveLedger(ledger).next_due).toEqual({ date: '2026-11-01', amount_cents: 50000 });
  });

  test('the month summary maps to the owner screen and can pick one property', () => {
    expect(fromApiSummary(apiSummary(), [])).toMatchObject({
      expected_cents: 120000,
      collected_cents: 0,
      outstanding_cents: 120000,
      overdue_count: 1,
      pending_count: 1,
    });
    expect(fromApiSummary(apiSummary(), [], 'nope').expected_cents).toBe(0);
    expect(fromApiSummary(apiSummary(), [], 'prop-1').overdue_cents).toBe(120000);
  });

  test('request bodies match the real routes', () => {
    const value = {
      amount_cents: 5,
      method: 'cash',
      paid_on: '2026-10-01',
      applies_to: 'rent',
      is_refund: false,
      note: '',
      reference: 'CK-1',
      receipt_key: 'attachments/u/1.jpg',
      idempotency_key: 'rw-abc12345',
    };
    expect(toApiPayment(value)).toEqual({
      kind: 'payment',
      appliesTo: 'rent',
      amountCents: 5,
      method: 'cash',
      paidOn: '2026-10-01',
      reference: 'CK-1',
      receiptPhotoKey: 'attachments/u/1.jpg',
      idempotencyKey: 'rw-abc12345',
    });
    expect(toApiPayment({ ...value, is_refund: true }).kind).toBe('refund');
    expect(toApiClaim('ten-1', value)).toEqual({
      tenancyId: 'ten-1',
      appliesTo: 'rent',
      amountCents: 5,
      method: 'cash',
      paidOn: '2026-10-01',
      reference: 'CK-1',
      receiptPhotoKey: 'attachments/u/1.jpg',
      idempotencyKey: 'rw-abc12345',
    });
    expect(
      toApiSchedule({
        amount_cents: 1,
        due_day: 2,
        grace_days: 3,
        late_fee_cents: 4,
        start_date: 'd',
      }),
    ).toEqual({ amountCents: 1, dueDay: 2, graceDays: 3, lateFeeCents: 4, startsOn: 'd' });
    expect(
      toApiCharge({ kind: 'other', description: 'x', amount_cents: 1, due_date: 'd' }),
    ).toEqual({ kind: 'other', description: 'x', amountCents: 1, dueOn: 'd' });
    expect(makeIdempotencyKey().length).toBeGreaterThanOrEqual(8);
    expect(makeIdempotencyKey()).not.toBe(makeIdempotencyKey());
  });
});

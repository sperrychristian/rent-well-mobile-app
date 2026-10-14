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
import {
  fromApiLedger,
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
    expect(claim.payment.status).toBe('pending');
    expect(claim.payment.source).toBe('tenant');
    // a claim doesn't move the balance until it's confirmed
    expect(derived(ledgers, 'demo-tenancy-sam', today).balance_cents).toBe(before);
    const confirmed = demoConfirmPayment(ledgers, claim.payment.id, now, today);
    expect(confirmed.payment.status).toBe('confirmed');
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
    expect(recorded.payment.status).toBe('confirmed');
    ledgers = recorded.ledgers;
    expect(derived(ledgers, 'demo-tenancy-priya', today).balance_cents).toBe(before - 58000);
    expect(derived(ledgers, 'demo-tenancy-priya', today).row_status).toBe('paid');
    const voided = demoVoidPayment(ledgers, recorded.payment.id, 'Check bounced', now, today);
    expect(voided.payment.void_reason).toBe('Check bounced');
    expect(derived(voided.ledgers, 'demo-tenancy-priya', today).balance_cents).toBe(before);
    expect(() => demoVoidPayment(voided.ledgers, recorded.payment.id, 'x', now, today)).toThrow(
      /already voided/,
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
    expect(() =>
      demoAddCharge(
        ledgers,
        'demo-tenancy-morgan',
        { kind: 'other', description: 'x', amount_cents: 1, due_date: today },
        now,
        today,
        makeId,
      ),
    ).toThrow(/already ended/);
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

describe('api mapping', () => {
  test('a server ledger turns into the app shape', () => {
    const ledger = fromApiLedger({
      tenancyId: 't1',
      tenancyStatus: 'active',
      tenantId: 'u1',
      tenantName: 'Sam',
      propertyId: 'p1',
      propertyName: '123 Maple St',
      unitLabel: 'Unit 2',
      paymentInstructions: 'Zelle',
      schedule: {
        amountCents: 120000,
        dueDay: 1,
        graceDays: 5,
        lateFeeCents: 5000,
        startDate: '2026-08-01',
      },
      charges: [
        {
          id: 'c1',
          kind: 'rent',
          description: 'Rent',
          amountCents: 120000,
          dueDate: '2026-10-01T00:00:00.000Z',
          voidedAt: null,
        },
      ],
      payments: [
        {
          id: 'p1',
          amountCents: 120000,
          method: 'zelle',
          paidOn: '2026-10-02',
          appliesTo: 'rent',
          isRefund: false,
          status: 'pending',
          source: 'tenant',
          events: [{ type: 'claimed', at: now, byRole: 'tenant' }],
        },
      ],
    });
    expect(ledger.schedule.amount_cents).toBe(120000);
    expect(ledger.charges[0].due_date).toBe('2026-10-01');
    expect(ledger.payments[0].events[0].by_role).toBe('tenant');
    expect(ledger.payment_instructions).toBe('Zelle');
    expect(findPayment([ledger], 'p1').ledger.tenancy_id).toBe('t1');
    expect(findPayment([ledger], 'nope')).toBeNull();
    expect(replaceLedger([ledger], { ...ledger, tenant_name: 'S' })[0].tenant_name).toBe('S');
    expect(replaceLedger([], ledger)).toHaveLength(1);
  });

  test('request bodies are camelCase', () => {
    expect(
      toApiPayment({
        amount_cents: 5,
        method: 'cash',
        paid_on: '2026-10-01',
        applies_to: 'rent',
        is_refund: false,
        note: '',
      }),
    ).toEqual({
      amountCents: 5,
      method: 'cash',
      paidOn: '2026-10-01',
      appliesTo: 'rent',
      isRefund: false,
      note: '',
    });
    expect(
      toApiSchedule({
        amount_cents: 1,
        due_day: 2,
        grace_days: 3,
        late_fee_cents: 4,
        start_date: 'd',
      }),
    ).toEqual({
      amountCents: 1,
      dueDay: 2,
      graceDays: 3,
      lateFeeCents: 4,
      startDate: 'd',
    });
    expect(
      toApiCharge({ kind: 'other', description: 'x', amount_cents: 1, due_date: 'd' }).amountCents,
    ).toBe(1);
  });
});

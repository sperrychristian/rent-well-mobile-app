import {
  backend_ledger_cases,
  backend_status_no_grace,
  backend_status_five_grace,
  backend_status_order,
} from './backendVectors';
import { deriveLedger, chargeStatus } from './ledgerMath';

// the backend's own cases (copied in backendVectors.js) run through the demo's local math,
// so the demo shows the same numbers the real server would

// the server's db rows into the app's local ledger shape
function toAppLedger(test_case) {
  const grace = Math.max(0, ...test_case.charges.map((charge) => charge.grace_days || 0));
  return {
    tenancy_id: 't1',
    tenancy_status: 'active',
    schedule: grace ? { grace_days: grace } : null,
    charges: test_case.charges.map((charge) => ({
      id: charge.id,
      kind: charge.kind,
      description: charge.kind,
      amount_cents: charge.amount_cents,
      due_date: charge.due_on,
      created_at: charge.created_at,
      voided_at: charge.voided_at,
      void_reason: '',
    })),
    payments: test_case.payments.map((payment) => ({
      id: payment.id,
      amount_cents: payment.amount_cents,
      applies_to: payment.applies_to,
      is_refund: payment.kind === 'refund',
      status: payment.status,
      paid_on: payment.paid_on,
      created_at: payment.created_at,
    })),
  };
}

// the server's balance names into the ones deriveLedger gives back
function toAppBalances(balances) {
  const names = {
    rent_balance_cents: 'balance_cents',
    credit_cents: 'credit_cents',
    overdue_cents: 'overdue_cents',
    overdue_count: 'overdue_count',
    deposit_held_cents: 'deposit_held_cents',
    deposit_owed_cents: 'deposit_due_cents',
    pending_confirmation_cents: 'pending_cents',
  };
  const out = {};
  Object.keys(balances).forEach((key) => {
    if (key === 'next_due') {
      out.next_due = balances.next_due
        ? { date: balances.next_due.due_on, amount_cents: balances.next_due.amount_cents }
        : null;
    } else {
      out[names[key]] = balances[key];
    }
  });
  return out;
}

describe('the backend ledger cases give the same numbers locally', () => {
  test.each(backend_ledger_cases.map((test_case) => [test_case.name, test_case]))(
    '%s',
    (name, test_case) => {
      const derived = deriveLedger(toAppLedger(test_case), test_case.today);
      if (test_case.expect_balances) {
        expect(derived).toMatchObject(toAppBalances(test_case.expect_balances));
      }
      (test_case.expect_charges || []).forEach((expected, index) => {
        const id = test_case.charges[index].id;
        const charge = derived.charges.find((item) => item.id === id);
        expect({ index, ...charge }).toMatchObject({ index, ...expected });
      });
    },
  );

  test('a paid-up balance is exactly 0, never -0', () => {
    const paid_up = backend_ledger_cases.find((item) => item.name.startsWith('a paid-up'));
    const derived = deriveLedger(toAppLedger(paid_up), paid_up.today);
    expect(Object.is(derived.balance_cents, 0)).toBe(true);
  });
});

describe('the backend charge status table', () => {
  const rent = { kind: 'rent', amount_cents: 100000, due_date: '2026-10-01' };

  test.each(backend_status_no_grace)('no grace: on %s it is %s', (today, status) => {
    expect(chargeStatus(rent, rent.amount_cents, today, 0)).toBe(status);
  });

  test.each(backend_status_five_grace)('5 grace days: on %s it is %s', (today, status) => {
    expect(chargeStatus(rent, rent.amount_cents, today, 5)).toBe(status);
  });

  test.each(backend_status_order)('paid %s on %s is %s', (paid_cents, today, status) => {
    expect(chargeStatus(rent, rent.amount_cents - paid_cents, today, 0)).toBe(status);
  });

  test('voided wins over everything', () => {
    expect(chargeStatus({ ...rent, voided_at: '2026-10-02T00:00:00Z' }, 0, '2026-10-05', 0)).toBe(
      'voided',
    );
  });
});

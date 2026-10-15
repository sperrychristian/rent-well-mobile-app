// the demo's version of every ledger action, with the same rules, status names, and error codes as the
// real server in docs/API.md
// each one takes the list of ledgers and gives back { ledgers, ledger } with the changed ledger brought up to date
// pure, so the tests can run the whole claim, confirm, and void story with no server
import { parseApiError } from '../../../services/apiHelpers';
import { syncLedger } from './ledgerMath';

// the same friendly message the app shows for the real error
function demoError(status, code) {
  return parseApiError(status, { error: { code: code, message: code } });
}

function findLedger(ledgers, tenancy_id) {
  const ledger = ledgers.find((item) => item.tenancy_id === tenancy_id);
  if (!ledger) {
    throw demoError(404, 'NOT_FOUND');
  }
  return ledger;
}

function findPaymentLedger(ledgers, payment_id) {
  const ledger = ledgers.find((item) => (item.payments || []).some((p) => p.id === payment_id));
  if (!ledger) {
    throw demoError(404, 'NOT_FOUND');
  }
  return ledger;
}

// swaps in the changed ledger and runs the schedule again so new rent or late fees show up
function save(ledgers, changed, today) {
  const ledger = syncLedger(changed, today);
  return {
    ledgers: ledgers.map((item) => (item.tenancy_id === ledger.tenancy_id ? ledger : item)),
    ledger: ledger,
  };
}

function event(type, by_role, at, reason) {
  return { type: type, at: at, by_role: by_role, reason: reason || '' };
}

// value comes from validatePayment, role is who's doing it, owner payments are confirmed right away
export function demoCreatePayment(ledgers, tenancy_id, value, role, now, today, makeId) {
  const ledger = findLedger(ledgers, tenancy_id);
  if (role === 'tenant' && ledger.tenancy_status === 'ended') {
    throw demoError(403, 'NO_ACTIVE_TENANCY');
  }
  if (role === 'tenant' && value.is_refund) {
    // the server's claim route has no refund kind at all, so it's a validation error there
    throw parseApiError(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Only your landlord can record a refund.' },
    });
  }
  const is_owner = role === 'owner';
  const payment = {
    id: makeId(),
    amount_cents: value.amount_cents,
    method: value.method,
    paid_on: value.paid_on,
    applies_to: value.applies_to,
    is_refund: is_owner && !!value.is_refund,
    note: value.note || '',
    receipt_key: value.receipt_key || null,
    reference: value.reference || '',
    status: is_owner ? 'succeeded' : 'pending_confirmation',
    source: is_owner ? 'owner' : 'tenant',
    reject_reason: '',
    void_reason: '',
    created_at: now,
    events: [
      event(
        is_owner ? (value.is_refund ? 'refund_recorded' : 'payment_recorded') : 'claimed',
        role,
        now,
      ),
    ],
  };
  const result = save(ledgers, { ...ledger, payments: [...ledger.payments, payment] }, today);
  return { ...result, payment: payment };
}

// confirm, reject, and void only work on the right status, so a double tap or a stale screen gets a clear error
function changePayment(ledgers, payment_id, today, change) {
  const ledger = findPaymentLedger(ledgers, payment_id);
  const payments = ledger.payments.map((item) => (item.id === payment_id ? change(item) : item));
  const result = save(ledgers, { ...ledger, payments: payments }, today);
  return { ...result, payment: payments.find((item) => item.id === payment_id) };
}

export function demoConfirmPayment(ledgers, payment_id, now, today) {
  return changePayment(ledgers, payment_id, today, (payment) => {
    if (payment.status !== 'pending_confirmation') {
      throw demoError(409, 'PAYMENT_NOT_PENDING');
    }
    return {
      ...payment,
      status: 'succeeded',
      events: [...payment.events, event('confirmed', 'owner', now)],
    };
  });
}

export function demoRejectPayment(ledgers, payment_id, reason, now, today) {
  return changePayment(ledgers, payment_id, today, (payment) => {
    if (payment.status !== 'pending_confirmation') {
      throw demoError(409, 'PAYMENT_NOT_PENDING');
    }
    return {
      ...payment,
      status: 'rejected',
      reject_reason: reason,
      events: [...payment.events, event('rejected', 'owner', now, reason)],
    };
  });
}

// voiding takes a confirmed payment back out (a bounced check, a typo), the record stays with its reason
export function demoVoidPayment(ledgers, payment_id, reason, now, today) {
  return changePayment(ledgers, payment_id, today, (payment) => {
    // the server only voids a confirmed hand-recorded payment, anything else is PAYMENT_NOT_VOIDABLE
    if (payment.status !== 'succeeded') {
      throw demoError(409, 'PAYMENT_NOT_VOIDABLE');
    }
    return {
      ...payment,
      status: 'voided',
      void_reason: reason,
      events: [...payment.events, event('voided', 'owner', now, reason)],
    };
  });
}

// value comes from validateCharge
// (the server takes charges on ended tenancies too, like move-out damage, so the demo does as well)
export function demoAddCharge(ledgers, tenancy_id, value, now, today, makeId) {
  const ledger = findLedger(ledgers, tenancy_id);
  const charge = {
    id: makeId(),
    kind: value.kind,
    description: value.description,
    amount_cents: value.amount_cents,
    due_date: value.due_date,
    created_at: now,
    voided_at: null,
    void_reason: '',
  };
  return save(ledgers, { ...ledger, charges: [...ledger.charges, charge] }, today);
}

export function demoVoidCharge(ledgers, charge_id, reason, now, today) {
  const ledger = ledgers.find((item) => (item.charges || []).some((c) => c.id === charge_id));
  if (!ledger) {
    throw demoError(404, 'NOT_FOUND');
  }
  const charges = ledger.charges.map((charge) => {
    if (charge.id !== charge_id) {
      return charge;
    }
    if (charge.voided_at) {
      throw demoError(409, 'ALREADY_VOIDED');
    }
    return { ...charge, voided_at: now, void_reason: reason };
  });
  return save(ledgers, { ...ledger, charges: charges }, today);
}

// a new schedule only adds rent from its start date on, rent already charged keeps its old amount
export function demoSetSchedule(ledgers, tenancy_id, value, today) {
  const ledger = findLedger(ledgers, tenancy_id);
  if (ledger.tenancy_status === 'ended') {
    throw demoError(409, 'TENANCY_ENDED');
  }
  return save(ledgers, { ...ledger, schedule: { ...value } }, today);
}

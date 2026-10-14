// the demo's version of every ledger action, with the same rules and error codes as the draft server
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
    throw demoError(400, 'REFUND_NOT_ALLOWED');
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
    status: is_owner ? 'confirmed' : 'pending',
    source: is_owner ? 'owner' : 'tenant',
    reject_reason: '',
    void_reason: '',
    created_at: now,
    events: [event(is_owner ? 'recorded' : 'claimed', role, now)],
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
    if (payment.status !== 'pending') {
      throw demoError(409, 'PAYMENT_NOT_PENDING');
    }
    return {
      ...payment,
      status: 'confirmed',
      events: [...payment.events, event('confirmed', 'owner', now)],
    };
  });
}

export function demoRejectPayment(ledgers, payment_id, reason, now, today) {
  return changePayment(ledgers, payment_id, today, (payment) => {
    if (payment.status !== 'pending') {
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
    if (payment.status === 'voided') {
      throw demoError(409, 'PAYMENT_VOIDED');
    }
    if (payment.status !== 'confirmed') {
      throw demoError(409, 'PAYMENT_NOT_PENDING');
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
export function demoAddCharge(ledgers, tenancy_id, value, now, today, makeId) {
  const ledger = findLedger(ledgers, tenancy_id);
  if (ledger.tenancy_status === 'ended') {
    throw demoError(409, 'TENANCY_ENDED');
  }
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
      throw demoError(409, 'CHARGE_VOIDED');
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

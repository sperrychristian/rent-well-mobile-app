// turns the server's camelCase ledger (docs/API.md, Rent ledger) into the app's snake_case shape and back
// pure, so the tests can check both directions without a server
// the real-backend pass: the server works out every status and balance itself, so a server ledger carries
// that math in `server` (the same shape deriveLedger gives back) and the app never recomputes it
import { rowStatusFor } from './ledgerMath';

function cents(value) {
  return Number.isSafeInteger(value) ? value : 0;
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

// the server's RentSchedule, startsOn is the app's start_date
export function fromApiSchedule(schedule) {
  if (!schedule) {
    return null;
  }
  return {
    id: schedule.id || null,
    amount_cents: cents(schedule.amountCents),
    due_day: schedule.dueDay,
    grace_days: schedule.graceDays || 0,
    late_fee_cents: cents(schedule.lateFeeCents),
    start_date: dateOnly(schedule.startsOn),
    end_date: schedule.endsOn ? dateOnly(schedule.endsOn) : null,
  };
}

// a Charge, with the server's own paid, remaining, status, and overdue date
export function fromApiCharge(charge) {
  return {
    id: charge.id,
    tenancy_id: charge.tenancyId || null,
    kind: charge.kind,
    description: charge.description || '',
    amount_cents: cents(charge.amountCents),
    paid_cents: cents(charge.paidCents),
    remaining_cents: cents(charge.remainingCents),
    status: charge.status,
    due_date: dateOnly(charge.dueOn),
    overdue_on: dateOnly(charge.overdueOn),
    period: charge.period || null,
    parent_charge_id: charge.parentChargeId || null,
    created_at: charge.createdAt || '',
    voided_at: charge.voidedAt || null,
    void_reason: charge.voidReason || '',
  };
}

// a Payment, kind refund is the app's is_refund and submittedBy is the app's source
export function fromApiPayment(payment) {
  return {
    id: payment.id,
    tenancy_id: payment.tenancyId || null,
    amount_cents: cents(payment.amountCents),
    method: payment.method,
    paid_on: dateOnly(payment.paidOn),
    applies_to: payment.appliesTo === 'deposit' ? 'deposit' : 'rent',
    is_refund: payment.kind === 'refund',
    note: payment.note || '',
    reference: payment.reference || '',
    receipt_key: payment.receiptPhotoKey || null,
    status: payment.status,
    counts: !!payment.countsTowardBalance,
    source: payment.submittedBy === 'tenant' ? 'tenant' : 'owner',
    confirmed_at: payment.confirmedAt || null,
    reject_reason: payment.rejectReason || '',
    void_reason: payment.voidReason || '',
    failure_reason: payment.failureReason || '',
    provider: payment.provider || 'manual',
    created_at: payment.createdAt || '',
    // the timeline only comes with GET /payments/:id, the provider adds it when it has it
    events: [],
  };
}

// a PaymentEvent from GET /payments/:id, in the shape the timeline reads
export function fromApiEvent(event) {
  return {
    type: event.type,
    at: event.createdAt,
    by_role: null,
    reason: event.data && event.data.reason ? event.data.reason : '',
    from_status: event.fromStatus || null,
    to_status: event.toStatus || null,
  };
}

// a Ledger, plus the server's balances turned into what deriveLedger would give back
export function fromApiLedger(ledger) {
  const tenancy = ledger.tenancy || {};
  const property = tenancy.property || {};
  const charges = (ledger.charges || []).map(fromApiCharge);
  const payments = (ledger.payments || []).map(fromApiPayment);
  const balances = ledger.balances || {};
  const today = dateOnly(ledger.today);
  const pending = payments.filter((payment) => payment.status === 'pending_confirmation');
  const live = charges.filter((charge) => charge.status !== 'voided');
  const due_now_cents = live
    .filter((charge) => charge.due_date <= today)
    .reduce((sum, charge) => sum + charge.remaining_cents, 0);
  const balance_cents = cents(balances.rentBalanceCents);
  const overdue_count = cents(balances.overdueCount);
  return {
    tenancy_id: tenancy.id,
    tenancy_status: ledger.isActive === false ? 'ended' : 'active',
    tenant_id: ledger.tenant ? ledger.tenant.id : null,
    tenant_name: ledger.tenant ? ledger.tenant.name : '',
    property_id: tenancy.propertyId || property.id || null,
    property_name: property.name || tenancy.propertyName || '',
    unit_label: tenancy.unitLabel || '',
    payment_instructions: ledger.paymentInstructions || '',
    time_zone: ledger.timeZone || 'UTC',
    today: today,
    schedule: fromApiSchedule(ledger.schedule),
    charges: charges,
    payments: payments,
    server: {
      charges: charges,
      balance_cents: balance_cents,
      credit_cents: cents(balances.creditCents),
      due_now_cents: due_now_cents,
      overdue_count: overdue_count,
      overdue_cents: cents(balances.overdueCents),
      deposit_held_cents: cents(balances.depositHeldCents),
      deposit_due_cents: cents(balances.depositOwedCents),
      pending_payments: pending,
      pending_cents: cents(balances.pendingConfirmationCents),
      next_due: balances.nextDue
        ? {
            date: dateOnly(balances.nextDue.dueOn),
            amount_cents: cents(balances.nextDue.amountCents),
          }
        : null,
      row_status: rowStatusFor(overdue_count, pending.length, due_now_cents, balance_cents),
    },
  };
}

// GET /ledger/summary's totals in the shape the owner's Payments screen reads (monthSummary's shape)
// pending stays the list of claims from the ledgers, the summary only has a count
// property_id picks that property's row instead of the totals
export function fromApiSummary(summary, pending, property_id) {
  let totals = (summary && summary.totals) || {};
  if (property_id && summary) {
    const row = (summary.properties || []).find(
      (item) => item.property && item.property.id === property_id,
    );
    totals = row || {};
  }
  return {
    month: summary ? summary.month : '',
    expected_cents: cents(totals.expectedCents),
    collected_cents: cents(totals.collectedCents),
    outstanding_cents: cents(totals.outstandingCents),
    overdue_cents: cents(totals.overdueCents),
    overdue_count: cents(totals.overdueCount),
    pending_count: cents(totals.pendingConfirmationCount),
    pending: pending || [],
  };
}

// ----- the other way, for request bodies -----

// PUT /tenancies/:id/rent-schedule
export function toApiSchedule(value) {
  return {
    amountCents: value.amount_cents,
    dueDay: value.due_day,
    graceDays: value.grace_days,
    lateFeeCents: value.late_fee_cents,
    startsOn: value.start_date,
  };
}

// POST /tenancies/:id/charges
export function toApiCharge(value) {
  return {
    kind: value.kind,
    description: value.description,
    amountCents: value.amount_cents,
    dueOn: value.due_date,
  };
}

// the parts the owner route and the tenant claim share, the optional fields only go out when they're set
function paymentBody(value) {
  const body = {
    appliesTo: value.applies_to,
    amountCents: value.amount_cents,
    method: value.method,
    paidOn: value.paid_on,
  };
  if (value.note) {
    body.note = value.note;
  }
  if (value.reference) {
    body.reference = value.reference;
  }
  if (value.receipt_key) {
    body.receiptPhotoKey = value.receipt_key;
  }
  if (value.idempotency_key) {
    body.idempotencyKey = value.idempotency_key;
  }
  return body;
}

// POST /tenancies/:id/payments (owner), a refund is kind refund
export function toApiPayment(value) {
  return { kind: value.is_refund ? 'refund' : 'payment', ...paymentBody(value) };
}

// POST /me/payments (tenant), no kind since tenants can't refund, and the tenancy goes in the body
export function toApiClaim(tenancy_id, value) {
  return { tenancyId: tenancy_id, ...paymentBody(value) };
}

// puts one ledger in the list by tenancy id, or adds it when it's new
export function replaceLedger(ledgers, ledger) {
  const found = ledgers.some((item) => item.tenancy_id === ledger.tenancy_id);
  if (!found) {
    return [...ledgers, ledger];
  }
  return ledgers.map((item) => (item.tenancy_id === ledger.tenancy_id ? ledger : item));
}

// the payment and its ledger for a payment id, or null
export function findPayment(ledgers, payment_id) {
  for (const ledger of ledgers) {
    const payment = (ledger.payments || []).find((item) => item.id === payment_id);
    if (payment) {
      return { payment, ledger };
    }
  }
  return null;
}

// a fresh key for one Save tap, so a retry of the same tap can't record the money twice
export function makeIdempotencyKey() {
  const random = () => Math.random().toString(16).slice(2, 10);
  return 'rw-' + Date.now().toString(16) + '-' + random() + random();
}

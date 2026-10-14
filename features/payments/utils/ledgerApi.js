// turns the server's camelCase ledger (docs/API-ledger-draft.md) into the app's snake_case shape and back
// pure, so the tests can check both directions without a server

function cents(value) {
  return Number.isSafeInteger(value) ? value : 0;
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

export function fromApiSchedule(schedule) {
  if (!schedule) {
    return null;
  }
  return {
    amount_cents: cents(schedule.amountCents),
    due_day: schedule.dueDay,
    grace_days: schedule.graceDays || 0,
    late_fee_cents: cents(schedule.lateFeeCents),
    start_date: dateOnly(schedule.startDate),
  };
}

export function fromApiCharge(charge) {
  return {
    id: charge.id,
    kind: charge.kind,
    description: charge.description || '',
    amount_cents: cents(charge.amountCents),
    due_date: dateOnly(charge.dueDate),
    created_at: charge.createdAt || '',
    voided_at: charge.voidedAt || null,
    void_reason: charge.voidReason || '',
  };
}

export function fromApiPayment(payment) {
  return {
    id: payment.id,
    amount_cents: cents(payment.amountCents),
    method: payment.method,
    paid_on: dateOnly(payment.paidOn),
    applies_to: payment.appliesTo === 'deposit' ? 'deposit' : 'rent',
    is_refund: !!payment.isRefund,
    note: payment.note || '',
    receipt_key: payment.receiptKey || null,
    status: payment.status,
    source: payment.source === 'tenant' ? 'tenant' : 'owner',
    reject_reason: payment.rejectReason || '',
    void_reason: payment.voidReason || '',
    created_at: payment.createdAt || '',
    events: (payment.events || []).map((event) => ({
      type: event.type,
      at: event.at,
      by_role: event.byRole,
      reason: event.reason || '',
    })),
  };
}

export function fromApiLedger(ledger) {
  return {
    tenancy_id: ledger.tenancyId,
    tenancy_status: ledger.tenancyStatus === 'ended' ? 'ended' : 'active',
    tenant_id: ledger.tenantId,
    tenant_name: ledger.tenantName || '',
    property_id: ledger.propertyId,
    property_name: ledger.propertyName || '',
    unit_label: ledger.unitLabel || '',
    payment_instructions: ledger.paymentInstructions || '',
    schedule: fromApiSchedule(ledger.schedule),
    charges: (ledger.charges || []).map(fromApiCharge),
    payments: (ledger.payments || []).map(fromApiPayment),
  };
}

// ----- the other way, for request bodies -----

export function toApiSchedule(value) {
  return {
    amountCents: value.amount_cents,
    dueDay: value.due_day,
    graceDays: value.grace_days,
    lateFeeCents: value.late_fee_cents,
    startDate: value.start_date,
  };
}

export function toApiCharge(value) {
  return {
    kind: value.kind,
    description: value.description,
    amountCents: value.amount_cents,
    dueDate: value.due_date,
  };
}

export function toApiPayment(value) {
  const body = {
    amountCents: value.amount_cents,
    method: value.method,
    paidOn: value.paid_on,
    appliesTo: value.applies_to,
    isRefund: !!value.is_refund,
    note: value.note || '',
  };
  if (value.receipt_key) {
    body.receiptKey = value.receipt_key;
  }
  return body;
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

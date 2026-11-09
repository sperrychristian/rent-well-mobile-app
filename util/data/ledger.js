// the rent ledger: rentSchedules/{tenancyId}, charges/{chargeId}, and payments/{paymentId}
// the app builds one ledger per tenancy in the same shape the demo uses, so the ledger math
// (features/payments/utils/ledgerMath.js) works out every balance and status, and the demo's rule functions
// (demoLedger.js) make every change. this file only reads the records and writes what changed
// rent and late fees have ids made from the tenancy and month (rentChargeId), and they're always created
// with createIfAbsent, so the catch-up can run any number of times, on any number of phones, and never double charge
import { getNode, createIfAbsent } from '../http';
import {
  recordsToList,
  keyedToList,
  listToKeyed,
  buildPatch,
  savePatch,
  cleanRecord,
  nowIso,
} from './records';
import { syncLedger } from '../../features/payments/utils/ledgerMath';

// ----- one record each way -----

export function scheduleFromDb(record) {
  if (!record) {
    return null;
  }
  return {
    amount_cents: record.amountCents,
    due_day: record.dueDay,
    grace_days: record.graceDays || 0,
    late_fee_cents: record.lateFeeCents || 0,
    start_date: record.startsOn,
  };
}

export function scheduleToDb(schedule, ledger) {
  return {
    tenancyId: ledger.tenancy_id,
    ownerId: ledger.owner_id,
    tenantUserId: ledger.tenant_id,
    amountCents: schedule.amount_cents,
    dueDay: schedule.due_day,
    graceDays: schedule.grace_days || 0,
    lateFeeCents: schedule.late_fee_cents || 0,
    startsOn: schedule.start_date,
  };
}

export function chargeFromDb(record) {
  return {
    id: record.id,
    kind: record.kind,
    description: record.description || '',
    amount_cents: record.amountCents,
    due_date: record.dueOn,
    created_at: record.createdAt || record.dueOn,
    voided_at: record.voidedAt || null,
    void_reason: record.voidReason || '',
  };
}

export function chargeToDb(charge, ledger) {
  return cleanRecord({
    id: charge.id,
    tenancyId: ledger.tenancy_id,
    ownerId: ledger.owner_id,
    tenantUserId: ledger.tenant_id,
    kind: charge.kind,
    description: charge.description || '',
    amountCents: charge.amount_cents,
    dueOn: charge.due_date,
    createdAt: charge.created_at,
    voidedAt: charge.voided_at || undefined,
    voidReason: charge.void_reason || undefined,
  });
}

function eventFromDb(event) {
  return {
    type: event.type,
    at: event.at,
    by_role: event.byRole || null,
    reason: event.reason || '',
  };
}

function eventToDb(event) {
  return cleanRecord({
    type: event.type,
    at: event.at,
    byRole: event.by_role || undefined,
    reason: event.reason || undefined,
  });
}

export function paymentFromDb(record) {
  return {
    id: record.id,
    amount_cents: record.amountCents,
    method: record.method || 'other',
    paid_on: record.paidOn,
    applies_to: record.appliesTo === 'deposit' ? 'deposit' : 'rent',
    is_refund: !!record.isRefund,
    note: record.note || '',
    receipt_key: null,
    reference: record.reference || '',
    status: record.status,
    source: record.source === 'tenant' ? 'tenant' : 'owner',
    reject_reason: record.rejectReason || '',
    void_reason: record.voidReason || '',
    created_at: record.createdAt || '',
    events: keyedToList(record.events).map(eventFromDb),
  };
}

export function paymentToDb(payment, ledger) {
  return cleanRecord({
    id: payment.id,
    tenancyId: ledger.tenancy_id,
    ownerId: ledger.owner_id,
    tenantUserId: ledger.tenant_id,
    amountCents: payment.amount_cents,
    method: payment.method,
    paidOn: payment.paid_on,
    appliesTo: payment.applies_to,
    isRefund: !!payment.is_refund,
    note: payment.note || undefined,
    reference: payment.reference || undefined,
    status: payment.status,
    source: payment.source,
    rejectReason: payment.reject_reason || undefined,
    voidReason: payment.void_reason || undefined,
    createdAt: payment.created_at,
    events: listToKeyed((payment.events || []).map(eventToDb)),
  });
}

// ----- loading -----

// scope is { owner_id } for a landlord (every tenancy, current and past) or { tenant_user_id } for a tenant
// the ledgers come back active first, then by tenant name
export async function getLedgers(scope) {
  const [tenancies, schedules, charges, payments, properties, users] = await Promise.all([
    getNode('tenancies'),
    getNode('rentSchedules'),
    getNode('charges'),
    getNode('payments'),
    getNode('properties'),
    getNode('users'),
  ]);
  const mine = recordsToList(tenancies).filter((tenancy) =>
    scope.tenant_user_id
      ? tenancy.tenantUserId === scope.tenant_user_id
      : tenancy.ownerId === scope.owner_id,
  );
  const charge_list = recordsToList(charges);
  const payment_list = recordsToList(payments);
  return mine
    .map((tenancy) => {
      const property = properties[tenancy.propertyId] || {};
      const tenant = users[tenancy.tenantUserId] || {};
      return {
        tenancy_id: tenancy.id,
        tenancy_status: tenancy.status === 'ended' ? 'ended' : 'active',
        owner_id: tenancy.ownerId,
        tenant_id: tenancy.tenantUserId,
        tenant_name: tenant.name || tenancy.tenantName || '',
        property_id: tenancy.propertyId,
        property_name: property.name || tenancy.propertyName || '',
        unit_label: tenancy.unitLabel || '',
        payment_instructions: property.paymentInstructions || '',
        schedule: scheduleFromDb(schedules[tenancy.id]),
        charges: charge_list
          .filter((charge) => charge.tenancyId === tenancy.id)
          .map(chargeFromDb)
          .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
        payments: payment_list
          .filter((payment) => payment.tenancyId === tenancy.id)
          .map(paymentFromDb)
          .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
      };
    })
    .sort((a, b) =>
      a.tenancy_status === b.tenancy_status
        ? a.tenant_name.localeCompare(b.tenant_name)
        : a.tenancy_status === 'active'
          ? -1
          : 1,
    );
}

// ----- saving -----

// rent and late fee ids come from the tenancy and the month, the same on every phone
export function isScheduledCharge(charge) {
  return /^(rent|late)-/.test(String(charge.id));
}

function chargeRecords(ledger) {
  const records = {};
  (ledger.charges || []).forEach((charge) => {
    records[charge.id] = chargeToDb(charge, ledger);
  });
  return records;
}

function paymentRecords(ledger) {
  const records = {};
  (ledger.payments || []).forEach((payment) => {
    records[payment.id] = paymentToDb(payment, ledger);
  });
  return records;
}

// what one change to a ledger writes: the new scheduled charges go one by one through createIfAbsent,
// everything else (a payment, a confirm, a void, a hand-added charge, the schedule) in one multi-path PATCH
export function buildLedgerChanges(before, after) {
  const before_charges = chargeRecords(before);
  const after_charges = chargeRecords(after);
  const scheduled = [];
  Object.keys(after_charges).forEach((id) => {
    if (!before_charges[id] && isScheduledCharge({ id })) {
      scheduled.push(after_charges[id]);
      delete after_charges[id];
    }
  });
  const patch = {
    ...buildPatch('charges', before_charges, after_charges),
    ...buildPatch('payments', paymentRecords(before), paymentRecords(after)),
  };
  const before_schedule = before.schedule ? scheduleToDb(before.schedule, before) : null;
  const after_schedule = after.schedule ? scheduleToDb(after.schedule, after) : null;
  if (JSON.stringify(before_schedule) !== JSON.stringify(after_schedule)) {
    patch['rentSchedules/' + after.tenancy_id] = after_schedule
      ? { ...after_schedule, updatedAt: nowIso() }
      : null;
  }
  return { patch: patch, scheduled: scheduled };
}

// the multi-path write goes first (it's all or nothing), then the scheduled charges, each only if it's missing
export async function saveLedgerChange(before, after) {
  const changes = buildLedgerChanges(before, after);
  await savePatch(changes.patch);
  for (const charge of changes.scheduled) {
    await createIfAbsent('charges/' + charge.id, charge);
  }
}

// the catch-up that used to be the server's nightly job: brings each active ledger up to today
// with syncLedger (rent the schedule says is due, then late fees after the grace days),
// and creates each new charge only if no phone made it already
// gives back the brought-up-to-date ledgers and how many charges this run actually created
export async function catchUpLedgers(ledgers, today) {
  let created = 0;
  const next = [];
  for (const ledger of ledgers) {
    const synced = syncLedger(ledger, today);
    if (synced !== ledger) {
      const have = new Set(ledger.charges.map((charge) => charge.id));
      for (const charge of synced.charges) {
        if (!have.has(charge.id)) {
          if (await createIfAbsent('charges/' + charge.id, chargeToDb(charge, ledger))) {
            created++;
          }
        }
      }
    }
    next.push(synced);
  }
  return { ledgers: next, created: created };
}

import { parseApiError } from '../../../services/apiHelpers';
import { daysBetween } from './leaseHelpers';

// the demo's version of the lease routes, run on the demo tenant data with the server's rules and error codes
// each one gives back new data (never changes the old) or throws the error the server would
// a tenancy keeps its lease in tenancy.lease ({ lease_start_on, lease_end_on, lease_term, renewal_notice_days,
// lease_notes }), and the timeline lives in data.lease_events, keyed by tenancy id, oldest first

function demoError(status, code) {
  return parseApiError(status, { error: { code: code, message: code } });
}

function validationError(message) {
  return parseApiError(400, {
    error: { code: 'VALIDATION_ERROR', message: message, details: [{ path: '', message }] },
  });
}

function findTenancy(data, tenancy_id) {
  const tenancy = data.tenancies.find((item) => item.id === tenancy_id);
  if (!tenancy) {
    throw demoError(404, 'NOT_FOUND');
  }
  if (tenancy.status !== 'active') {
    throw demoError(409, 'TENANCY_ENDED');
  }
  return tenancy;
}

// the stored fields only, in the same camelCase the server's events use
function snapshot(lease) {
  const stored = lease || {};
  return {
    leaseStartOn: stored.lease_start_on || null,
    leaseEndOn: stored.lease_end_on || null,
    leaseTerm: stored.lease_term || null,
    renewalNoticeDays:
      typeof stored.renewal_notice_days === 'number' ? stored.renewal_notice_days : 60,
    leaseNotes: stored.lease_notes || null,
  };
}

function tooFar(date_text, today) {
  return date_text && Math.abs(daysBetween(today, date_text)) > 365 * 20 + 5;
}

function withEvent(data, tenancy_id, event) {
  const events = (data.lease_events && data.lease_events[tenancy_id]) || [];
  return { ...(data.lease_events || {}), [tenancy_id]: [...events, event] };
}

// PUT /tenancies/:id/lease: replaces the whole lease, writes a set or changed event, nothing when it's the same
// value: { lease_start_on, lease_end_on, lease_term, renewal_notice_days, lease_notes }
export function demoSetLease(data, tenancy_id, value, today, now, makeId) {
  const tenancy = findTenancy(data, tenancy_id);
  if (value.lease_term === 'month_to_month' && value.lease_end_on) {
    throw validationError("A month to month lease can't have an end date.");
  }
  if (value.lease_term === 'fixed' && !value.lease_end_on) {
    throw validationError('A fixed lease needs an end date.');
  }
  if (value.lease_start_on && value.lease_end_on && value.lease_end_on <= value.lease_start_on) {
    throw validationError('The end date has to be after the start date.');
  }
  if (tooFar(value.lease_start_on, today) || tooFar(value.lease_end_on, today)) {
    throw demoError(400, 'INVALID_LEASE_DATES');
  }
  const lease = {
    lease_start_on: value.lease_start_on || null,
    lease_end_on: value.lease_term === 'month_to_month' ? null : value.lease_end_on || null,
    lease_term: value.lease_term || null,
    renewal_notice_days:
      typeof value.renewal_notice_days === 'number' ? value.renewal_notice_days : 60,
    lease_notes: value.lease_notes || '',
  };
  const before = snapshot(tenancy.lease);
  const after = snapshot(lease);
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return { data: data, lease: lease };
  }
  const event = {
    id: makeId(),
    type: before.leaseTerm ? 'changed' : 'set',
    data: { before: before, after: after },
    createdAt: now.toISOString(),
  };
  return {
    data: {
      ...data,
      tenancies: data.tenancies.map((item) =>
        item.id === tenancy_id ? { ...item, lease: lease } : item,
      ),
      lease_events: withEvent(data, tenancy_id, event),
    },
    lease: lease,
  };
}

// POST /tenancies/:id/lease/renew: the lease becomes fixed with the new end, and an optional rent change
// has_schedule says whether the tenancy has a rent schedule to change (the ledger lives in its own store)
// value: { new_end_on, new_rent_cents (or null) }
export function demoRenewLease(data, tenancy_id, value, today, now, makeId, has_schedule) {
  const tenancy = findTenancy(data, tenancy_id);
  const current = tenancy.lease || {};
  if (!current.lease_term) {
    throw demoError(409, 'NO_LEASE');
  }
  const end = value.new_end_on;
  if (
    !end ||
    end <= today ||
    (current.lease_end_on && end <= current.lease_end_on) ||
    (current.lease_start_on && end <= current.lease_start_on) ||
    tooFar(end, today)
  ) {
    throw demoError(400, 'INVALID_LEASE_DATES');
  }
  const new_rent = value.new_rent_cents === undefined ? null : value.new_rent_cents;
  if (new_rent !== null && (!Number.isInteger(new_rent) || new_rent < 1 || new_rent > 100000000)) {
    throw validationError('Enter the new monthly rent in whole cents.');
  }
  if (new_rent !== null && !has_schedule) {
    throw demoError(409, 'NO_RENT_SCHEDULE');
  }
  const lease = { ...current, lease_end_on: end, lease_term: 'fixed' };
  const event = {
    id: makeId(),
    type: 'renewed',
    data: {
      previousEndOn: current.lease_end_on || null,
      previousTerm: current.lease_term,
      newEndOn: end,
      newRentCents: new_rent,
    },
    createdAt: now.toISOString(),
  };
  return {
    data: {
      ...data,
      tenancies: data.tenancies.map((item) =>
        item.id === tenancy_id ? { ...item, lease: lease } : item,
      ),
      lease_events: withEvent(data, tenancy_id, event),
    },
    lease: lease,
  };
}

// GET /tenancies/:id/lease's events, an ended tenancy can still be read
export function demoLeaseEvents(data, tenancy_id) {
  if (!data.tenancies.some((item) => item.id === tenancy_id)) {
    throw demoError(404, 'NOT_FOUND');
  }
  return (data.lease_events && data.lease_events[tenancy_id]) || [];
}

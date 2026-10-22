import { formatCents } from '../../../utils/formatCurrency';

// pure helpers for leases, nothing here touches the network so they're easy to test
// a lease lives on its tenancy, and its status is worked out every time it's read (docs/API.md, Lease block),
// so the demo and the server always agree on what "expiring soon" means

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

function isDate(text) {
  return typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text);
}

// whole days from one YYYY-MM-DD to another, done in UTC so daylight saving never adds or loses a day
export function daysBetween(from, to) {
  const start = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8)),
  );
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8)));
  return Math.round((end - start) / 86400000);
}

export function addDaysTo(date_text, days) {
  const parts = date_text.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return (
    date.getUTCFullYear() +
    '-' +
    twoDigits(date.getUTCMonth() + 1) +
    '-' +
    twoDigits(date.getUTCDate())
  );
}

// the stored lease fields plus the two the server works out: days_remaining and lease_status
// raw is { lease_start_on, lease_end_on, lease_term, renewal_notice_days, lease_notes } (any can be missing)
// the same rules as the server's deriveLease: none, month_to_month, expired, expiring_soon, active
export function deriveLease(raw, today) {
  const lease = {
    lease_start_on: (raw && raw.lease_start_on) || null,
    lease_end_on: (raw && raw.lease_end_on) || null,
    lease_term: (raw && raw.lease_term) || null,
    renewal_notice_days:
      raw && typeof raw.renewal_notice_days === 'number' ? raw.renewal_notice_days : 60,
    lease_notes: (raw && raw.lease_notes) || '',
  };
  if (!lease.lease_term) {
    return { ...lease, days_remaining: null, lease_status: 'none' };
  }
  if (lease.lease_term === 'month_to_month') {
    return { ...lease, lease_end_on: null, days_remaining: null, lease_status: 'month_to_month' };
  }
  const days_remaining = daysBetween(today, lease.lease_end_on);
  let lease_status = 'active';
  if (days_remaining < 0) {
    lease_status = 'expired';
  } else if (days_remaining <= lease.renewal_notice_days) {
    lease_status = 'expiring_soon';
  }
  return { ...lease, days_remaining: days_remaining, lease_status: lease_status };
}

// ----- the api shapes -----

// a missing block (an old server, or a tenant copy) reads as no lease, and leaseNotes is missing for tenants
export function fromApiLease(api_lease) {
  if (!api_lease) {
    return deriveLease(null, '2000-01-01');
  }
  return {
    lease_start_on: api_lease.leaseStartOn || null,
    lease_end_on: api_lease.leaseEndOn || null,
    lease_term: api_lease.leaseTerm || null,
    renewal_notice_days:
      typeof api_lease.renewalNoticeDays === 'number' ? api_lease.renewalNoticeDays : 60,
    days_remaining: typeof api_lease.daysRemaining === 'number' ? api_lease.daysRemaining : null,
    lease_status: api_lease.leaseStatus || 'none',
    lease_notes: api_lease.leaseNotes || '',
  };
}

// one timeline entry, the data keys stay camelCase since only the timeline line reads them
export function fromApiLeaseEvent(api_event) {
  return {
    id: api_event.id,
    type: api_event.type,
    data: api_event.data || {},
    created_at: api_event.createdAt,
  };
}

// the PUT body: a PUT replaces the whole lease, so every field goes, empty ones as null
export function toApiLease(value) {
  return {
    leaseStartOn: value.lease_start_on || null,
    leaseEndOn: value.lease_term === 'month_to_month' ? null : value.lease_end_on || null,
    leaseTerm: value.lease_term,
    renewalNoticeDays: value.renewal_notice_days,
    leaseNotes: value.lease_notes ? value.lease_notes : null,
  };
}

// ----- the forms -----

// within 20 years of today, the server's INVALID_LEASE_DATES rule
function tooFar(date_text, today) {
  return Math.abs(daysBetween(today, date_text)) > 365 * 20 + 5;
}

// fields: { lease_start_on, lease_end_on, is_month_to_month, notice_text, lease_notes }
// gives back { errors, value }, value is ready for setLease
export function checkLeaseForm(fields, today) {
  const errors = {};
  const term = fields.is_month_to_month ? 'month_to_month' : 'fixed';
  if (!isDate(fields.lease_start_on)) {
    errors.lease_start_on = 'Pick the day the lease starts.';
  } else if (tooFar(fields.lease_start_on, today)) {
    errors.lease_start_on = 'Pick a date within 20 years of today.';
  }
  if (term === 'fixed') {
    if (!isDate(fields.lease_end_on)) {
      errors.lease_end_on = 'Pick the day the lease ends, or turn on month to month.';
    } else if (isDate(fields.lease_start_on) && fields.lease_end_on <= fields.lease_start_on) {
      errors.lease_end_on = 'The end date has to be after the start date.';
    } else if (tooFar(fields.lease_end_on, today)) {
      errors.lease_end_on = 'Pick a date within 20 years of today.';
    }
  }
  const notice_text = String(fields.notice_text === undefined ? '' : fields.notice_text).trim();
  const notice = notice_text === '' ? 60 : Number(notice_text);
  if (!Number.isInteger(notice) || notice < 0 || notice > 365) {
    errors.notice = 'Enter a whole number of days from 0 to 365.';
  }
  const notes = (fields.lease_notes || '').trim();
  if (notes.length > 1000) {
    errors.lease_notes = 'Keep notes to 1000 characters.';
  }
  return {
    errors: errors,
    value: {
      lease_start_on: fields.lease_start_on,
      lease_end_on: term === 'fixed' ? fields.lease_end_on : null,
      lease_term: term,
      renewal_notice_days: notice,
      lease_notes: notes,
    },
  };
}

// fields: { new_end_on, rent_cents (null to keep the rent) }, lease is the current derived one
// the server's rule: after today, after the current end, and after the start
export function checkRenewForm(fields, lease, today) {
  const errors = {};
  if (!isDate(fields.new_end_on)) {
    errors.new_end_on = 'Pick the new end date.';
  } else if (fields.new_end_on <= today) {
    errors.new_end_on = 'The new end date has to be after today.';
  } else if (lease.lease_end_on && fields.new_end_on <= lease.lease_end_on) {
    errors.new_end_on = 'The new end date has to be after the current one.';
  } else if (lease.lease_start_on && fields.new_end_on <= lease.lease_start_on) {
    errors.new_end_on = 'The new end date has to be after the start date.';
  } else if (tooFar(fields.new_end_on, today)) {
    errors.new_end_on = 'Pick a date within 20 years of today.';
  }
  if (fields.rent_cents !== null && fields.rent_cents !== undefined) {
    if (!Number.isInteger(fields.rent_cents) || fields.rent_cents < 1) {
      errors.rent = 'Enter the new monthly rent, or leave it blank to keep it.';
    } else if (fields.rent_cents > 100000000) {
      errors.rent = 'That rent is too large.';
    }
  }
  return {
    errors: errors,
    value: {
      new_end_on: fields.new_end_on,
      new_rent_cents: fields.rent_cents === undefined ? null : fields.rent_cents,
    },
  };
}

// a year from the current end (or from today when there's no end), the renew sheet's starting value
export function suggestedRenewEnd(lease, today) {
  const from = lease.lease_end_on && lease.lease_end_on > today ? lease.lease_end_on : today;
  const parts = from.split('-').map(Number);
  return parts[0] + 1 + '-' + twoDigits(parts[1]) + '-' + twoDigits(Math.min(parts[2], 28));
}

// ----- words on screen -----

const month_names = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// "Jan 31", plus the year when it isn't this year: "Jan 31, 2027"
export function shortLeaseDate(date_text, today) {
  if (!isDate(date_text)) {
    return '';
  }
  const label = month_names[Number(date_text.slice(5, 7)) - 1] + ' ' + Number(date_text.slice(8));
  return today && date_text.slice(0, 4) !== today.slice(0, 4)
    ? label + ', ' + date_text.slice(0, 4)
    : label;
}

// the StatusLabel words and tone for a lease, the words always say it so it's never color only
export function leaseStatusLabel(lease) {
  switch (lease.lease_status) {
    case 'expiring_soon':
      return { label: 'Expiring soon', tone: 'warning', icon: 'time-outline' };
    case 'expired':
      return { label: 'Expired', tone: 'danger', icon: 'alert-circle-outline' };
    case 'month_to_month':
      return { label: 'Month to month', tone: 'info', icon: 'repeat-outline' };
    case 'active':
      return { label: 'Active', tone: 'success', icon: 'checkmark-circle-outline' };
    default:
      return { label: 'No lease', tone: 'neutral', icon: 'document-outline' };
  }
}

// "25 days left", "Ends today", "Ended 12 days ago", or the term when there's no end date
export function daysLine(lease) {
  if (lease.days_remaining === null || lease.days_remaining === undefined) {
    return lease.lease_status === 'month_to_month' ? 'No end date' : 'Not recorded';
  }
  const days = lease.days_remaining;
  if (days === 0) {
    return 'Ends today';
  }
  if (days === 1) {
    return '1 day left';
  }
  if (days > 1) {
    return days + ' days left';
  }
  return days === -1 ? 'Ended yesterday' : 'Ended ' + Math.abs(days) + ' days ago';
}

// every tenancy as one lease row: active tenancies first (soonest end first, then the rest), then past ones
// tenants is the shared tenants list (active_tenancies and ended_tenancies each carry their lease)
export function leaseRows(tenants) {
  const rows = [];
  tenants.forEach((tenant) => {
    tenant.active_tenancies.forEach((tenancy) =>
      rows.push({
        tenant,
        tenancy,
        lease: tenancy.lease || deriveLease(null, '2000-01-01'),
        is_past: false,
      }),
    );
    tenant.ended_tenancies
      .filter((tenancy) => tenancy.lease && tenancy.lease.lease_status !== 'none')
      .forEach((tenancy) => rows.push({ tenant, tenancy, lease: tenancy.lease, is_past: true }));
  });
  // a lease with an end date sorts by it, month to month comes after those, and no lease last
  const rank = (row) => {
    if (row.lease.lease_end_on) {
      return 0;
    }
    return row.lease.lease_status === 'month_to_month' ? 1 : 2;
  };
  return rows.sort((a, b) => {
    if (a.is_past !== b.is_past) {
      return a.is_past ? 1 : -1;
    }
    if (rank(a) !== rank(b)) {
      return rank(a) - rank(b);
    }
    if (a.lease.lease_end_on && b.lease.lease_end_on) {
      return a.is_past
        ? b.lease.lease_end_on.localeCompare(a.lease.lease_end_on)
        : a.lease.lease_end_on.localeCompare(b.lease.lease_end_on);
    }
    return a.tenant.name.localeCompare(b.tenant.name);
  });
}

// the Dashboard's Leases row subtitle, counted over current tenancies only
export function leasesSummary(tenants) {
  const current = leaseRows(tenants).filter((row) => !row.is_past);
  const ending = current.filter((row) => row.lease.lease_status === 'expiring_soon').length;
  const expired = current.filter((row) => row.lease.lease_status === 'expired').length;
  const parts = [];
  if (ending > 0) {
    parts.push(ending + ' ending soon');
  }
  if (expired > 0) {
    parts.push(expired + ' expired');
  }
  return {
    text:
      parts.length > 0
        ? parts.join(', ')
        : current.length > 0
          ? 'All leases current'
          : 'No tenants yet',
    tone: ending > 0 || expired > 0 ? 'warning' : 'neutral',
    ending_count: ending,
  };
}

// the soonest current lease ending within 30 days, for the Dashboard's terracotta line (or null)
export function urgentLease(tenants) {
  const soon = leaseRows(tenants).filter(
    (row) =>
      !row.is_past &&
      row.lease.lease_end_on &&
      row.lease.days_remaining !== null &&
      row.lease.days_remaining >= 0 &&
      row.lease.days_remaining <= 30,
  );
  if (soon.length === 0) {
    return null;
  }
  const row = soon[0];
  const days = row.lease.days_remaining;
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
  const more = soon.length > 1 ? ' (+' + (soon.length - 1) + ' more)' : '';
  return {
    tenancy_id: row.tenancy.id,
    text: row.tenant.name + "'s lease ends " + when + more,
  };
}

// the tenant home's line: "Your lease ends Jan 31" when it's within 90 days, otherwise null
export function tenantLeaseLine(lease, today) {
  if (!lease || !lease.lease_end_on || lease.days_remaining === null) {
    return null;
  }
  if (lease.days_remaining < 0) {
    return {
      text: 'Your lease ended ' + shortLeaseDate(lease.lease_end_on, today),
      tone: 'danger',
    };
  }
  if (lease.days_remaining <= 90) {
    return {
      text: 'Your lease ends ' + shortLeaseDate(lease.lease_end_on, today),
      tone: lease.days_remaining <= 30 ? 'danger' : 'warning',
    };
  }
  return null;
}

// one line per timeline event, the newest first on screen
export function leaseEventLine(event, today) {
  const data = event.data || {};
  if (event.type === 'renewed') {
    const rent =
      typeof data.newRentCents === 'number' ? ', new rent ' + formatCents(data.newRentCents) : '';
    return 'Renewed to ' + shortLeaseDate(data.newEndOn, today) + rent;
  }
  if (event.type === 'set') {
    const after = data.after || {};
    return after.leaseTerm === 'month_to_month'
      ? 'Lease set, month to month'
      : 'Lease set, ends ' + shortLeaseDate(after.leaseEndOn, today);
  }
  const after = data.after || {};
  if (!after.leaseTerm) {
    return 'Lease cleared';
  }
  return after.leaseTerm === 'month_to_month'
    ? 'Changed to month to month'
    : 'Lease changed, ends ' + shortLeaseDate(after.leaseEndOn, today);
}

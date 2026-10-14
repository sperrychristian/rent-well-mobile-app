// pure helpers for the payments screens: words for statuses, months, balances, form checks, and receipt text
// nothing here draws anything or touches the network, so the tests can check all of it
import { formatCents, parseAmountToCents } from '../../../utils/formatCurrency';
import { isDate, monthOf, nextScheduledDue, deriveLedger, monthSummary } from './ledgerMath';

// ----- choices -----

export const payment_methods = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export const charge_kinds = [
  { value: 'other', label: 'Other charge' },
  { value: 'deposit', label: 'Security deposit' },
  { value: 'late_fee', label: 'Late fee' },
  { value: 'rent', label: 'Rent' },
];

export function methodLabel(method) {
  const found = payment_methods.find((item) => item.value === method);
  return found ? found.label : 'Other';
}

export function chargeKindLabel(kind) {
  const found = charge_kinds.find((item) => item.value === kind);
  return found ? found.label : 'Charge';
}

// ----- status words, the pills always show these with an icon so a status is never color only -----

const charge_pills = {
  paid: { label: 'Paid', tone: 'success', icon: 'checkmark-circle-outline' },
  partial: { label: 'Partly paid', tone: 'info', icon: 'pie-chart-outline' },
  due: { label: 'Due', tone: 'warning', icon: 'calendar-outline' },
  overdue: { label: 'Overdue', tone: 'danger', icon: 'alert-circle-outline' },
  upcoming: { label: 'Upcoming', tone: 'neutral', icon: 'time-outline' },
  voided: { label: 'Voided', tone: 'neutral', icon: 'close-circle-outline' },
};

const payment_pills = {
  pending: { label: 'Waiting for confirmation', tone: 'warning', icon: 'hourglass-outline' },
  confirmed: { label: 'Confirmed', tone: 'success', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', tone: 'danger', icon: 'close-circle-outline' },
  voided: { label: 'Voided', tone: 'neutral', icon: 'remove-circle-outline' },
};

// the owner's per-tenant row: what needs attention first
const row_pills = {
  overdue: { label: 'Overdue', tone: 'danger', icon: 'alert-circle-outline' },
  pending: { label: 'Claim to review', tone: 'warning', icon: 'hourglass-outline' },
  due: { label: 'Due', tone: 'warning', icon: 'calendar-outline' },
  credit: { label: 'Credit', tone: 'info', icon: 'wallet-outline' },
  paid: { label: 'All paid up', tone: 'success', icon: 'checkmark-circle-outline' },
};

const unknown_pill = { label: 'Unknown', tone: 'neutral', icon: 'help-circle-outline' };

export function chargePill(status) {
  return charge_pills[status] || unknown_pill;
}

export function paymentPill(status) {
  return payment_pills[status] || unknown_pill;
}

export function rowPill(row_status) {
  return row_pills[row_status] || unknown_pill;
}

// ----- status lines, the Hearth rows show a status as a line icon and words instead of a pill -----

// a charge's line, like "Overdue, was due Oct 1" or "Paid", gives back { text, tone, icon }
export function chargeStatusLine(charge) {
  const due = shortDate(charge.due_date);
  const left =
    charge.remaining_cents > 0 && charge.remaining_cents < charge.amount_cents
      ? formatCents(charge.remaining_cents) + ' left, '
      : '';
  switch (charge.status) {
    case 'paid':
      return { text: 'Paid', tone: 'success', icon: 'checkmark-circle-outline' };
    case 'overdue':
      return {
        text: 'Overdue, ' + left + 'was due ' + due,
        tone: 'danger',
        icon: 'alert-circle-outline',
      };
    case 'partial':
      return { text: left + 'due ' + due, tone: 'warning', icon: 'time-outline' };
    case 'due':
      return { text: 'Due ' + due, tone: 'warning', icon: 'time-outline' };
    case 'upcoming':
      return { text: 'Due ' + due, tone: 'neutral', icon: 'calendar-outline' };
    case 'voided':
      return {
        text: 'Voided' + (charge.void_reason ? ': ' + charge.void_reason : ''),
        tone: 'neutral',
        icon: 'remove-circle-outline',
      };
    default:
      return { text: 'Due ' + due, tone: 'neutral', icon: 'calendar-outline' };
  }
}

// a payment's line, like "Paid Sep 2 by Zelle" or "Waiting for confirmation, sent Oct 14 by Venmo"
export function paymentStatusLine(payment) {
  const when = shortDate(payment.paid_on) + ' by ' + methodLabel(payment.method);
  switch (payment.status) {
    case 'confirmed':
      return {
        text: (payment.is_refund ? 'Refunded ' : 'Paid ') + when,
        tone: 'success',
        icon: 'checkmark-circle-outline',
      };
    case 'pending':
      return {
        text: 'Waiting for confirmation, sent ' + when,
        tone: 'warning',
        icon: 'hourglass-outline',
      };
    case 'rejected':
      return { text: 'Rejected, sent ' + when, tone: 'danger', icon: 'close-circle-outline' };
    case 'voided':
      return { text: 'Voided, was ' + when, tone: 'neutral', icon: 'remove-circle-outline' };
    default:
      return { text: when, tone: 'neutral', icon: 'ellipse-outline' };
  }
}

// ----- balances -----

// a balance in words: owed, all paid up, or a credit, with the tone the screens color it by
export function formatBalance(balance_cents) {
  if (balance_cents > 0) {
    return { text: formatCents(balance_cents) + ' due', tone: 'danger', short: 'Due' };
  }
  if (balance_cents < 0) {
    return { text: formatCents(-balance_cents) + ' credit', tone: 'success', short: 'Credit' };
  }
  return { text: 'All paid up', tone: 'success', short: 'Paid up' };
}

// the next rent date from the schedule and its amount, for "Next rent" and "Rent due Nov 1: $1,200.00"
// it's always the coming date, even when older rent is still owed (that shows as overdue instead)
// gives back null with no schedule or once the tenancy has ended
export function upcomingRent(ledger, today) {
  if (!ledger || !ledger.schedule || ledger.tenancy_status === 'ended') {
    return null;
  }
  const date = nextScheduledDue(ledger.schedule, today);
  return date ? { date: date, amount_cents: ledger.schedule.amount_cents } : null;
}

// ----- the home screens' one-liners -----

// the landlord's Payments tile: what needs doing first, overdue, then claims, otherwise all paid up
// gives back { text, tone, claims, collected_cents, expected_cents } for this month
export function ownerPaymentsLine(ledgers, today) {
  const active = ledgers.filter((ledger) => ledger.tenancy_status !== 'ended');
  const summary = monthSummary(ledgers, monthOf(today), today);
  const overdue_tenants = active.filter((ledger) => deriveLedger(ledger, today).overdue_count > 0);
  let text = 'All paid up';
  let tone = 'success';
  if (active.length === 0) {
    text = 'Set up rent';
    tone = 'info';
  } else if (overdue_tenants.length > 0) {
    text = overdue_tenants.length + ' overdue';
    tone = 'danger';
  } else if (summary.pending.length > 0) {
    text =
      summary.pending.length + (summary.pending.length === 1 ? ' claim' : ' claims') + ' to review';
    tone = 'warning';
  }
  return {
    text: text,
    tone: tone,
    claims: summary.pending.length,
    collected_cents: summary.collected_cents,
    expected_cents: summary.expected_cents,
  };
}

// the dashboard's one line under the hero: how many current tenants are behind and by how much in total
// gives back { count, cents }, both 0 when everyone is paid up
export function behindSummary(ledgers, today) {
  let count = 0;
  let cents = 0;
  ledgers
    .filter((ledger) => ledger.tenancy_status !== 'ended')
    .forEach((ledger) => {
      const derived = deriveLedger(ledger, today);
      if (derived.overdue_cents > 0) {
        count++;
        cents += derived.overdue_cents;
      }
    });
  return { count: count, cents: cents };
}

// the tenant's Payments tile: overdue, due now, or the next rent date, like "Rent due Nov 1: $1,200.00"
export function tenantRentLine(ledger, today) {
  if (!ledger) {
    return { text: 'No rent set up yet', tone: 'neutral' };
  }
  const derived = deriveLedger(ledger, today);
  if (derived.overdue_cents > 0) {
    return { text: formatCents(derived.overdue_cents) + ' overdue', tone: 'danger' };
  }
  if (derived.due_now_cents > 0) {
    return { text: 'Rent due now: ' + formatCents(derived.due_now_cents), tone: 'warning' };
  }
  const next = upcomingRent(ledger, today);
  if (next) {
    // a credit comes off what's due next
    const amount = Math.max(next.amount_cents + Math.min(derived.balance_cents, 0), 0);
    return {
      text: 'Rent due ' + shortDate(next.date) + ': ' + formatCents(amount),
      tone: 'success',
    };
  }
  return { text: formatBalance(derived.balance_cents).text, tone: 'success' };
}

// ----- months -----

const month_names = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// 2026-10 into October 2026
export function monthTitle(month) {
  const number = parseInt(String(month).slice(5, 7), 10);
  if (!(number >= 1 && number <= 12)) {
    return String(month);
  }
  return month_names[number - 1] + ' ' + String(month).slice(0, 4);
}

// 2026-11-01 into Nov 1, for "Rent due Nov 1"
export function shortDate(date) {
  if (!isDate(date)) {
    return '';
  }
  const number = parseInt(date.slice(5, 7), 10);
  return month_names[number - 1].slice(0, 3) + ' ' + parseInt(date.slice(8, 10), 10);
}

// charges and payments mixed together, grouped by month, newest month and newest item first
// each item is { type: 'charge' | 'payment', date, ... } and comes back as [{ month, title, items }]
export function groupByMonth(items) {
  const groups = {};
  items.forEach((item) => {
    if (!isDate(item.date)) {
      return;
    }
    const month = monthOf(item.date);
    if (!groups[month]) {
      groups[month] = [];
    }
    groups[month].push(item);
  });
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({
      month: month,
      title: monthTitle(month),
      items: groups[month].sort(
        (a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)),
      ),
    }));
}

// ----- form checks, each gives back { errors, value } where value is ready to send -----

const max_cents = 10000000;

function amountError(amount_text) {
  const cents = parseAmountToCents(amount_text);
  if (cents === null) {
    return { error: 'Enter an amount like 1200 or 1200.50.' };
  }
  if (cents <= 0) {
    return { error: 'The amount has to be more than $0.' };
  }
  if (cents > max_cents) {
    return { error: 'That amount is over the ' + formatCents(max_cents) + ' limit.' };
  }
  return { cents: cents };
}

function dateError(date, today, allow_future) {
  if (!isDate(date)) {
    return 'Pick a date as YYYY-MM-DD.';
  }
  if (!allow_future && date > today) {
    return "A payment can't be dated in the future.";
  }
  return null;
}

// a payment the owner records, or a tenant's "I paid" claim (claims can't be refunds)
// fields: { amount_text, method, paid_on, applies_to, is_refund, note }
export function validatePayment(fields, today, is_claim) {
  const errors = {};
  const amount = amountError(fields.amount_text);
  if (amount.error) {
    errors.amount = amount.error;
  }
  if (!payment_methods.some((item) => item.value === fields.method)) {
    errors.method = 'Pick how it was paid.';
  }
  const date_error = dateError(fields.paid_on, today, false);
  if (date_error) {
    errors.paid_on = date_error;
  }
  if (!['rent', 'deposit'].includes(fields.applies_to)) {
    errors.applies_to = 'Pick rent or deposit.';
  }
  if (is_claim && fields.is_refund) {
    errors.is_refund = 'Only your landlord can record a refund.';
  }
  if ((fields.note || '').length > 500) {
    errors.note = 'Keep the note under 500 characters.';
  }
  return {
    errors: errors,
    value: {
      amount_cents: amount.cents,
      method: fields.method,
      paid_on: fields.paid_on,
      applies_to: fields.applies_to,
      is_refund: !is_claim && !!fields.is_refund,
      note: (fields.note || '').trim(),
    },
  };
}

// fields: { kind, description, amount_text, due_date }
export function validateCharge(fields) {
  const errors = {};
  const amount = amountError(fields.amount_text);
  if (amount.error) {
    errors.amount = amount.error;
  }
  if (!charge_kinds.some((item) => item.value === fields.kind)) {
    errors.kind = 'Pick what kind of charge this is.';
  }
  const description = (fields.description || '').trim();
  if (description.length === 0) {
    errors.description = 'Say what the charge is for.';
  } else if (description.length > 120) {
    errors.description = 'Keep it under 120 characters.';
  }
  if (!isDate(fields.due_date)) {
    errors.due_date = 'Pick a due date as YYYY-MM-DD.';
  }
  return {
    errors: errors,
    value: {
      kind: fields.kind,
      description: description,
      amount_cents: amount.cents,
      due_date: fields.due_date,
    },
  };
}

// fields: { amount_text, due_day_text, grace_text, late_fee_text (blank for none), start_date }
export function validateSchedule(fields) {
  const errors = {};
  const amount = amountError(fields.amount_text);
  if (amount.error) {
    errors.amount = amount.error;
  }
  const due_day = /^\d{1,2}$/.test(String(fields.due_day_text || '').trim())
    ? parseInt(fields.due_day_text, 10)
    : null;
  if (due_day === null || due_day < 1 || due_day > 28) {
    errors.due_day = 'Pick a day from 1 to 28 so every month has it.';
  }
  const grace_text = String(fields.grace_text === undefined ? '' : fields.grace_text).trim();
  const grace_days =
    grace_text === '' ? 0 : /^\d{1,2}$/.test(grace_text) ? parseInt(grace_text, 10) : null;
  if (grace_days === null || grace_days > 27) {
    errors.grace = 'Grace days are 0 to 27.';
  }
  let late_fee_cents = 0;
  if (String(fields.late_fee_text || '').trim() !== '') {
    const fee = parseAmountToCents(fields.late_fee_text);
    if (fee === null || fee < 0 || fee > max_cents) {
      errors.late_fee = 'Enter a late fee like 50, or leave it blank for none.';
    } else {
      late_fee_cents = fee;
    }
  }
  if (!isDate(fields.start_date)) {
    errors.start_date = 'Pick a start date as YYYY-MM-DD.';
  }
  return {
    errors: errors,
    value: {
      amount_cents: amount.cents,
      due_day: due_day,
      grace_days: grace_days,
      late_fee_cents: late_fee_cents,
      start_date: fields.start_date,
    },
  };
}

// a reason for voiding or rejecting, so the other side knows why
export function validateReason(text) {
  const reason = (text || '').trim();
  if (reason.length < 3) {
    return { error: 'Give a short reason (at least 3 characters).', value: reason };
  }
  if (reason.length > 300) {
    return { error: 'Keep the reason under 300 characters.', value: reason };
  }
  return { error: null, value: reason };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

// ----- the receipt someone can share -----

// plain text so it works in any app the share sheet offers
export function buildReceiptText(payment, ledger, generated_on) {
  const place = ledger.unit_label
    ? ledger.property_name + ', ' + ledger.unit_label
    : ledger.property_name;
  const lines = [
    'Rent Well payment receipt',
    '',
    'Tenant: ' + (ledger.tenant_name || 'Tenant'),
    'Property: ' + (place || 'Property'),
    'Amount: ' + (payment.is_refund ? 'Refund of ' : '') + formatCents(payment.amount_cents),
    'Paid on: ' + payment.paid_on,
    'Method: ' + methodLabel(payment.method),
    'Applied to: ' + (payment.applies_to === 'deposit' ? 'Security deposit' : 'Rent'),
    'Status: ' + paymentPill(payment.status).label,
  ];
  if (payment.note) {
    lines.push('Note: ' + payment.note);
  }
  if (payment.status === 'rejected' && payment.reject_reason) {
    lines.push('Rejected because: ' + payment.reject_reason);
  }
  if (payment.status === 'voided' && payment.void_reason) {
    lines.push('Voided because: ' + payment.void_reason);
  }
  lines.push('Reference: ' + payment.id);
  lines.push('');
  lines.push('Made in Rent Well on ' + generated_on + '. This is a record, not a bank statement.');
  return lines.join('\n');
}

// what happened to a payment over time, oldest first, for the timeline on the detail screen
const event_words = {
  recorded: 'Recorded by the landlord',
  claimed: 'Tenant said they paid',
  confirmed: 'Confirmed by the landlord',
  rejected: 'Rejected by the landlord',
  voided: 'Voided by the landlord',
};

export function timelineFor(payment) {
  return [...(payment.events || [])]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .map((event) => ({
      ...event,
      title: event_words[event.type] || 'Updated',
      date: String(event.at).slice(0, 10),
    }));
}

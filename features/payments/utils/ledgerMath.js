// the rent ledger's math, pure functions only so the demo and the tests can run it with no server
// every amount is whole cents (an integer), and dates are plain YYYY-MM-DD text, so there's no float or timezone math
// the server (rent-well-api's src/ledger, docs/API.md) does this same math, the shared vectors
// in ledgerVectors.js are what both sides should agree on

// ----- dates as YYYY-MM-DD -----

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// a YYYY-MM-DD from year, month (1 to 12), and day
export function dateFrom(year, month, day) {
  return year + '-' + twoDigits(month) + '-' + twoDigits(day);
}

// day count since 1970 for a YYYY-MM-DD, in UTC so a daylight saving change can't shift it
function dayNumber(date) {
  const [year, month, day] = date.split('-').map((part) => parseInt(part, 10));
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

export function addDays(date, days) {
  const moved = new Date((dayNumber(date) + days) * 86400000);
  return dateFrom(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

// how many days after `from` the date `to` is (negative when it's before)
export function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}

export function isDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const [year, month, day] = text.split('-').map((part) => parseInt(part, 10));
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

export function monthOf(date) {
  return date.slice(0, 7);
}

// the month after (or before, with a negative step) a YYYY-MM
export function shiftMonth(month, step) {
  const [year, number] = month.split('-').map((part) => parseInt(part, 10));
  const index = year * 12 + (number - 1) + step;
  return Math.floor(index / 12) + '-' + twoDigits((index % 12) + 1);
}

// ----- rent from the schedule -----

// a rent schedule is { amount_cents, due_day (1 to 28), grace_days, late_fee_cents, start_date }
// the due day stops at 28 so every month has it

// every rent due date from the schedule's start month through `through` (a YYYY-MM-DD), oldest first
// the first month only counts when its due day isn't before the start date
export function rentDueDates(schedule, through) {
  if (!schedule || !isDate(schedule.start_date) || !isDate(through)) {
    return [];
  }
  const dates = [];
  let month = monthOf(schedule.start_date);
  const last = monthOf(through);
  while (month <= last) {
    const due = month + '-' + twoDigits(schedule.due_day);
    if (due >= schedule.start_date && due <= through) {
      dates.push(due);
    }
    month = shiftMonth(month, 1);
  }
  return dates;
}

// the rent charge id for a tenancy and month, the same everywhere so a charge never gets made twice
export function rentChargeId(tenancy_id, due_date) {
  return 'rent-' + tenancy_id + '-' + monthOf(due_date);
}

// rent charges the schedule says should exist by `today` and aren't on the ledger yet
export function missingRentCharges(tenancy_id, schedule, charges, today) {
  const have = new Set(charges.map((charge) => charge.id));
  return rentDueDates(schedule, today)
    .filter((due) => !have.has(rentChargeId(tenancy_id, due)))
    .map((due) => ({
      id: rentChargeId(tenancy_id, due),
      kind: 'rent',
      description: 'Rent',
      amount_cents: schedule.amount_cents,
      due_date: due,
      created_at: due,
      voided_at: null,
      void_reason: '',
    }));
}

// the schedule's next due date after `today` (for "next due" when everything is paid), or null with no schedule
export function nextScheduledDue(schedule, today) {
  if (!schedule || !isDate(schedule.start_date) || !isDate(today)) {
    return null;
  }
  let month = monthOf(today);
  for (let step = 0; step < 24; step++) {
    const due = month + '-' + twoDigits(schedule.due_day);
    if (due > today && due >= schedule.start_date) {
      return due;
    }
    month = shiftMonth(month, 1);
  }
  return null;
}

// ----- payments against charges -----
// the real-backend pass: this is a port of rent-well-api's src/ledger (allocation.js, chargeStatus.js,
// buildLedger.js) so the demo's numbers match what the server would say, real mode doesn't run any of it,
// it shows the server's own statuses and balances (see ledgerApi.js)

// payment statuses use the server's names now: pending_confirmation (a tenant claim), succeeded (counts),
// rejected, voided, and the ones only a provider makes later (pending, processing, failed, returned)
export const counting_status = 'succeeded';
export const claim_status = 'pending_confirmation';

function isActive(charge) {
  return !charge.voided_at;
}

function byDueDate(a, b) {
  return (
    a.due_date.localeCompare(b.due_date) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.id).localeCompare(String(b.id))
  );
}

function byPaidOn(a, b) {
  return (
    a.paid_on.localeCompare(b.paid_on) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.id).localeCompare(String(b.id))
  );
}

// what one confirmed payment adds (a refund takes away), only confirmed money ever moves a balance
export function paymentEffect(payment) {
  if (payment.status !== counting_status) {
    return 0;
  }
  return payment.is_refund ? -payment.amount_cents : payment.amount_cents;
}

// adds up confirmed payments for one side of the ledger, rent or deposit
export function confirmedTotal(payments, applies_to) {
  return payments
    .filter((payment) => payment.applies_to === applies_to)
    .reduce((sum, payment) => sum + paymentEffect(payment), 0);
}

// the server's pool walk: money in the order it happened, a payment fills the oldest unpaid charge first
// and the rest is credit, a rent refund eats credit first and then reopens the newest paid charges,
// a deposit refund never reopens the deposit charge, and a refund bigger than what's been paid leaves debt
function allocatePool(charges, payments, refunds_reopen_charges) {
  const ordered = [...charges].sort(byDueDate);
  const remaining = new Map(ordered.map((charge) => [charge.id, charge.amount_cents]));
  const entries = new Map(ordered.map((charge) => [charge.id, []]));
  const credits = [];
  let debt_cents = 0;
  [...payments].sort(byPaidOn).forEach((payment) => {
    let left = payment.amount_cents;
    if (!payment.is_refund) {
      const debt_paid = Math.min(debt_cents, left);
      debt_cents -= debt_paid;
      left -= debt_paid;
      ordered.forEach((charge) => {
        const open = remaining.get(charge.id);
        if (!left || !open) {
          return;
        }
        const take = Math.min(open, left);
        entries.get(charge.id).push({ amount_cents: take });
        remaining.set(charge.id, open - take);
        left -= take;
      });
      if (left) {
        credits.push({ amount_cents: left });
      }
      return;
    }
    if (!refunds_reopen_charges) {
      return;
    }
    while (left && credits.length) {
      const credit = credits[credits.length - 1];
      const take = Math.min(credit.amount_cents, left);
      credit.amount_cents -= take;
      left -= take;
      if (!credit.amount_cents) {
        credits.pop();
      }
    }
    [...ordered].reverse().forEach((charge) => {
      [...entries.get(charge.id)].reverse().forEach((entry) => {
        if (!left) {
          return;
        }
        const take = Math.min(entry.amount_cents, left);
        entry.amount_cents -= take;
        remaining.set(charge.id, remaining.get(charge.id) + take);
        left -= take;
      });
    });
    debt_cents += left;
  });
  return {
    remaining: remaining,
    credit_cents: credits.reduce((sum, credit) => sum + credit.amount_cents, 0),
    debt_cents: debt_cents,
  };
}

function rentPool(charges) {
  return charges.filter((charge) => charge.kind !== 'deposit');
}

// spreads money over charges oldest first and gives back what's left on each one by id
// rent money pays rent, late fees, and other charges, deposit money only pays deposit charges
export function allocate(charges, payments) {
  const active = charges.filter(isActive);
  const counted = payments.filter((payment) => payment.status === counting_status);
  const rent = allocatePool(
    rentPool(active),
    counted.filter((payment) => payment.applies_to !== 'deposit'),
    true,
  );
  const deposit = allocatePool(
    active.filter((charge) => charge.kind === 'deposit'),
    counted.filter((payment) => payment.applies_to === 'deposit'),
    false,
  );
  const remaining = {};
  rent.remaining.forEach((value, id) => {
    remaining[id] = value;
  });
  deposit.remaining.forEach((value, id) => {
    remaining[id] = value;
  });
  return { remaining: remaining, credit_cents: rent.credit_cents, debt_cents: rent.debt_cents };
}

// how many days a charge waits before it's late: only rent gets the schedule's grace days
function graceFor(charge, grace_days) {
  return charge.kind === 'rent' ? grace_days || 0 : 0;
}

// the first day a charge counts as overdue
export function overdueOn(charge, grace_days) {
  return addDays(charge.due_date, graceFor(charge, grace_days) + 1);
}

export const due_soon_days = 7;

// a charge's status as of today, the server's order: voided, paid, overdue, partial, due, due_soon, upcoming
// overdue means money is still owed on or after due date + grace days + 1
export function chargeStatus(charge, remaining_cents, today, grace_days) {
  if (charge.voided_at) {
    return 'voided';
  }
  if (remaining_cents <= 0) {
    return 'paid';
  }
  if (today >= overdueOn(charge, grace_days)) {
    return 'overdue';
  }
  if (remaining_cents < charge.amount_cents) {
    return 'partial';
  }
  if (today >= charge.due_date) {
    return 'due';
  }
  if (daysBetween(today, charge.due_date) <= due_soon_days) {
    return 'due_soon';
  }
  return 'upcoming';
}

// late fees the schedule says should exist: one per rent charge still unpaid after the grace days
// the fee is due the day after grace runs out, and fees never get fees of their own
// (like the server's job, no fee while the tenant has a rent claim waiting on the landlord)
export function missingLateFees(tenancy_id, schedule, charges, payments, today) {
  if (!schedule || !schedule.late_fee_cents || schedule.late_fee_cents <= 0) {
    return [];
  }
  const claim_waiting = payments.some(
    (payment) => payment.status === claim_status && payment.applies_to !== 'deposit',
  );
  if (claim_waiting) {
    return [];
  }
  const remaining = allocate(charges, payments).remaining;
  const have = new Set(charges.map((charge) => charge.id));
  return charges
    .filter(isActive)
    .filter((charge) => charge.kind === 'rent' && remaining[charge.id] > 0)
    .filter((charge) => today >= overdueOn(charge, schedule.grace_days))
    .map((charge) => ({
      id: 'late-' + charge.id,
      kind: 'late_fee',
      description: 'Late fee',
      amount_cents: schedule.late_fee_cents,
      due_date: overdueOn(charge, schedule.grace_days),
      created_at: overdueOn(charge, schedule.grace_days),
      voided_at: null,
      void_reason: '',
    }))
    .filter((fee) => !have.has(fee.id));
}

// ----- everything a screen shows about one tenancy -----

// the row status the owner's lists sort by: overdue, then a claim to review, then something due, credit, paid
function rowStatusFor(overdue_count, pending_count, due_now_cents, balance_cents) {
  if (overdue_count > 0) {
    return 'overdue';
  }
  if (pending_count > 0) {
    return 'pending';
  }
  if (due_now_cents > 0) {
    return 'due';
  }
  if (balance_cents < 0) {
    return 'credit';
  }
  return 'paid';
}

// ledger is { tenancy_id, schedule, charges, payments, ... }, today is YYYY-MM-DD
// a ledger from the server already carries the server's math (ledger.server), so that wins as is,
// a demo ledger gets the same math worked out here
export function deriveLedger(ledger, today) {
  if (ledger.server) {
    return ledger.server;
  }
  const charges = ledger.charges || [];
  const payments = ledger.payments || [];
  const grace = ledger.schedule ? ledger.schedule.grace_days || 0 : 0;
  const pools = allocate(charges, payments);
  const charge_rows = charges
    .map((charge) => {
      const left = charge.voided_at ? 0 : pools.remaining[charge.id] || 0;
      return {
        ...charge,
        paid_cents: charge.voided_at ? 0 : charge.amount_cents - left,
        remaining_cents: left,
        overdue_on: overdueOn(charge, grace),
        status: chargeStatus(charge, left, today, grace),
      };
    })
    .sort((a, b) => byDueDate(b, a));
  const active = charge_rows.filter((charge) => charge.status !== 'voided');
  const rent_side = rentPool(active);

  // rent balance = what's left on rent-pool charges due by today, plus debt, minus unused credit,
  // charges billed ahead aren't owed yet. negative is a credit
  const owed_now = rent_side
    .filter((charge) => charge.due_date <= today)
    .reduce((sum, charge) => sum + charge.remaining_cents, 0);
  const balance_cents = owed_now + pools.debt_cents - pools.credit_cents || 0;
  const due_now_cents = active
    .filter((charge) => charge.due_date <= today)
    .reduce((sum, charge) => sum + charge.remaining_cents, 0);
  const overdue = active.filter((charge) => charge.status === 'overdue');
  const deposit_payments = payments.filter(
    (payment) => payment.applies_to === 'deposit' && payment.status === counting_status,
  );
  const deposit_held_cents =
    deposit_payments.reduce(
      (sum, payment) => sum + (payment.is_refund ? -payment.amount_cents : payment.amount_cents),
      0,
    ) || 0;
  const pending = payments.filter((payment) => payment.status === claim_status);

  // next_due: the earliest date something not yet overdue is still owed, and everything owed on that date
  const open = active
    .filter((charge) => charge.remaining_cents > 0 && charge.status !== 'overdue')
    .sort(byDueDate);
  let next_due = null;
  if (open.length > 0) {
    const date = open[0].due_date;
    next_due = {
      date: date,
      amount_cents: open
        .filter((charge) => charge.due_date === date)
        .reduce((sum, charge) => sum + charge.remaining_cents, 0),
    };
  }

  return {
    charges: charge_rows,
    balance_cents: balance_cents,
    credit_cents: pools.credit_cents,
    due_now_cents: due_now_cents,
    overdue_count: overdue.length,
    overdue_cents: overdue.reduce((sum, charge) => sum + charge.remaining_cents, 0),
    deposit_held_cents: deposit_held_cents,
    deposit_due_cents: active
      .filter((charge) => charge.kind === 'deposit')
      .reduce((sum, charge) => sum + charge.remaining_cents, 0),
    pending_payments: pending,
    pending_cents: pending.reduce((sum, payment) => sum + payment.amount_cents, 0),
    next_due: next_due,
    row_status: rowStatusFor(overdue.length, pending.length, due_now_cents, balance_cents),
  };
}

// the row status for a ledger the server worked out, exported so ledgerApi.js uses the same order
export { rowStatusFor };

// ----- the owner's month -----

// across every ledger, for one YYYY-MM: what was expected (charges due that month), what came in
// (confirmed rent money paid that month), and what's still owed on that month's charges
// overdue and pending are as of today across all months, since that's what needs doing now
export function monthSummary(ledgers, month, today) {
  let expected_cents = 0;
  let collected_cents = 0;
  let outstanding_cents = 0;
  let overdue_cents = 0;
  let overdue_count = 0;
  const pending = [];
  ledgers.forEach((ledger) => {
    const derived = deriveLedger(ledger, today);
    derived.charges
      .filter((charge) => charge.status !== 'voided' && charge.kind !== 'deposit')
      .filter((charge) => monthOf(charge.due_date) === month)
      .forEach((charge) => {
        expected_cents += charge.amount_cents;
        outstanding_cents += charge.remaining_cents;
      });
    (ledger.payments || [])
      .filter((payment) => payment.applies_to === 'rent' && monthOf(payment.paid_on) === month)
      .forEach((payment) => {
        collected_cents += paymentEffect(payment);
      });
    overdue_cents += derived.overdue_cents;
    overdue_count += derived.overdue_count;
    derived.pending_payments.forEach((payment) => pending.push({ payment, ledger }));
  });
  pending.sort((a, b) => String(b.payment.created_at).localeCompare(String(a.payment.created_at)));
  return {
    month: month,
    expected_cents: expected_cents,
    collected_cents: collected_cents,
    outstanding_cents: outstanding_cents,
    overdue_cents: overdue_cents,
    overdue_count: overdue_count,
    pending: pending,
  };
}

// collected over expected as a share from 0 to 1 for the progress bar, done in whole numbers
export function collectedShare(collected_cents, expected_cents) {
  if (expected_cents <= 0) {
    return collected_cents > 0 ? 1 : 0;
  }
  const per_mille = Math.floor((Math.max(collected_cents, 0) * 1000) / expected_cents);
  return Math.min(per_mille, 1000) / 1000;
}

// brings a ledger up to date as of today: any rent the schedule says is due, then any late fees that follow
// an ended tenancy stops getting new rent, the demo runs this on start and after every change
export function syncLedger(ledger, today) {
  if (!ledger.schedule || ledger.tenancy_status === 'ended') {
    return ledger;
  }
  const charges = ledger.charges || [];
  const payments = ledger.payments || [];
  const with_rent = [
    ...charges,
    ...missingRentCharges(ledger.tenancy_id, ledger.schedule, charges, today),
  ];
  const fees = missingLateFees(ledger.tenancy_id, ledger.schedule, with_rent, payments, today);
  if (with_rent.length === charges.length && fees.length === 0) {
    return ledger;
  }
  return { ...ledger, charges: [...with_rent, ...fees] };
}

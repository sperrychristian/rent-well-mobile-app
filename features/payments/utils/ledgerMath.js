// the rent ledger's math, pure functions only so the demo and the tests can run it with no server
// every amount is whole cents (an integer), and dates are plain YYYY-MM-DD text, so there's no float or timezone math
// the draft contract (docs/API-ledger-draft.md) says the server does this same math, the shared vectors
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

function isActive(charge) {
  return !charge.voided_at;
}

function byDueDate(a, b) {
  return a.due_date.localeCompare(b.due_date) || String(a.id).localeCompare(String(b.id));
}

// what one confirmed payment adds (a refund takes away), only confirmed money ever moves a balance
export function paymentEffect(payment) {
  if (payment.status !== 'confirmed') {
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

// spreads money over charges oldest first and gives back what's left on each one by id
// rent money pays rent, late fees, and other charges, deposit money only pays deposit charges
export function allocate(charges, payments) {
  const remaining = {};
  const active = charges.filter(isActive).sort(byDueDate);
  [
    ['rent', active.filter((charge) => charge.kind !== 'deposit')],
    ['deposit', active.filter((charge) => charge.kind === 'deposit')],
  ].forEach(([side, list]) => {
    // a rent refund gives back an overpayment, so it comes out of the rent money, but a deposit refund
    // happens at move-out and never makes the deposit itself owed again, so deposit charges only see payments in
    let pool =
      side === 'rent'
        ? Math.max(confirmedTotal(payments, 'rent'), 0)
        : payments
            .filter((payment) => payment.applies_to === 'deposit' && payment.status === 'confirmed')
            .filter((payment) => !payment.is_refund)
            .reduce((sum, payment) => sum + payment.amount_cents, 0);
    list.forEach((charge) => {
      const applied = Math.min(pool, charge.amount_cents);
      remaining[charge.id] = charge.amount_cents - applied;
      pool -= applied;
    });
  });
  return remaining;
}

// a charge's status as of today: voided, paid, overdue, partial, due, or upcoming
// overdue means money is still owed after the due date plus the grace days
export function chargeStatus(charge, remaining_cents, today, grace_days) {
  if (charge.voided_at) {
    return 'voided';
  }
  if (remaining_cents <= 0) {
    return 'paid';
  }
  if (daysBetween(charge.due_date, today) > (grace_days || 0)) {
    return 'overdue';
  }
  if (remaining_cents < charge.amount_cents) {
    return 'partial';
  }
  return charge.due_date > today ? 'upcoming' : 'due';
}

// late fees the schedule says should exist: one per rent charge still unpaid after the grace days
// the fee is due the day after grace runs out, and fees never get fees of their own
export function missingLateFees(tenancy_id, schedule, charges, payments, today) {
  if (!schedule || !schedule.late_fee_cents || schedule.late_fee_cents <= 0) {
    return [];
  }
  const remaining = allocate(charges, payments);
  const have = new Set(charges.map((charge) => charge.id));
  return charges
    .filter(isActive)
    .filter((charge) => charge.kind === 'rent' && remaining[charge.id] > 0)
    .filter((charge) => daysBetween(charge.due_date, today) > (schedule.grace_days || 0))
    .map((charge) => ({
      id: 'late-' + charge.id,
      kind: 'late_fee',
      description: 'Late fee',
      amount_cents: schedule.late_fee_cents,
      due_date: addDays(charge.due_date, (schedule.grace_days || 0) + 1),
      created_at: addDays(charge.due_date, (schedule.grace_days || 0) + 1),
      voided_at: null,
      void_reason: '',
    }))
    .filter((fee) => !have.has(fee.id));
}

// ----- everything a screen shows about one tenancy -----

// ledger is { tenancy_id, schedule, charges, payments, ... }, today is YYYY-MM-DD
export function deriveLedger(ledger, today) {
  const charges = ledger.charges || [];
  const payments = ledger.payments || [];
  const grace = ledger.schedule ? ledger.schedule.grace_days || 0 : 0;
  const remaining = allocate(charges, payments);
  const charge_rows = charges
    .map((charge) => {
      const left = charge.voided_at ? 0 : remaining[charge.id] || 0;
      return {
        ...charge,
        remaining_cents: left,
        status: chargeStatus(charge, left, today, grace),
      };
    })
    .sort((a, b) => byDueDate(b, a));
  const active = charge_rows.filter((charge) => charge.status !== 'voided');
  const rent_side = active.filter((charge) => charge.kind !== 'deposit');
  const deposit_side = active.filter((charge) => charge.kind === 'deposit');

  const owed_rent = rent_side.reduce((sum, charge) => sum + charge.amount_cents, 0);
  const paid_rent = confirmedTotal(payments, 'rent');
  // positive is owed, negative is a credit (they paid ahead)
  const balance_cents = owed_rent - paid_rent;
  const due_now_cents = active
    .filter((charge) => charge.due_date <= today)
    .reduce((sum, charge) => sum + charge.remaining_cents, 0);
  const overdue = active.filter((charge) => charge.status === 'overdue');
  const owed_deposit = deposit_side.reduce((sum, charge) => sum + charge.amount_cents, 0);
  const deposit_paid = payments
    .filter((payment) => payment.applies_to === 'deposit' && payment.status === 'confirmed')
    .filter((payment) => !payment.is_refund)
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const deposit_held_cents = Math.max(confirmedTotal(payments, 'deposit'), 0);
  const pending = payments.filter((payment) => payment.status === 'pending');

  // the next thing to pay: the oldest charge still owed, or the schedule's next date when everything's paid
  const open = rent_side
    .filter((charge) => charge.remaining_cents > 0)
    .sort((a, b) => byDueDate(a, b));
  let next_due = null;
  if (open.length > 0) {
    next_due = { date: open[0].due_date, amount_cents: open[0].remaining_cents };
  } else if (ledger.schedule) {
    const date = nextScheduledDue(ledger.schedule, today);
    if (date) {
      next_due = {
        date: date,
        amount_cents: ledger.schedule.amount_cents + Math.min(balance_cents, 0),
      };
      if (next_due.amount_cents < 0) {
        next_due.amount_cents = 0;
      }
    }
  }

  let row_status = 'paid';
  if (overdue.length > 0) {
    row_status = 'overdue';
  } else if (pending.length > 0) {
    row_status = 'pending';
  } else if (due_now_cents > 0) {
    row_status = 'due';
  } else if (balance_cents < 0) {
    row_status = 'credit';
  }

  return {
    charges: charge_rows,
    balance_cents: balance_cents,
    due_now_cents: due_now_cents,
    overdue_count: overdue.length,
    overdue_cents: overdue.reduce((sum, charge) => sum + charge.remaining_cents, 0),
    deposit_held_cents: deposit_held_cents,
    deposit_due_cents: Math.max(owed_deposit - deposit_paid, 0),
    pending_payments: pending,
    pending_cents: pending.reduce((sum, payment) => sum + payment.amount_cents, 0),
    next_due: next_due,
    row_status: row_status,
  };
}

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

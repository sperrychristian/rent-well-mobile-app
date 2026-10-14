// demo only rent ledgers, kept in the ledger provider's memory and never saved
// the tenancy ids, names, and units match the demo tenants in features/tenants/data/sampleTenants.js
// everything is dated from the today passed in, so the story looks the same any day the demo runs:
// Sam owes part of last month plus this month (overdue with a late fee), Jordan has a claim waiting,
// Priya is partly paid and still inside the grace days, Alex is ahead with a credit, Morgan moved out
import { addDays, dateFrom, monthOf, shiftMonth, syncLedger } from '../utils/ledgerMath';

// the first of a month some number of months from today's month
function monthStart(today, step) {
  return shiftMonth(monthOf(today), step) + '-01';
}

// the same day number in another month, held to 28 so every month has it
function dayIn(month, day) {
  const [year, number] = month.split('-').map((part) => parseInt(part, 10));
  return dateFrom(year, number, Math.min(Math.max(day, 1), 28));
}

function stamp(date) {
  return date + 'T12:00:00.000Z';
}

function payment(id, fields) {
  const created = fields.created_at || stamp(fields.paid_on);
  const base = {
    id: id,
    amount_cents: 0,
    method: 'zelle',
    paid_on: '',
    applies_to: 'rent',
    is_refund: false,
    note: '',
    receipt_key: null,
    status: 'confirmed',
    source: 'owner',
    reject_reason: '',
    void_reason: '',
    created_at: created,
    ...fields,
  };
  // the timeline: how it came in, then what the landlord did with it
  const events = [
    {
      type: base.source === 'tenant' ? 'claimed' : 'recorded',
      at: created,
      by_role: base.source === 'tenant' ? 'tenant' : 'owner',
      reason: '',
    },
  ];
  const later = stamp(addDays(base.paid_on, 1));
  if (base.source === 'tenant' && base.status === 'confirmed') {
    events.push({ type: 'confirmed', at: later, by_role: 'owner', reason: '' });
  }
  if (base.status === 'rejected') {
    events.push({ type: 'rejected', at: later, by_role: 'owner', reason: base.reject_reason });
  }
  if (base.status === 'voided') {
    events.push({ type: 'voided', at: later, by_role: 'owner', reason: base.void_reason });
  }
  return { ...base, events: fields.events || events };
}

function depositCharge(tenancy_id, amount_cents, due_date) {
  return {
    id: 'deposit-' + tenancy_id,
    kind: 'deposit',
    description: 'Security deposit',
    amount_cents: amount_cents,
    due_date: due_date,
    created_at: due_date,
    voided_at: null,
    void_reason: '',
  };
}

// one confirmed rent payment for each month from `from` up to (not including) `until`, paid a couple days after the due day
function monthlyPayments(prefix, from_month, until_month, due_day, amount_cents, method) {
  const list = [];
  let month = from_month;
  let count = 1;
  while (month < until_month) {
    list.push(
      payment(prefix + '-' + count, {
        amount_cents: amount_cents,
        method: method,
        paid_on: dayIn(month, due_day + 2),
        note: '',
      }),
    );
    month = shiftMonth(month, 1);
    count++;
  }
  return list;
}

// payment instructions per property, the owner can edit these on the property
export function buildSampleInstructions() {
  return {
    'demo-prop-maple':
      'Zelle to rentals@example.com with your unit number in the memo. Checks go to Rent Well Rentals LLC, in the drop box by the mailboxes.',
    'demo-prop-cedar':
      'Bank transfer to Rent Well Rentals LLC, routing 000000000, account 0000 1234 (sample numbers). Put "48 Cedar" in the memo.',
  };
}

// a fresh set every time the demo starts, run through syncLedger so this month's rent and fees are there
export function buildSampleLedgers(today) {
  const this_month = monthOf(today);
  const today_day = parseInt(today.slice(8, 10), 10);

  // Sam: paid every month, then only part of last month, and nothing yet this month
  const sam_start = monthStart(today, -4);
  const sam = {
    tenancy_id: 'demo-tenancy-sam',
    tenancy_status: 'active',
    tenant_id: 'demo-tenant-sam',
    tenant_name: 'Sam Rivera',
    property_id: 'demo-prop-maple',
    property_name: '123 Maple St',
    unit_label: 'Unit 2',
    schedule: {
      amount_cents: 145000,
      due_day: 1,
      grace_days: 5,
      late_fee_cents: 5000,
      start_date: sam_start,
    },
    charges: [depositCharge('demo-tenancy-sam', 145000, sam_start)],
    payments: [
      payment('demo-pay-sam-deposit', {
        amount_cents: 145000,
        method: 'check',
        paid_on: sam_start,
        applies_to: 'deposit',
        note: 'Deposit at move-in',
      }),
      ...monthlyPayments(
        'demo-pay-sam',
        monthOf(sam_start),
        shiftMonth(this_month, -1),
        1,
        145000,
        'zelle',
      ),
      payment('demo-pay-sam-partial', {
        amount_cents: 100000,
        method: 'zelle',
        paid_on: dayIn(shiftMonth(this_month, -1), 4),
        source: 'tenant',
        note: 'Rest coming with my next paycheck',
      }),
      // a claim the landlord couldn't match, so the tenant side shows a rejected one with its reason
      payment('demo-pay-sam-rejected', {
        amount_cents: 45000,
        method: 'venmo',
        paid_on: dayIn(shiftMonth(this_month, -1), 20),
        source: 'tenant',
        status: 'rejected',
        reject_reason: 'Nothing came in on Venmo for this. Can you send a screenshot?',
      }),
    ],
  };

  // Jordan: paid up through this month, plus a key fob charge that's due soon with a claim waiting on it
  const jordan_start = monthStart(today, -3);
  const jordan = {
    tenancy_id: 'demo-tenancy-jordan',
    tenancy_status: 'active',
    tenant_id: 'demo-tenant-jordan',
    tenant_name: 'Jordan Lee',
    property_id: 'demo-prop-maple',
    property_name: '123 Maple St',
    unit_label: 'Unit 1',
    schedule: {
      amount_cents: 132500,
      due_day: 1,
      grace_days: 5,
      late_fee_cents: 5000,
      start_date: jordan_start,
    },
    charges: [
      depositCharge('demo-tenancy-jordan', 132500, jordan_start),
      {
        id: 'demo-charge-jordan-fob',
        kind: 'other',
        description: 'Replacement key fob',
        amount_cents: 7500,
        due_date: addDays(today, 10),
        created_at: addDays(today, -2),
        voided_at: null,
        void_reason: '',
      },
    ],
    payments: [
      payment('demo-pay-jordan-deposit', {
        amount_cents: 132500,
        method: 'check',
        paid_on: jordan_start,
        applies_to: 'deposit',
      }),
      ...monthlyPayments(
        'demo-pay-jordan',
        monthOf(jordan_start),
        shiftMonth(this_month, 1),
        1,
        132500,
        'bank_transfer',
      ),
      payment('demo-pay-jordan-claim', {
        amount_cents: 7500,
        method: 'venmo',
        paid_on: today,
        source: 'tenant',
        status: 'pending',
        note: 'For the new key fob',
        created_at: stamp(today),
      }),
    ],
  };
  // the last monthly payment can't be dated after today
  jordan.payments = jordan.payments.map((item) =>
    item.paid_on > today ? { ...item, paid_on: today, created_at: stamp(today) } : item,
  );

  // Priya: due today (her due day follows the date so she's always inside the grace days) and half paid
  const priya_start = monthStart(today, -1);
  const priya_day = Math.min(Math.max(today_day, 1), 28);
  const priya = {
    tenancy_id: 'demo-tenancy-priya',
    tenancy_status: 'active',
    tenant_id: 'demo-tenant-priya',
    tenant_name: 'Priya Shah',
    property_id: 'demo-prop-maple',
    property_name: '123 Maple St',
    unit_label: 'Unit 3',
    schedule: {
      amount_cents: 118000,
      due_day: priya_day,
      grace_days: 5,
      late_fee_cents: 0,
      start_date: priya_start,
    },
    charges: [depositCharge('demo-tenancy-priya', 118000, priya_start)],
    payments: [
      payment('demo-pay-priya-deposit', {
        amount_cents: 118000,
        method: 'cash',
        paid_on: priya_start,
        applies_to: 'deposit',
        note: 'Deposit at move-in',
      }),
      payment('demo-pay-priya-1', {
        amount_cents: 118000,
        method: 'zelle',
        paid_on: dayIn(monthOf(priya_start), priya_day),
      }),
      payment('demo-pay-priya-2', {
        amount_cents: 60000,
        method: 'zelle',
        paid_on: today,
        note: 'Half now, half Friday',
      }),
    ],
  };

  // Alex: paid every month and a bit ahead, with one duplicate entry the landlord voided
  const alex_start = monthStart(today, -3);
  const alex = {
    tenancy_id: 'demo-tenancy-alex',
    tenancy_status: 'active',
    tenant_id: 'demo-tenant-alex',
    tenant_name: 'Alex Chen',
    property_id: 'demo-prop-cedar',
    property_name: '48 Cedar Ave',
    unit_label: '',
    schedule: {
      amount_cents: 98000,
      due_day: 1,
      grace_days: 3,
      late_fee_cents: 4000,
      start_date: alex_start,
    },
    charges: [depositCharge('demo-tenancy-alex', 98000, alex_start)],
    payments: [
      payment('demo-pay-alex-deposit', {
        amount_cents: 98000,
        method: 'bank_transfer',
        paid_on: alex_start,
        applies_to: 'deposit',
      }),
      ...monthlyPayments(
        'demo-pay-alex',
        monthOf(alex_start),
        shiftMonth(this_month, 1),
        1,
        98000,
        'bank_transfer',
      ),
      payment('demo-pay-alex-extra', {
        amount_cents: 20000,
        method: 'bank_transfer',
        paid_on: dayIn(this_month, 1),
        note: 'Toward next month',
      }),
      payment('demo-pay-alex-duplicate', {
        amount_cents: 98000,
        method: 'bank_transfer',
        paid_on: dayIn(shiftMonth(this_month, -1), 3),
        status: 'voided',
        void_reason: 'Entered twice by mistake',
      }),
    ],
  };
  alex.payments = alex.payments.map((item) =>
    item.paid_on > today ? { ...item, paid_on: today, created_at: stamp(today) } : item,
  );

  // Morgan: moved out of Unit 3 before Priya, every month paid and the deposit given back
  const morgan_end = addDays(today, -75);
  const morgan_months = [-3, -2, -1].map((step) => shiftMonth(monthOf(morgan_end), step));
  const morgan = {
    tenancy_id: 'demo-tenancy-morgan',
    tenancy_status: 'ended',
    tenant_id: 'demo-tenant-morgan',
    tenant_name: 'Morgan Diaz',
    property_id: 'demo-prop-maple',
    property_name: '123 Maple St',
    unit_label: 'Unit 3',
    schedule: {
      amount_cents: 110000,
      due_day: 1,
      grace_days: 5,
      late_fee_cents: 0,
      start_date: morgan_months[0] + '-01',
    },
    charges: [
      depositCharge('demo-tenancy-morgan', 110000, morgan_months[0] + '-01'),
      ...morgan_months.map((month) => ({
        id: 'rent-demo-tenancy-morgan-' + month,
        kind: 'rent',
        description: 'Rent',
        amount_cents: 110000,
        due_date: month + '-01',
        created_at: month + '-01',
        voided_at: null,
        void_reason: '',
      })),
    ],
    payments: [
      payment('demo-pay-morgan-deposit', {
        amount_cents: 110000,
        method: 'check',
        paid_on: morgan_months[0] + '-01',
        applies_to: 'deposit',
      }),
      ...morgan_months.map((month, index) =>
        payment('demo-pay-morgan-' + (index + 1), {
          amount_cents: 110000,
          method: 'check',
          paid_on: month + '-02',
        }),
      ),
      payment('demo-pay-morgan-refund', {
        amount_cents: 110000,
        method: 'check',
        paid_on: morgan_end,
        applies_to: 'deposit',
        is_refund: true,
        note: 'Deposit returned in full',
      }),
    ],
  };

  return [sam, jordan, priya, alex, morgan].map((ledger) => syncLedger(ledger, today));
}

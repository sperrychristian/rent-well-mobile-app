// shared test vectors for the ledger math, worked out by hand
// the draft contract asks the server to run these same cases so the app and the backend always agree
// money is whole cents, dates are YYYY-MM-DD

const schedule = {
  amount_cents: 120000,
  due_day: 1,
  grace_days: 5,
  late_fee_cents: 5000,
  start_date: '2026-08-01',
};

function rent(month) {
  return {
    id: 'rent-t1-' + month,
    kind: 'rent',
    description: 'Rent',
    amount_cents: 120000,
    due_date: month + '-01',
    created_at: month + '-01',
    voided_at: null,
    void_reason: '',
  };
}

function payment(id, amount_cents, paid_on, extra) {
  return {
    id: id,
    amount_cents: amount_cents,
    method: 'bank_transfer',
    paid_on: paid_on,
    applies_to: 'rent',
    is_refund: false,
    note: '',
    receipt_key: null,
    status: 'confirmed',
    source: 'owner',
    reject_reason: '',
    void_reason: '',
    created_at: paid_on + 'T12:00:00.000Z',
    events: [],
    ...(extra || {}),
  };
}

export const rent_due_date_vectors = [
  {
    name: 'start on the due day counts that month',
    schedule,
    through: '2026-10-14',
    expect: ['2026-08-01', '2026-09-01', '2026-10-01'],
  },
  {
    name: 'start after the due day skips that month',
    schedule: { ...schedule, due_day: 5, start_date: '2026-08-10' },
    through: '2026-10-04',
    expect: ['2026-09-05'],
  },
  { name: 'nothing before the start', schedule, through: '2026-07-31', expect: [] },
  {
    name: 'year boundary',
    schedule: { ...schedule, start_date: '2026-11-01' },
    through: '2027-02-01',
    expect: ['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'],
  },
];

export const ledger_vectors = [
  {
    name: 'all paid on time',
    today: '2026-10-14',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-08'), rent('2026-09'), rent('2026-10')],
      payments: [
        payment('p1', 120000, '2026-08-01'),
        payment('p2', 120000, '2026-09-01'),
        payment('p3', 120000, '2026-10-02'),
      ],
    },
    expect: {
      balance_cents: 0,
      due_now_cents: 0,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 0,
      row_status: 'paid',
      next_due: { date: '2026-11-01', amount_cents: 120000 },
      statuses: { 'rent-t1-2026-08': 'paid', 'rent-t1-2026-09': 'paid', 'rent-t1-2026-10': 'paid' },
    },
  },
  {
    name: 'this month unpaid past grace is overdue, oldest charges get paid first',
    today: '2026-10-14',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-08'), rent('2026-09'), rent('2026-10')],
      payments: [payment('p1', 120000, '2026-08-01'), payment('p2', 120000, '2026-09-03')],
    },
    expect: {
      balance_cents: 120000,
      due_now_cents: 120000,
      overdue_count: 1,
      overdue_cents: 120000,
      deposit_held_cents: 0,
      row_status: 'overdue',
      next_due: { date: '2026-10-01', amount_cents: 120000 },
      statuses: {
        'rent-t1-2026-08': 'paid',
        'rent-t1-2026-09': 'paid',
        'rent-t1-2026-10': 'overdue',
      },
    },
  },
  {
    name: 'inside the grace days it is due, a part payment makes it partial',
    today: '2026-10-04',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-10')],
      payments: [payment('p1', 50000, '2026-10-02')],
    },
    expect: {
      balance_cents: 70000,
      due_now_cents: 70000,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 0,
      row_status: 'due',
      next_due: { date: '2026-10-01', amount_cents: 70000 },
      statuses: { 'rent-t1-2026-10': 'partial' },
    },
  },
  {
    name: 'pending claims and rejected or voided payments never move the balance',
    today: '2026-10-03',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-10')],
      payments: [
        payment('p1', 120000, '2026-10-02', { status: 'pending', source: 'tenant' }),
        payment('p2', 120000, '2026-10-01', { status: 'rejected' }),
        payment('p3', 120000, '2026-10-01', { status: 'voided' }),
      ],
    },
    expect: {
      balance_cents: 120000,
      due_now_cents: 120000,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 0,
      row_status: 'pending',
      next_due: { date: '2026-10-01', amount_cents: 120000 },
      statuses: { 'rent-t1-2026-10': 'due' },
    },
  },
  {
    name: 'paying ahead leaves a credit, a refund takes it back',
    today: '2026-10-14',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-10')],
      payments: [
        payment('p1', 150000, '2026-10-01'),
        payment('p2', 10000, '2026-10-05', { is_refund: true }),
      ],
    },
    expect: {
      balance_cents: -20000,
      due_now_cents: 0,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 0,
      row_status: 'credit',
      next_due: { date: '2026-11-01', amount_cents: 100000 },
      statuses: { 'rent-t1-2026-10': 'paid' },
    },
  },
  {
    name: 'deposit money only pays the deposit, and a deposit refund lowers what is held',
    today: '2026-10-14',
    ledger: {
      tenancy_id: 't1',
      schedule: null,
      charges: [
        { ...rent('2026-10'), id: 'c-dep', kind: 'deposit', description: 'Security deposit' },
        {
          ...rent('2026-10'),
          id: 'c-other',
          kind: 'other',
          description: 'Key replacement',
          amount_cents: 2500,
          due_date: '2026-10-20',
        },
      ],
      payments: [
        payment('p1', 120000, '2026-10-01', { applies_to: 'deposit' }),
        payment('p2', 20000, '2026-10-10', { applies_to: 'deposit', is_refund: true }),
      ],
    },
    expect: {
      balance_cents: 2500,
      due_now_cents: 0,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 100000,
      row_status: 'paid',
      next_due: { date: '2026-10-20', amount_cents: 2500 },
      statuses: { 'c-dep': 'paid', 'c-other': 'upcoming' },
    },
  },
  {
    name: 'a voided charge is left out of everything',
    today: '2026-10-14',
    ledger: {
      tenancy_id: 't1',
      schedule,
      charges: [
        { ...rent('2026-10'), voided_at: '2026-10-02T09:00:00.000Z', void_reason: 'Moved in late' },
      ],
      payments: [],
    },
    expect: {
      balance_cents: 0,
      due_now_cents: 0,
      overdue_count: 0,
      overdue_cents: 0,
      deposit_held_cents: 0,
      row_status: 'paid',
      next_due: { date: '2026-11-01', amount_cents: 120000 },
      statuses: { 'rent-t1-2026-10': 'voided' },
    },
  },
];

// syncLedger on the overdue case adds one late fee due the day after grace, and adds nothing the second time
export const late_fee_vector = {
  today: '2026-10-14',
  ledger: {
    tenancy_id: 't1',
    tenancy_status: 'active',
    schedule,
    charges: [],
    payments: [payment('p1', 120000, '2026-08-01'), payment('p2', 120000, '2026-09-03')],
  },
  expect_ids: ['rent-t1-2026-08', 'rent-t1-2026-09', 'rent-t1-2026-10', 'late-rent-t1-2026-10'],
  expect_fee: { amount_cents: 5000, due_date: '2026-10-07' },
  expect_balance_cents: 125000,
};

// the owner's month across two tenancies
export const month_summary_vector = {
  today: '2026-10-14',
  month: '2026-10',
  ledgers: [
    {
      tenancy_id: 't1',
      schedule,
      charges: [rent('2026-10')],
      payments: [payment('p1', 120000, '2026-10-01')],
    },
    {
      tenancy_id: 't2',
      schedule,
      charges: [{ ...rent('2026-10'), id: 'rent-t2-2026-10' }],
      payments: [
        payment('p2', 40000, '2026-10-03'),
        payment('p3', 80000, '2026-10-12', { status: 'pending', source: 'tenant' }),
      ],
    },
  ],
  expect: {
    expected_cents: 240000,
    collected_cents: 160000,
    outstanding_cents: 80000,
    overdue_count: 1,
    overdue_cents: 80000,
    pending_count: 1,
  },
};

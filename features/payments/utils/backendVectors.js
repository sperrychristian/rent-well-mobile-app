// the backend's own ledger cases, copied from rent-well-api's tests/ledgerMath.test.js (buildLedger and
// deriveChargeStatus), with the same inputs and the same expected numbers, in the server's row shape
// (snake_case db rows: due_on, kind payment or refund, status succeeded...). backendParity.test.js runs
// every one through the app's local math, so the demo and the server can't quietly disagree
// if the server's tests change, copy the case here again rather than editing the numbers by hand

let sequence = 0;
function stamp() {
  sequence += 1;
  return {
    id: 'row-' + String(sequence).padStart(4, '0'),
    created_at:
      '2026-01-01T00:00:' +
      String(sequence % 60).padStart(2, '0') +
      '.' +
      String(sequence).padStart(3, '0') +
      'Z',
  };
}

function charge(due_on, amount_cents, extra) {
  return {
    ...stamp(),
    kind: 'rent',
    amount_cents: amount_cents,
    due_on: due_on,
    grace_days: 0,
    voided_at: null,
    ...(extra || {}),
  };
}

function payment(paid_on, amount_cents, extra) {
  return {
    ...stamp(),
    kind: 'payment',
    applies_to: 'rent',
    status: 'succeeded',
    amount_cents: amount_cents,
    paid_on: paid_on,
    ...(extra || {}),
  };
}

function refund(paid_on, amount_cents, extra) {
  return payment(paid_on, amount_cents, { kind: 'refund', ...(extra || {}) });
}

function deposit(due_on, amount_cents) {
  return charge(due_on, amount_cents, { kind: 'deposit' });
}

// each case: name, today, charges, payments, then what the server's buildLedger says
// balances use the server's names, charges are listed by their position in `charges`
const cases = [];

(() => {
  const oct = charge('2026-10-01', 120000);
  const pay = payment('2026-09-28', 50000);
  cases.push({
    name: 'a partial payment leaves the charge partial (before the due date)',
    today: '2026-09-28',
    charges: [oct],
    payments: [pay],
    expect_charges: [{ paid_cents: 50000, remaining_cents: 70000, status: 'partial' }],
    expect_balances: {
      rent_balance_cents: 0,
      next_due: { due_on: '2026-10-01', amount_cents: 70000 },
    },
  });
  cases.push({
    name: 'the same partial payment on the due date is owed',
    today: '2026-10-01',
    charges: [oct],
    payments: [pay],
    expect_balances: { rent_balance_cents: 70000 },
  });
})();

(() => {
  const aug = charge('2026-08-01', 100000);
  const sep = charge('2026-09-01', 100000);
  const oct = charge('2026-10-01', 100000);
  cases.push({
    name: 'pays the oldest month first across several months',
    today: '2026-10-02',
    // listed out of order on purpose, allocation sorts by due date
    charges: [oct, aug, sep],
    payments: [payment('2026-10-02', 150000)],
    expect_charges: [
      { paid_cents: 0, status: 'overdue' },
      { paid_cents: 100000, status: 'paid' },
      { paid_cents: 50000, status: 'overdue' },
    ],
    expect_balances: {
      rent_balance_cents: 150000,
      overdue_cents: 150000,
      overdue_count: 2,
      credit_cents: 0,
    },
  });
})();

(() => {
  const oct = charge('2026-10-01', 100000);
  const pay = payment('2026-10-01', 150000);
  cases.push({
    name: 'an overpayment becomes credit',
    today: '2026-10-05',
    charges: [oct],
    payments: [pay],
    expect_balances: { rent_balance_cents: -50000, credit_cents: 50000 },
  });
  const nov = charge('2026-11-01', 100000);
  cases.push({
    name: 'then lands on the next charge once it exists',
    today: '2026-10-05',
    charges: [oct, nov],
    payments: [pay],
    expect_charges: [{ status: 'paid' }, { paid_cents: 50000, status: 'partial' }],
    expect_balances: {
      rent_balance_cents: 0,
      credit_cents: 0,
      next_due: { due_on: '2026-11-01', amount_cents: 50000 },
    },
  });
})();

cases.push({
  name: 'a paid-up ledger has a balance of exactly 0 and nothing next due',
  today: '2026-10-10',
  charges: [charge('2026-10-01', 100000)],
  payments: [payment('2026-10-01', 100000)],
  expect_balances: { rent_balance_cents: 0, next_due: null },
});

cases.push({
  name: 'payments that have not landed do not count',
  today: '2026-10-01',
  charges: [charge('2026-10-01', 100000)],
  payments: [
    'pending_confirmation',
    'pending',
    'processing',
    'failed',
    'returned',
    'rejected',
    'voided',
  ].map((status) => payment('2026-10-01', 100000, { status: status })),
  expect_charges: [{ paid_cents: 0 }],
  expect_balances: { rent_balance_cents: 100000, pending_confirmation_cents: 100000 },
});

cases.push({
  name: 'a voided charge is skipped and the money moves to the next charge',
  today: '2026-10-01',
  charges: [
    charge('2026-09-01', 100000, { voided_at: '2026-09-05T00:00:00Z' }),
    charge('2026-10-01', 100000),
  ],
  payments: [payment('2026-09-02', 100000)],
  expect_charges: [{ status: 'voided', paid_cents: 0, remaining_cents: 0 }, { status: 'paid' }],
  expect_balances: { rent_balance_cents: 0 },
});

cases.push({
  name: 'a voided payment stops counting and reopens the charge',
  today: '2026-10-03',
  charges: [charge('2026-10-01', 100000)],
  payments: [payment('2026-10-01', 100000, { status: 'voided' })],
  expect_charges: [{ status: 'overdue' }],
});

cases.push({
  name: 'a refund uses up credit first',
  today: '2026-10-05',
  charges: [charge('2026-10-01', 100000)],
  payments: [payment('2026-10-01', 150000), refund('2026-10-03', 50000)],
  expect_charges: [{ status: 'paid' }],
  expect_balances: { rent_balance_cents: 0, credit_cents: 0 },
});

cases.push({
  name: 'a refund past the credit reopens the newest paid charge',
  today: '2026-09-15',
  charges: [charge('2026-08-01', 100000), charge('2026-09-01', 100000)],
  payments: [
    payment('2026-08-01', 100000),
    payment('2026-09-01', 100000),
    refund('2026-09-10', 30000),
  ],
  expect_charges: [
    { status: 'paid' },
    { paid_cents: 70000, remaining_cents: 30000, status: 'overdue' },
  ],
  expect_balances: { rent_balance_cents: 30000 },
});

cases.push({
  name: 'a backdated refund bigger than what was paid leaves debt the next payment fills',
  today: '2026-10-01',
  charges: [charge('2026-10-01', 100000)],
  payments: [refund('2026-09-01', 20000), payment('2026-10-01', 100000)],
  expect_charges: [{ paid_cents: 80000 }],
});

cases.push({
  name: 'deposit money never pays rent and rent money never fills a deposit',
  today: '2026-10-01',
  charges: [deposit('2026-09-01', 150000), charge('2026-10-01', 100000)],
  payments: [
    payment('2026-09-01', 150000, { applies_to: 'deposit' }),
    payment('2026-10-01', 40000),
  ],
  expect_charges: [{ status: 'paid' }, { paid_cents: 40000, status: 'partial' }],
  expect_balances: { rent_balance_cents: 60000, deposit_held_cents: 150000, deposit_owed_cents: 0 },
});

cases.push({
  name: 'a deposit refund lowers deposit held but the deposit charge stays paid',
  today: '2026-10-01',
  charges: [deposit('2026-01-01', 150000)],
  payments: [
    payment('2026-01-01', 150000, { applies_to: 'deposit' }),
    refund('2026-09-30', 120000, { applies_to: 'deposit' }),
  ],
  expect_charges: [{ status: 'paid' }],
  expect_balances: { deposit_held_cents: 30000, rent_balance_cents: 0 },
});

cases.push({
  name: 'an unpaid deposit charge is owed but stays out of the rent balance',
  today: '2026-10-05',
  charges: [deposit('2026-10-01', 150000)],
  payments: [],
  expect_balances: { rent_balance_cents: 0, deposit_owed_cents: 150000, overdue_cents: 150000 },
});

cases.push({
  name: 'a charge in its grace window is next due, not overdue',
  today: '2026-10-04',
  charges: [charge('2026-10-01', 100000, { grace_days: 5 })],
  payments: [],
  expect_charges: [{ overdue_on: '2026-10-07' }],
  expect_balances: {
    rent_balance_cents: 100000,
    overdue_cents: 0,
    next_due: { due_on: '2026-10-01', amount_cents: 100000 },
  },
});

export const backend_ledger_cases = cases;

// deriveChargeStatus's table: [today, expected], for a $1,000 rent charge due 2026-10-01
export const backend_status_no_grace = [
  ['2026-09-23', 'upcoming'],
  ['2026-09-24', 'due_soon'],
  ['2026-09-30', 'due_soon'],
  ['2026-10-01', 'due'],
  ['2026-10-02', 'overdue'],
];

export const backend_status_five_grace = [
  ['2026-10-01', 'due'],
  ['2026-10-06', 'due'],
  ['2026-10-07', 'overdue'],
];

// [paid_cents, today, expected]: overdue wins over partial, paid wins over everything but voided
export const backend_status_order = [
  [50000, '2026-10-05', 'overdue'],
  [50000, '2026-09-20', 'partial'],
  [100000, '2026-12-01', 'paid'],
];

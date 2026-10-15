// test data only: server responses in the exact shape docs/API.md (Rent ledger) shows, so the mapping tests
// and the mocked real-mode screen tests both read the same thing the server would send
// every number here is the server's own math for the rows (worked out the way rent-well-api's buildLedger does)

export const api_today = '2026-10-14';

export function apiSchedule(extra) {
  return {
    id: 'sched-1',
    tenancyId: 'ten-1',
    amountCents: 120000,
    dueDay: 1,
    startsOn: '2026-08-01',
    endsOn: null,
    graceDays: 5,
    lateFeeCents: 5000,
    createdAt: '2026-07-20T18:00:00.000Z',
    ...(extra || {}),
  };
}

export function apiCharge(id, extra) {
  return {
    id: id,
    tenancyId: 'ten-1',
    propertyId: 'prop-1',
    kind: 'rent',
    description: 'Rent for October 2026',
    amountCents: 120000,
    paidCents: 0,
    remainingCents: 120000,
    status: 'overdue',
    dueOn: '2026-10-01',
    overdueOn: '2026-10-07',
    period: '2026-10',
    scheduleId: 'sched-1',
    parentChargeId: null,
    voidedAt: null,
    voidReason: null,
    createdAt: '2026-09-01T18:00:00.000Z',
    ...(extra || {}),
  };
}

export function apiPayment(id, extra) {
  return {
    id: id,
    tenancyId: 'ten-1',
    kind: 'payment',
    appliesTo: 'rent',
    amountCents: 120000,
    method: 'zelle',
    status: 'succeeded',
    countsTowardBalance: true,
    paidOn: '2026-09-02',
    note: null,
    reference: null,
    receiptPhotoKey: null,
    submittedBy: 'owner',
    confirmedAt: '2026-09-02T18:00:00.000Z',
    confirmedBy: 'owner-1',
    voidReason: null,
    rejectReason: null,
    failureReason: null,
    provider: 'manual',
    allocation: { appliedTo: [{ chargeId: 'c-sep', amountCents: 120000 }], unappliedCents: 0 },
    createdAt: '2026-09-02T18:00:00.000Z',
    ...(extra || {}),
  };
}

// Tara at Maple Court, Unit 2B: September paid, October overdue, a $75 claim waiting on the owner
export function apiLedger(extra) {
  return {
    tenancy: {
      id: 'ten-1',
      tenantId: 'tenant-1',
      property: { id: 'prop-1', name: 'Maple Court', address: '12 Maple St, Springfield' },
      unitLabel: 'Unit 2B',
      status: 'active',
      startedAt: '2026-07-20T18:00:00.000Z',
      endedAt: null,
    },
    tenant: { id: 'tenant-1', name: 'Tara Tenant' },
    isActive: true,
    paymentInstructions: 'Zelle to owner@example.com',
    timeZone: 'America/Denver',
    today: api_today,
    schedule: apiSchedule(),
    balances: {
      rentBalanceCents: 120000,
      creditCents: 0,
      overdueCents: 120000,
      overdueCount: 1,
      depositHeldCents: 120000,
      depositOwedCents: 0,
      pendingConfirmationCents: 7500,
      nextDue: null,
    },
    charges: [
      apiCharge('c-oct'),
      apiCharge('c-sep', {
        description: 'Rent for September 2026',
        paidCents: 120000,
        remainingCents: 0,
        status: 'paid',
        dueOn: '2026-09-01',
        overdueOn: '2026-09-07',
        period: '2026-09',
      }),
      apiCharge('c-dep', {
        kind: 'deposit',
        description: 'Security deposit',
        paidCents: 120000,
        remainingCents: 0,
        status: 'paid',
        dueOn: '2026-08-01',
        overdueOn: '2026-08-02',
        period: null,
        scheduleId: null,
      }),
    ],
    payments: [
      apiPayment('pay-claim', {
        amountCents: 7500,
        method: 'venmo',
        status: 'pending_confirmation',
        countsTowardBalance: false,
        paidOn: '2026-10-13',
        note: 'Part of October',
        submittedBy: 'tenant',
        confirmedAt: null,
        confirmedBy: null,
        allocation: null,
        createdAt: '2026-10-13T18:00:00.000Z',
      }),
      apiPayment('pay-sep'),
      apiPayment('pay-dep', {
        appliesTo: 'deposit',
        paidOn: '2026-08-01',
        method: 'check',
        reference: '1042',
        allocation: { appliedTo: [{ chargeId: 'c-dep', amountCents: 120000 }], unappliedCents: 0 },
      }),
    ],
    ...(extra || {}),
  };
}

// the owner's month, GET /ledger/summary
export function apiSummary(extra) {
  return {
    month: '2026-10',
    totals: {
      expectedCents: 120000,
      collectedCents: 0,
      outstandingCents: 120000,
      overdueCount: 1,
      overdueCents: 120000,
      pendingConfirmationCount: 1,
    },
    properties: [
      {
        property: { id: 'prop-1', name: 'Maple Court' },
        expectedCents: 120000,
        collectedCents: 0,
        outstandingCents: 120000,
        overdueCount: 1,
        overdueCents: 120000,
        pendingConfirmationCount: 1,
      },
    ],
    ...(extra || {}),
  };
}

// GET /tenants, one current tenant with the one tenancy
export function apiTenants() {
  return [
    {
      id: 'tenant-1',
      name: 'Tara Tenant',
      email: 'tara@example.com',
      isActive: true,
      activeTenancies: [apiLedger().tenancy],
      endedTenancies: [],
      openWorkOrderCount: 0,
      conversationId: 'conv-1',
    },
  ];
}

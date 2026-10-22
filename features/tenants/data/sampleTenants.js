// demo only properties, tenants, and invites, kept in the local context and never saved
// the names and units match the sample work orders, documents, checklists, and message threads
// dates are set from today so the move-in dates always look recent

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

// a full timestamp at noon on that day, like the server's startedAt
function timestampFromToday(days) {
  return daysFromToday(days) + 'T12:00:00.000Z';
}

// who you are in the demo as a tenant: Sam already shows up on the sample work orders, checklists,
// documents, and message threads, so everything the landlord side has for Sam lines up with this
export const demo_tenant = {
  id: 'demo-tenant-sam',
  name: 'Sam Rivera',
  email: 'sam@example.com',
  property_name: '123 Maple St',
  unit_label: 'Unit 2',
  conversation_id: 'demo-convo-sam',
};

// the demo leases tell the same story as the backend's seed: one ending in 25 days (inside the 60 day
// notice window), one in 70 days, one month to month, a past tenant whose lease ran out, and one with none
function sampleLease(end_in_days, extra) {
  return {
    lease_start_on: daysFromToday(end_in_days - 364),
    lease_end_on: daysFromToday(end_in_days),
    lease_term: 'fixed',
    renewal_notice_days: 60,
    lease_notes: '',
    ...(extra || {}),
  };
}

// the 'set' event each sample lease would have from when the landlord first entered it
function setEvent(id, lease, days_ago) {
  return [
    {
      id: id,
      type: 'set',
      data: {
        before: { leaseTerm: null },
        after: {
          leaseStartOn: lease.lease_start_on,
          leaseEndOn: lease.lease_end_on,
          leaseTerm: lease.lease_term,
          renewalNoticeDays: lease.renewal_notice_days,
          leaseNotes: lease.lease_notes || null,
        },
      },
      createdAt: timestampFromToday(-days_ago),
    },
  ];
}

// a fresh copy every time the demo starts, so changes from the last demo never carry over
export function buildSampleTenantData() {
  const sam_lease = sampleLease(25, {
    lease_notes: 'Wants to renew. Thinking $1,495 for the next year',
  });
  const jordan_lease = sampleLease(70);
  const priya_lease = {
    lease_start_on: daysFromToday(-60),
    lease_end_on: null,
    lease_term: 'month_to_month',
    renewal_notice_days: 30,
    lease_notes: '',
  };
  // Morgan's lease ran out, then they moved out 15 days later
  const morgan_lease = sampleLease(-90);
  return {
    lease_events: {
      'demo-tenancy-sam': setEvent('demo-lease-event-sam', sam_lease, 340),
      'demo-tenancy-jordan': setEvent('demo-lease-event-jordan', jordan_lease, 290),
      'demo-tenancy-priya': setEvent('demo-lease-event-priya', priya_lease, 60),
      'demo-tenancy-morgan': setEvent('demo-lease-event-morgan', morgan_lease, 450),
    },
    properties: [
      { id: 'demo-prop-maple', name: '123 Maple St', address: '123 Maple St, Springfield' },
      { id: 'demo-prop-cedar', name: '48 Cedar Ave', address: '48 Cedar Ave, Springfield' },
    ],
    // the ids match the demo message threads so Message opens the right one
    tenants: [
      {
        id: 'demo-tenant-sam',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        conversation_id: 'demo-convo-sam',
      },
      {
        id: 'demo-tenant-jordan',
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        conversation_id: 'demo-convo-jordan',
      },
      {
        id: 'demo-tenant-alex',
        name: 'Alex Chen',
        email: 'alex@example.com',
        conversation_id: 'demo-convo-alex',
      },
      {
        id: 'demo-tenant-priya',
        name: 'Priya Shah',
        email: 'priya@example.com',
        conversation_id: null,
      },
      // the past tenant, moved out of Unit 3 before Priya moved in
      {
        id: 'demo-tenant-morgan',
        name: 'Morgan Diaz',
        email: 'morgan@example.com',
        conversation_id: null,
      },
    ],
    tenancies: [
      {
        id: 'demo-tenancy-sam',
        tenant_id: 'demo-tenant-sam',
        property_id: 'demo-prop-maple',
        unit_label: 'Unit 2',
        status: 'active',
        started_at: timestampFromToday(-380),
        ended_at: null,
        move_out_note: '',
        lease: sam_lease,
      },
      {
        id: 'demo-tenancy-jordan',
        tenant_id: 'demo-tenant-jordan',
        property_id: 'demo-prop-maple',
        unit_label: 'Unit 1',
        status: 'active',
        started_at: timestampFromToday(-320),
        ended_at: null,
        move_out_note: '',
        lease: jordan_lease,
      },
      {
        id: 'demo-tenancy-priya',
        tenant_id: 'demo-tenant-priya',
        property_id: 'demo-prop-maple',
        unit_label: 'Unit 3',
        status: 'active',
        started_at: timestampFromToday(-60),
        ended_at: null,
        move_out_note: '',
        lease: priya_lease,
      },
      {
        id: 'demo-tenancy-alex',
        tenant_id: 'demo-tenant-alex',
        property_id: 'demo-prop-cedar',
        unit_label: '',
        status: 'active',
        started_at: timestampFromToday(-150),
        ended_at: null,
        move_out_note: '',
        lease: null,
      },
      {
        id: 'demo-tenancy-morgan',
        tenant_id: 'demo-tenant-morgan',
        property_id: 'demo-prop-maple',
        unit_label: 'Unit 3',
        status: 'ended',
        started_at: timestampFromToday(-800),
        ended_at: daysFromToday(-75),
        move_out_note: 'Deposit returned in full',
        lease: morgan_lease,
      },
    ],
    // same shape as the server's invites
    invites: [
      {
        id: 'demo-invite-1',
        code: 'K7M2QX9P',
        propertyId: 'demo-prop-maple',
        unitLabel: 'Unit 4',
        tenantName: 'Casey Nguyen',
        status: 'pending',
        expiresAt: timestampFromToday(5),
        usedAt: null,
        revokedAt: null,
        createdAt: timestampFromToday(-2),
      },
    ],
  };
}

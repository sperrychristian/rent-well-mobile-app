// leases/{tenancyId} and leaseEvents/{tenancyId}/{eventId}: one lease per tenancy and its timeline
// the app keeps the lease on its tenancy in snake_case (deriveLease works out its status when it's read),
// the database keeps the stored fields only, in camelCase
// set, edit, and renew run the demo's lease rules on the tenant bundle and save through util/data/tenants.js

export function leaseFromDb(record) {
  if (!record || !record.leaseTerm) {
    return null;
  }
  return {
    lease_start_on: record.leaseStartOn || null,
    lease_end_on: record.leaseEndOn || null,
    lease_term: record.leaseTerm,
    renewal_notice_days:
      typeof record.renewalNoticeDays === 'number' ? record.renewalNoticeDays : 60,
    lease_notes: record.leaseNotes || '',
  };
}

export function leaseToDb(lease, tenancy_id, owner_id) {
  return {
    tenancyId: tenancy_id,
    ownerId: owner_id,
    leaseStartOn: lease.lease_start_on || undefined,
    leaseEndOn: lease.lease_end_on || undefined,
    leaseTerm: lease.lease_term,
    renewalNoticeDays:
      typeof lease.renewal_notice_days === 'number' ? lease.renewal_notice_days : 60,
    leaseNotes: lease.lease_notes || '',
  };
}

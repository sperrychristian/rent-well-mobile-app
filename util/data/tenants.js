// tenants, properties, tenancies, invites, leases, and lease events as one bundle for a landlord
// the bundle has the same shape as the demo's tenant data, so the app runs the demo's rule functions
// (features/tenants/utils/demoTenants.js, features/leases/utils/demoLeases.js) on it, then saves what changed
// step 1: read the nodes (one request each, all at once) and keep only this landlord's records
// step 2: turn them into the demo's shape
// step 3: after a change, compare old and new and write every changed record in one multi-path PATCH
import { getNode } from '../http';
import {
  recordsToList,
  keyedToList,
  listToKeyed,
  buildPatch,
  savePatch,
  cleanRecord,
} from './records';
import { leaseFromDb, leaseToDb } from './leases';

// ----- one record each way -----

function propertyFromDb(record) {
  return {
    id: record.id,
    name: record.name || '',
    address: record.address || '',
    payment_instructions: record.paymentInstructions || '',
    ...(record.deleted ? { deleted: true } : {}),
    created_at_iso: record.createdAt || null,
  };
}

function propertyToDb(property, owner_id) {
  return {
    id: property.id,
    ownerId: owner_id,
    name: property.name,
    address: property.address || '',
    paymentInstructions: property.payment_instructions || undefined,
    deleted: property.deleted ? true : undefined,
    createdAt: property.created_at_iso || undefined,
  };
}

function tenancyFromDb(record, lease) {
  return {
    id: record.id,
    tenant_id: record.tenantUserId,
    property_id: record.propertyId,
    unit_label: record.unitLabel || '',
    status: record.status === 'ended' ? 'ended' : 'active',
    started_at: record.startedAt || record.createdAt || '',
    ended_at: record.endedAt || null,
    move_out_note: record.moveOutNote || '',
    lease: lease || null,
    created_at_iso: record.createdAt || null,
  };
}

// the names ride along on the tenancy so a list can show them without reading users and properties
function tenancyToDb(tenancy, owner_id, data) {
  const tenant = data.tenants.find((item) => item.id === tenancy.tenant_id);
  const property = data.properties.find((item) => item.id === tenancy.property_id);
  return {
    id: tenancy.id,
    ownerId: owner_id,
    tenantUserId: tenancy.tenant_id,
    propertyId: tenancy.property_id,
    unitLabel: tenancy.unit_label || '',
    status: tenancy.status,
    startedAt: tenancy.started_at,
    endedAt: tenancy.ended_at || undefined,
    moveOutNote: tenancy.move_out_note || '',
    tenantName: tenant ? tenant.name : '',
    propertyName: property ? property.name : '',
    createdAt: tenancy.created_at_iso || undefined,
  };
}

// invites already use the server's camelCase in the demo data, so only the owner and the property name get added
function inviteToDb(invite, owner_id, data) {
  const property = data.properties.find((item) => item.id === invite.propertyId);
  const status = invite.usedAt ? 'used' : invite.revokedAt ? 'revoked' : 'pending';
  return {
    ...invite,
    ownerId: owner_id,
    status: status,
    propertyName: property ? property.name : invite.propertyName || '',
  };
}

function inviteFromDb(record) {
  return {
    id: record.id,
    code: record.code,
    propertyId: record.propertyId,
    unitLabel: record.unitLabel || null,
    tenantName: record.tenantName || '',
    status: record.status || 'pending',
    expiresAt: record.expiresAt,
    usedAt: record.usedAt || null,
    revokedAt: record.revokedAt || null,
    createdAt: record.createdAt || '',
  };
}

// a tenant here is a user record, only the fields the tenant screens read
function tenantFromUser(record, conversations) {
  const conversation = conversations.find((item) => item.tenantUserId === record.id);
  return {
    id: record.id,
    name: record.name || '',
    email: record.email || '',
    conversation_id: conversation ? conversation.id : null,
  };
}

// ----- loading -----

// everything the tenant screens need for one landlord, in the demo's shape
// a tenant's session loads their landlord's bundle and the screens pick out their own rentals
export async function getTenantData(owner_id) {
  const [properties, users, tenancies, invites, leases, lease_events, conversations] =
    await Promise.all([
      getNode('properties'),
      getNode('users'),
      getNode('tenancies'),
      getNode('invites'),
      getNode('leases'),
      getNode('leaseEvents'),
      getNode('conversations'),
    ]);
  const mine = (node_value) =>
    recordsToList(node_value).filter((record) => record.ownerId === owner_id);
  const my_tenancies = mine(tenancies);
  const my_conversations = mine(conversations);
  const tenant_ids = new Set(my_tenancies.map((tenancy) => tenancy.tenantUserId));
  // a tenant who signed up under this landlord counts too, even before they have a tenancy
  const my_tenants = recordsToList(users).filter(
    (record) =>
      record.role === 'tenant' && (record.ownerId === owner_id || tenant_ids.has(record.id)),
  );
  const events_by_tenancy = {};
  my_tenancies.forEach((tenancy) => {
    const events = lease_events[tenancy.id];
    if (events) {
      events_by_tenancy[tenancy.id] = keyedToList(events).sort((a, b) =>
        (a.createdAt || '').localeCompare(b.createdAt || ''),
      );
    }
  });
  return {
    properties: mine(properties).map(propertyFromDb),
    tenants: my_tenants
      .map((record) => tenantFromUser(record, my_conversations))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tenancies: my_tenancies.map((record) =>
      tenancyFromDb(record, leases[record.id] ? leaseFromDb(leases[record.id]) : null),
    ),
    invites: mine(invites).map(inviteFromDb),
    lease_events: events_by_tenancy,
  };
}

// ----- saving -----

function keyed(list, toDb) {
  const records = {};
  (list || []).forEach((item) => {
    records[item.id] = cleanRecord(toDb(item));
  });
  return records;
}

function leaseRecords(data, owner_id) {
  const records = {};
  (data.tenancies || []).forEach((tenancy) => {
    if (tenancy.lease) {
      records[tenancy.id] = leaseToDb(tenancy.lease, tenancy.id, owner_id);
    }
  });
  return records;
}

// lease events are saved per tenancy as keyed objects, keyed by the event's own id
function eventRecords(data) {
  const records = {};
  Object.keys(data.lease_events || {}).forEach((tenancy_id) => {
    const events = {};
    (data.lease_events[tenancy_id] || []).forEach((event) => {
      events[event.id] = event;
    });
    records[tenancy_id] = events;
  });
  return records;
}

// the multi-path PATCH between two versions of the bundle, pure so the tests can check it
// every changed record goes in the same request, so a move (end one tenancy, start another) lands all at once
export function buildTenantDataPatch(before, after, owner_id) {
  const patch = {
    ...buildPatch(
      'properties',
      keyed(before.properties, (item) => propertyToDb(item, owner_id)),
      keyed(after.properties, (item) => propertyToDb(item, owner_id)),
      true,
    ),
    ...buildPatch(
      'tenancies',
      keyed(before.tenancies, (item) => tenancyToDb(item, owner_id, before)),
      keyed(after.tenancies, (item) => tenancyToDb(item, owner_id, after)),
      true,
    ),
    ...buildPatch(
      'invites',
      keyed(before.invites, (item) => inviteToDb(item, owner_id, before)),
      keyed(after.invites, (item) => inviteToDb(item, owner_id, after)),
    ),
    ...buildPatch('leases', leaseRecords(before, owner_id), leaseRecords(after, owner_id)),
  };
  // lease events only ever get added, so each new one is its own path under its tenancy
  const before_events = eventRecords(before);
  const after_events = eventRecords(after);
  Object.keys(after_events).forEach((tenancy_id) => {
    Object.assign(
      patch,
      buildPatch('leaseEvents/' + tenancy_id, before_events[tenancy_id], after_events[tenancy_id]),
    );
  });
  return patch;
}

export function saveTenantDataChanges(before, after, owner_id) {
  return savePatch(buildTenantDataPatch(before, after, owner_id));
}

// keyed lists for the seed script, which writes the same shapes the app reads
export const tenant_data_mappers = {
  propertyToDb,
  tenancyToDb,
  inviteToDb,
  listToKeyed,
};

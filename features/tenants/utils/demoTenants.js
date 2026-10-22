import { parseApiError } from '../../../services/apiHelpers';
import {
  localDateString,
  placeLabel,
  sameUnit,
  checkEndDate,
  checkUnitLabel,
} from './tenantHelpers';
import { deriveLease } from '../../leases/utils/leaseHelpers';

// the demo's version of every tenant and property action, run on the local data with the server's rules
// each one gives back new data (never changes the old) or throws the same error the server would
// data is { properties, tenants, tenancies, invites }, properties have deleted: true once deleted

const code_letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeInviteCode() {
  let code = '';
  for (let index = 0; index < 8; index++) {
    code += code_letters[Math.floor(Math.random() * code_letters.length)];
  }
  return code;
}

// the same friendly message the app shows for the real error
function demoError(status, code) {
  return parseApiError(status, { error: { code: code, message: code } });
}

function validationError(message) {
  return parseApiError(400, {
    error: {
      code: 'VALIDATION_ERROR',
      message: message,
      details: [{ path: '', message: message }],
    },
  });
}

// the order a server invite's status is checked in: used, revoked, expired, pending
export function inviteStatus(invite, now) {
  if (invite.usedAt) {
    return 'used';
  }
  if (invite.revokedAt) {
    return 'revoked';
  }
  if (Date.parse(invite.expiresAt) <= now.getTime()) {
    return 'expired';
  }
  return 'pending';
}

function liveProperty(data, property_id) {
  const property = data.properties.find((item) => item.id === property_id && !item.deleted);
  if (!property) {
    throw demoError(404, 'NOT_FOUND');
  }
  return property;
}

// today is a YYYY-MM-DD, so the lease status is worked out the same way the server does it
function tenancyView(data, tenancy, today) {
  const property = data.properties.find((item) => item.id === tenancy.property_id);
  return {
    id: tenancy.id,
    tenant_id: tenancy.tenant_id,
    property_id: tenancy.property_id,
    property_name: property ? property.name : '',
    property_address: property ? property.address : '',
    unit_label: tenancy.unit_label || '',
    status: tenancy.status,
    started_at: localDateString(tenancy.started_at),
    ended_at: tenancy.ended_at,
    move_out_note: tenancy.move_out_note || '',
    lease: deriveLease(tenancy.lease, today),
  };
}

// turns the demo data into the same tenant and property shapes the api ones get mapped to
// orders are the local work orders, matched by tenant name for the open count
export function buildDemoView(data, orders, now) {
  const today = localDateString(now.toISOString());
  const tenants = data.tenants.map((tenant) => {
    const mine = data.tenancies.filter((tenancy) => tenancy.tenant_id === tenant.id);
    const active = mine
      .filter((tenancy) => tenancy.status === 'active')
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .map((tenancy) => tenancyView(data, tenancy, today));
    const ended = mine
      .filter((tenancy) => tenancy.status === 'ended')
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
      .map((tenancy) => tenancyView(data, tenancy, today));
    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      is_active: active.length > 0,
      active_tenancies: active,
      ended_tenancies: ended,
      open_work_order_count: orders.filter(
        (order) => order.tenant === tenant.name && order.status !== 'Resolved',
      ).length,
      conversation_id: tenant.conversation_id,
    };
  });

  const properties = data.properties
    .filter((property) => !property.deleted)
    .map((property) => ({
      id: property.id,
      name: property.name,
      address: property.address,
      tenancies: data.tenancies
        .filter((tenancy) => tenancy.property_id === property.id && tenancy.status === 'active')
        .map((tenancy) => {
          const tenant = data.tenants.find((item) => item.id === tenancy.tenant_id);
          return {
            id: tenancy.id,
            unit_label: tenancy.unit_label || '',
            started_at: localDateString(tenancy.started_at),
            tenant_id: tenancy.tenant_id,
            tenant_name: tenant ? tenant.name : '',
            tenant_email: tenant ? tenant.email : '',
          };
        }),
    }));

  // the status gets worked out again so an invite expires on its own while the demo runs
  const invites = data.invites
    .map((invite) => ({ ...invite, status: inviteStatus(invite, now) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { tenants: tenants, properties: properties, invites: invites };
}

// ----- properties -----

export function demoAddProperty(data, fields, makeId) {
  const property = { id: makeId(), name: fields.name, address: fields.address };
  return { data: { ...data, properties: [...data.properties, property] }, property: property };
}

export function demoUpdateProperty(data, property_id, fields) {
  liveProperty(data, property_id);
  return {
    ...data,
    properties: data.properties.map((property) =>
      property.id === property_id ? { ...property, ...fields } : property,
    ),
  };
}

// blocked while someone lives there or a work order there is still open, the tenancy check comes first
// the local orders only have a property label, so I match anything that starts with the property name
export function demoDeleteProperty(data, property_id, orders, now) {
  const property = liveProperty(data, property_id);
  if (
    data.tenancies.some(
      (tenancy) => tenancy.property_id === property_id && tenancy.status === 'active',
    )
  ) {
    throw demoError(409, 'PROPERTY_HAS_ACTIVE_TENANCY');
  }
  const open_orders = orders.filter(
    (order) =>
      order.status !== 'Resolved' &&
      (order.property === property.name || order.property.startsWith(property.name + ',')),
  );
  if (open_orders.length > 0) {
    throw demoError(409, 'PROPERTY_HAS_OPEN_WORK_ORDERS');
  }
  // pending invites to it get revoked, same as the server
  const revoked_at = now.toISOString();
  return {
    ...data,
    properties: data.properties.map((item) =>
      item.id === property_id ? { ...item, deleted: true } : item,
    ),
    invites: data.invites.map((invite) =>
      invite.propertyId === property_id && inviteStatus(invite, now) === 'pending'
        ? { ...invite, revokedAt: revoked_at }
        : invite,
    ),
  };
}

// ----- invites -----

export function demoCreateInvite(data, fields, now, makeId, makeCode) {
  liveProperty(data, fields.property_id);
  const invite = {
    id: makeId(),
    code: makeCode(),
    propertyId: fields.property_id,
    unitLabel: fields.unit_label || null,
    tenantName: fields.tenant_name,
    status: 'pending',
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    usedAt: null,
    revokedAt: null,
    createdAt: now.toISOString(),
  };
  return { data: { ...data, invites: [invite, ...data.invites] }, invite: invite };
}

function findInvite(data, invite_id) {
  const invite = data.invites.find((item) => item.id === invite_id);
  if (!invite) {
    throw demoError(404, 'NOT_FOUND');
  }
  if (invite.usedAt) {
    throw demoError(409, 'INVITE_USED');
  }
  return invite;
}

// revoking twice keeps the first revoke time, like the server
export function demoRevokeInvite(data, invite_id, now) {
  const invite = findInvite(data, invite_id);
  const revoked = { ...invite, revokedAt: invite.revokedAt || now.toISOString() };
  return {
    data: {
      ...data,
      invites: data.invites.map((item) => (item.id === invite_id ? revoked : item)),
    },
    invite: { ...revoked, status: 'revoked' },
  };
}

// a new invite with a new code for the same place and name, and the old one gets revoked
export function demoResendInvite(data, invite_id, now, makeId, makeCode) {
  const invite = findInvite(data, invite_id);
  liveProperty(data, invite.propertyId);
  const revoked = { ...invite, revokedAt: invite.revokedAt || now.toISOString() };
  const created = demoCreateInvite(
    { ...data, invites: data.invites.map((item) => (item.id === invite_id ? revoked : item)) },
    {
      property_id: invite.propertyId,
      unit_label: invite.unitLabel,
      tenant_name: invite.tenantName,
    },
    now,
    makeId,
    makeCode,
  );
  return {
    data: created.data,
    invite: created.invite,
    revoked_invite: { ...revoked, status: 'revoked' },
  };
}

// ----- tenancies -----

function findActiveTenancy(data, tenancy_id) {
  const tenancy = data.tenancies.find((item) => item.id === tenancy_id);
  if (!tenancy) {
    throw demoError(404, 'NOT_FOUND');
  }
  if (tenancy.status !== 'active') {
    throw demoError(409, 'TENANCY_ENDED');
  }
  return tenancy;
}

// the same tenant can't be active twice in one unit, but roommates are fine
function checkDuplicate(data, tenant_id, property_id, unit_label, skip_id) {
  const taken = data.tenancies.some(
    (tenancy) =>
      tenancy.id !== skip_id &&
      tenancy.tenant_id === tenant_id &&
      tenancy.status === 'active' &&
      tenancy.property_id === property_id &&
      sameUnit(tenancy.unit_label, unit_label),
  );
  if (taken) {
    throw demoError(409, 'TENANCY_EXISTS');
  }
}

function checkUnit(unit_label) {
  const message = checkUnitLabel(unit_label || '');
  if (message) {
    throw validationError(message);
  }
}

function checkDate(ended_at, tenancy, today) {
  if (checkEndDate(ended_at, localDateString(tenancy.started_at), today)) {
    throw demoError(400, 'INVALID_END_DATE');
  }
}

// fields: tenant_id, property_id, unit_label
export function demoAssign(data, fields, now, makeId) {
  if (!data.tenants.some((tenant) => tenant.id === fields.tenant_id)) {
    throw demoError(404, 'NOT_FOUND');
  }
  liveProperty(data, fields.property_id);
  checkUnit(fields.unit_label);
  checkDuplicate(data, fields.tenant_id, fields.property_id, fields.unit_label, null);
  const tenancy = {
    id: makeId(),
    tenant_id: fields.tenant_id,
    property_id: fields.property_id,
    unit_label: (fields.unit_label || '').trim(),
    status: 'active',
    started_at: now.toISOString(),
    ended_at: null,
    move_out_note: '',
  };
  return { data: { ...data, tenancies: [...data.tenancies, tenancy] }, tenancy: tenancy };
}

// all or nothing: every check runs before anything changes
// fields: property_id, unit_label, ended_at (defaults to today), move_out_note
export function demoMove(data, tenancy_id, fields, today, now, makeId) {
  const old = findActiveTenancy(data, tenancy_id);
  liveProperty(data, fields.property_id);
  checkUnit(fields.unit_label);
  const ended_at = fields.ended_at || today;
  checkDate(ended_at, old, today);
  checkDuplicate(data, old.tenant_id, fields.property_id, fields.unit_label, old.id);
  const ended = {
    ...old,
    status: 'ended',
    ended_at: ended_at,
    move_out_note: fields.move_out_note || '',
  };
  const tenancy = {
    id: makeId(),
    tenant_id: old.tenant_id,
    property_id: fields.property_id,
    unit_label: (fields.unit_label || '').trim(),
    status: 'active',
    started_at: now.toISOString(),
    ended_at: null,
    move_out_note: '',
  };
  return {
    data: {
      ...data,
      tenancies: [...data.tenancies.map((item) => (item.id === old.id ? ended : item)), tenancy],
    },
    tenancy: tenancy,
    ended_tenancy: ended,
  };
}

// fields: ended_at (defaults to today), move_out_note
export function demoEnd(data, tenancy_id, fields, today) {
  const old = findActiveTenancy(data, tenancy_id);
  const ended_at = fields.ended_at || today;
  checkDate(ended_at, old, today);
  const ended = {
    ...old,
    status: 'ended',
    ended_at: ended_at,
    move_out_note: fields.move_out_note || '',
  };
  return {
    data: { ...data, tenancies: data.tenancies.map((item) => (item.id === old.id ? ended : item)) },
    tenancy: ended,
  };
}

// the label the checklists and work orders use for a tenancy's place
export function tenancyPlace(tenancy) {
  return placeLabel(tenancy.property_name, tenancy.unit_label);
}

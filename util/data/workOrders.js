// workOrders/{workOrderId}: repair requests, read by both roles (a landlord sees theirs, a tenant only their own)
// these hand back the same camelCase shape the screens' fromApiWorkOrder already reads,
// so the work order provider works the same as it did with the old server
import { getNode, patchNode } from '../http';
import { parseApiError } from '../apiHelpers';
import { recordsToList, nowIso, cleanRecord } from './records';
import { generatePushId } from './pushId';
import { sessionUser } from './session';

function codeError(status, code) {
  return parseApiError(status, { error: { code: code, message: code } });
}

// the database record in the shape fromApiWorkOrder reads (property and tenant as small objects)
export function toApiShape(record) {
  return {
    id: record.id,
    ownerId: record.ownerId,
    title: record.title || '',
    description: record.description || '',
    property: {
      id: record.propertyId || null,
      name: record.propertyName || '',
      address: record.propertyAddress || '',
    },
    unitLabel: record.unitLabel || '',
    tenantName: record.tenantName || '',
    tenant: record.tenantUserId ? { id: record.tenantUserId } : null,
    tenancyId: record.tenancyId || null,
    status: record.status || 'Open',
    priority: record.priority || 'Normal',
    createdAt: record.createdAt,
    startedAt: record.startedAt || null,
    resolvedAt: record.resolvedAt || null,
    ownerNotes: record.ownerNotes || '',
    contractor: record.contractor || '',
    estimate: typeof record.estimate === 'number' ? record.estimate : null,
    preferredDate: record.preferredDate || '',
    photos: [],
    createdBy: record.createdBy || null,
  };
}

// a landlord sees every order on their properties, a tenant only the ones on their own tenancies
function visibleTo(user) {
  if (user.role === 'tenant') {
    return (record) => record.tenantUserId === user.id;
  }
  return (record) => record.ownerId === user.id;
}

function newestFirst(a, b) {
  return (b.createdAt || '').localeCompare(a.createdAt || '');
}

export async function getAllWorkOrders() {
  const user = sessionUser();
  if (!user) {
    return [];
  }
  return recordsToList(await getNode('workOrders'))
    .filter(visibleTo(user))
    .sort(newestFirst)
    .map(toApiShape);
}

export async function getWorkOrder(work_order_id) {
  const record = await getNode('workOrders/' + work_order_id, null);
  if (!record) {
    throw codeError(404, 'NOT_FOUND');
  }
  return toApiShape({ ...record, id: record.id || work_order_id });
}

function estimateOrMissing(value) {
  return value === null || value === undefined || value === '' ? undefined : Number(value);
}

// the owner version, the property comes from the form and the tenant link and unit are optional
// fields: property_id, title, description, priority, unit_label, tenant_user_id, contractor, estimate, preferred_date
export async function createOwnerWorkOrder(fields) {
  const user = sessionUser();
  const [property, tenant] = await Promise.all([
    getNode('properties/' + fields.property_id, null),
    fields.tenant_user_id ? getNode('users/' + fields.tenant_user_id, null) : null,
  ]);
  if (!property || property.deleted) {
    throw codeError(404, 'NOT_FOUND');
  }
  const now = nowIso();
  const record = cleanRecord({
    id: generatePushId(),
    ownerId: user.id,
    propertyId: fields.property_id,
    propertyName: property.name || '',
    propertyAddress: property.address || '',
    unitLabel: fields.unit_label || '',
    tenantUserId: tenant ? fields.tenant_user_id : undefined,
    tenantName: tenant ? tenant.name : '',
    title: fields.title,
    description: fields.description || '',
    status: 'Open',
    priority: fields.priority || 'Normal',
    ownerNotes: '',
    contractor: fields.contractor || '',
    estimate: estimateOrMissing(fields.estimate),
    preferredDate: fields.preferred_date || '',
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });
  await patchNode('', { ['workOrders/' + record.id]: record });
  return toApiShape(record);
}

// the tenant version, property, unit, and name come from the tenancy so the tenant never types them
// fields: title, description, priority, tenancy_id (only needed with more than one rental), preferred_date
export async function createTenantWorkOrder(fields) {
  const user = sessionUser();
  const active = recordsToList(await getNode('tenancies')).filter(
    (tenancy) => tenancy.tenantUserId === user.id && tenancy.status === 'active',
  );
  if (active.length === 0) {
    throw codeError(403, 'NO_ACTIVE_TENANCY');
  }
  let tenancy = active[0];
  if (fields.tenancy_id) {
    tenancy = active.find((item) => item.id === fields.tenancy_id);
    if (!tenancy) {
      throw codeError(403, 'NO_ACTIVE_TENANCY');
    }
  } else if (active.length > 1) {
    throw codeError(400, 'TENANCY_REQUIRED');
  }
  const property = (await getNode('properties/' + tenancy.propertyId, null)) || {};
  const now = nowIso();
  const record = cleanRecord({
    id: generatePushId(),
    ownerId: tenancy.ownerId,
    propertyId: tenancy.propertyId,
    propertyName: property.name || tenancy.propertyName || '',
    propertyAddress: property.address || '',
    unitLabel: tenancy.unitLabel || '',
    tenantUserId: user.id,
    tenancyId: tenancy.id,
    tenantName: user.name,
    title: fields.title,
    description: fields.description || '',
    status: 'Open',
    priority: fields.priority || 'Normal',
    ownerNotes: '',
    contractor: '',
    preferredDate: fields.preferred_date || '',
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });
  await patchNode('', { ['workOrders/' + record.id]: record });
  return toApiShape(record);
}

// writes only the given fields (null takes a field away), then reads the order back
async function patchWorkOrder(work_order_id, changes) {
  await patchNode('workOrders/' + work_order_id, { ...changes, updatedAt: nowIso() });
  return getWorkOrder(work_order_id);
}

// the same moves applyStatus makes on screen, with full timestamps: going back clears the dates that no longer apply
export function statusChanges(record, new_status, now) {
  if (new_status === 'Open') {
    return { status: 'Open', startedAt: null, resolvedAt: null };
  }
  if (new_status === 'In Progress') {
    return {
      status: 'In Progress',
      startedAt: record.status === 'Open' || !record.startedAt ? now : record.startedAt,
      resolvedAt: null,
    };
  }
  return { status: 'Resolved', startedAt: record.startedAt || now, resolvedAt: now };
}

export async function updateWorkOrderStatus(work_order_id, status) {
  const record = await getNode('workOrders/' + work_order_id, null);
  if (!record) {
    throw codeError(404, 'NOT_FOUND');
  }
  if (record.status === status) {
    return toApiShape({ ...record, id: work_order_id });
  }
  return patchWorkOrder(work_order_id, statusChanges(record, status, nowIso()));
}

export function updateWorkOrderPriority(work_order_id, priority) {
  return patchWorkOrder(work_order_id, { priority: priority });
}

export function updateWorkOrderNotes(work_order_id, notes) {
  return patchWorkOrder(work_order_id, { ownerNotes: notes });
}

// estimate is a number or null (null takes it off)
export function updateWorkOrderContractor(work_order_id, contractor, estimate) {
  return patchWorkOrder(work_order_id, {
    contractor: contractor || '',
    estimate: estimateOrMissing(estimate) === undefined ? null : Number(estimate),
  });
}

// the work order form's Update: with no server rules in the way, every field the form shows can change
// changes is in the app's shape: title, description, priority, contractor, estimate, preferred_date
export function updateWorkOrderFields(work_order_id, changes) {
  const body = {};
  if (changes.title !== undefined) {
    body.title = changes.title;
  }
  if (changes.description !== undefined) {
    body.description = changes.description;
  }
  if (changes.priority !== undefined) {
    body.priority = changes.priority;
  }
  if (changes.contractor !== undefined) {
    body.contractor = changes.contractor || '';
  }
  if (changes.estimate !== undefined) {
    body.estimate = estimateOrMissing(changes.estimate) === undefined ? null : changes.estimate;
  }
  if (changes.preferred_date !== undefined) {
    body.preferredDate = changes.preferred_date || '';
  }
  return patchWorkOrder(work_order_id, body);
}

// deletes the order and unlinks any expense that pointed at it, in one multi-path write,
// so an expense never points at an order that's gone (the expense itself stays, it's still a real cost)
export async function deleteWorkOrder(work_order_id) {
  const expenses = recordsToList(await getNode('expenses'));
  const patch = { ['workOrders/' + work_order_id]: null };
  expenses
    .filter((expense) => expense.workOrderId === work_order_id)
    .forEach((expense) => {
      patch['expenses/' + expense.id + '/workOrderId'] = null;
    });
  await patchNode('', patch);
}

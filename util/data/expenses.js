// expenses/{expenseId}: a landlord's costs, in the same camelCase shape the screens' fromApiExpense reads
// receipts are photos, so they wait for Firebase Storage (receiptKey is never written here)
import { getNode, patchNode } from '../http';
import { parseApiError } from '../apiHelpers';
import { recordsToList, nowIso, cleanRecord } from './records';
import { generatePushId } from './pushId';
import { sessionUser } from './session';
import { isDate } from '../../features/payments/utils/ledgerMath';

function validationError(message) {
  return parseApiError(400, {
    error: { code: 'VALIDATION_ERROR', message: message, details: [{ path: '', message }] },
  });
}

// the same checks the old server made, so a bad expense never gets saved
export function checkExpenseBody(body) {
  if (!Number.isSafeInteger(body.amountCents) || body.amountCents <= 0) {
    return 'The amount has to be more than $0.00.';
  }
  if (!isDate(body.spentOn) || body.spentOn < '2000-01-01') {
    return "The date can't be in the future or before 2000.";
  }
  if (!body.description || body.description.length > 500) {
    return 'Add a short description (up to 500 characters).';
  }
  return null;
}

// the database record in the fromApiExpense shape (the property as a small object)
export function expenseToApiShape(record) {
  return {
    ...record,
    property: record.propertyId ? { id: record.propertyId, name: record.propertyName || '' } : null,
    receiptKey: null,
  };
}

// the body from toApiExpense plus the owner and the property's name, so lists don't need a second read
function recordFrom(body, id, properties, existing) {
  const property = body.propertyId ? properties[body.propertyId] : null;
  const now = nowIso();
  return cleanRecord({
    ...(existing || {}),
    id: id,
    ownerId: (existing && existing.ownerId) || sessionUser().id,
    propertyId: body.propertyId || undefined,
    propertyName: property ? property.name : undefined,
    category: body.category,
    vendor: body.vendor || undefined,
    description: body.description,
    notes: body.notes || undefined,
    amountCents: body.amountCents,
    spentOn: body.spentOn,
    paymentMethod: body.paymentMethod || undefined,
    taxDeductible: body.taxDeductible !== false,
    workOrderId: body.workOrderId || undefined,
    clientId: body.clientId || (existing && existing.clientId) || undefined,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
    receiptKey: undefined,
  });
}

// every expense for the signed-in landlord, newest first, in one page (a small landlord has a few hundred at most)
export async function getExpenses() {
  const user = sessionUser();
  const list = recordsToList(await getNode('expenses'))
    .filter((record) => user && record.ownerId === user.id)
    .sort(
      (a, b) =>
        (b.spentOn || '').localeCompare(a.spentOn || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || ''),
    )
    .map(expenseToApiShape);
  return { expenses: list, nextCursor: null };
}

export async function createExpense(body) {
  const problem = checkExpenseBody(body);
  if (problem) {
    throw validationError(problem);
  }
  const properties = await getNode('properties');
  const record = recordFrom(body, generatePushId(), properties, null);
  await patchNode('', { ['expenses/' + record.id]: record });
  return expenseToApiShape(record);
}

// a PATCH body from toApiExpense always has every field, so the record is rebuilt from it
export async function updateExpense(expense_id, body) {
  const problem = checkExpenseBody(body);
  if (problem) {
    throw validationError(problem);
  }
  const [existing, properties] = await Promise.all([
    getNode('expenses/' + expense_id, null),
    getNode('properties'),
  ]);
  if (!existing) {
    throw parseApiError(404, { error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } });
  }
  const record = recordFrom(body, expense_id, properties, existing);
  // the whole record is written at its path, so a field the landlord cleared (like the vendor) really goes away
  await patchNode('', { ['expenses/' + expense_id]: record });
  return expenseToApiShape(record);
}

export async function deleteExpense(expense_id) {
  await patchNode('', { ['expenses/' + expense_id]: null });
}

// the phone's old expenses in one multi-path write, with a result per row like the old import route:
// created, existing (that clientId is already saved, so a retry never doubles up), or failed with the reason
export async function importExpenses(items) {
  const user = sessionUser();
  const [all, properties] = await Promise.all([getNode('expenses'), getNode('properties')]);
  const saved_client_ids = new Set(
    recordsToList(all)
      .filter((record) => record.ownerId === user.id && record.clientId)
      .map((record) => record.clientId),
  );
  const seen = new Set();
  const patch = {};
  const results = items.map((item, index) => {
    if (item.clientId && saved_client_ids.has(item.clientId)) {
      return { index, status: 'existing' };
    }
    if (item.clientId && seen.has(item.clientId)) {
      return {
        index,
        status: 'failed',
        error: { code: 'DUPLICATE_CLIENT_ID', message: 'That expense was listed twice.' },
      };
    }
    const problem = checkExpenseBody(item);
    if (problem) {
      return { index, status: 'failed', error: { code: 'VALIDATION_ERROR', message: problem } };
    }
    seen.add(item.clientId);
    const record = recordFrom(item, generatePushId(), properties, null);
    patch['expenses/' + record.id] = record;
    return { index, status: 'created', id: record.id };
  });
  if (Object.keys(patch).length > 0) {
    await patchNode('', patch);
  }
  return { results: results };
}

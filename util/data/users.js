// users/{userId}: the test accounts that stand in for sign in until Firebase Auth comes next milestone
// signing in only picks a record here, the app keeps that user id on the phone (AsyncStorage)
// signing up makes a new record, and a tenant's sign up also uses their invite: it makes the tenancy and the
// conversation with their landlord and marks the invite used, all in one multi-path PATCH
import { getNode, patchNode } from '../http';
import { ApiError, parseApiError } from '../apiHelpers';
import { recordsToList, nowIso } from './records';
import { generatePushId } from './pushId';
import { findInviteByCode, inviteState } from './invites';

function codeError(status, code) {
  return parseApiError(status, { error: { code: code, message: code } });
}

// the shape the rest of the app reads for the signed-in user
export function fromDbUser(record) {
  return {
    id: record.id,
    role: record.role === 'tenant' ? 'tenant' : 'owner',
    name: record.name || '',
    email: record.email || '',
    ownerId: record.ownerId || null,
  };
}

// every test account, landlords first, then by name, for the picker on Log In
export async function getTestAccounts() {
  return recordsToList(await getNode('users'))
    .filter((record) => record.role === 'owner' || record.role === 'tenant')
    .map(fromDbUser)
    .sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'owner' ? -1 : 1,
    );
}

// null when the record is gone (someone reset the database), so the app goes back to Log In
export async function getUser(user_id) {
  const record = await getNode('users/' + user_id, null);
  return record ? fromDbUser({ ...record, id: record.id || user_id }) : null;
}

async function checkEmailFree(email) {
  const taken = recordsToList(await getNode('users')).some(
    (record) => (record.email || '').toLowerCase() === email,
  );
  if (taken) {
    throw codeError(409, 'EMAIL_TAKEN');
  }
}

// fields: name, email
export async function registerOwnerAccount(fields) {
  const email = fields.email.trim().toLowerCase();
  await checkEmailFree(email);
  const now = nowIso();
  const user = {
    id: generatePushId(),
    role: 'owner',
    name: fields.name.trim(),
    email: email,
    createdAt: now,
    updatedAt: now,
  };
  await patchNode('', { ['users/' + user.id]: user });
  return fromDbUser(user);
}

// fields: invite_code (already cleaned), email, name (optional, the name on the invite is used when it's blank)
export async function registerTenantAccount(fields) {
  const invite = await findInviteByCode(fields.invite_code);
  if (!invite || inviteState(invite, new Date()) !== 'pending') {
    throw codeError(400, 'INVITE_INVALID');
  }
  const email = fields.email.trim().toLowerCase();
  await checkEmailFree(email);
  const properties = await getNode('properties');
  const property = properties[invite.propertyId];
  if (!property || property.deleted) {
    throw codeError(400, 'INVITE_INVALID');
  }
  const owners = await getNode('users');
  const owner = owners[invite.ownerId];
  const now = nowIso();
  const name = (fields.name || '').trim() || invite.tenantName || 'Tenant';
  const user_id = generatePushId();
  const tenancy_id = generatePushId();
  const conversation_id = generatePushId();
  const user = {
    id: user_id,
    role: 'tenant',
    name: name,
    email: email,
    ownerId: invite.ownerId,
    createdAt: now,
    updatedAt: now,
  };
  const patch = {
    ['users/' + user_id]: user,
    ['tenancies/' + tenancy_id]: {
      id: tenancy_id,
      ownerId: invite.ownerId,
      tenantUserId: user_id,
      propertyId: invite.propertyId,
      unitLabel: invite.unitLabel || '',
      status: 'active',
      startedAt: now,
      moveOutNote: '',
      tenantName: name,
      propertyName: property.name || '',
      createdAt: now,
      updatedAt: now,
    },
    ['conversations/' + conversation_id]: {
      id: conversation_id,
      ownerId: invite.ownerId,
      tenantUserId: user_id,
      ownerName: owner ? owner.name : '',
      tenantName: name,
      unreadCount: { [invite.ownerId]: 0, [user_id]: 0 },
      createdAt: now,
      updatedAt: now,
    },
    ['invites/' + invite.id + '/usedAt']: now,
    ['invites/' + invite.id + '/status']: 'used',
  };
  await patchNode('', patch);
  return fromDbUser(user);
}

// for a screen that wants a plain error when no account is picked
export function noAccountError() {
  return new ApiError(401, 'UNAUTHORIZED', 'Pick a test account first.');
}

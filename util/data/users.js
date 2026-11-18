// users/{userId}: one record per landlord or tenant
// signing up makes a new record, and a tenant's sign up also uses their invite: it makes the tenancy and the
// conversation with their landlord and marks the invite used, all in one multi-path PATCH
// assignment 12: Firebase Auth does the signing in now. authLinks/{localId} says which user record a Firebase
// account is, and every user record made from here on is keyed by its own localId (so a new landlord's ownerId
// is their localId) and carries authUid. the seeded records keep their old ids and get linked by the seed script
import { getNode, patchNode } from '../http';
import { parseApiError } from '../apiHelpers';
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

// null when the record is gone (someone reset the database), so the app goes back to Log In
export async function getUser(user_id) {
  const record = await getNode('users/' + user_id, null);
  return record ? fromDbUser({ ...record, id: record.id || user_id }) : null;
}

// the user record a Firebase account belongs to, null when the account has no Rent Well profile yet
export async function getUserByAuth(local_id) {
  const user_id = await getNode('authLinks/' + local_id, null);
  if (!user_id || typeof user_id !== 'string') {
    return null;
  }
  return getUser(user_id);
}

// another record (not this account's own) with the same email means someone already has that email
async function checkEmailFree(email, local_id) {
  const taken = recordsToList(await getNode('users')).some(
    (record) => (record.email || '').toLowerCase() === email && record.id !== local_id,
  );
  if (taken) {
    throw codeError(409, 'EMAIL_TAKEN');
  }
}

// fields: name, email
// local_id is the new Firebase account's id, the record and its authLinks entry land in one PATCH
export async function createOwnerProfile(local_id, fields) {
  const email = fields.email.trim().toLowerCase();
  await checkEmailFree(email, local_id);
  const now = nowIso();
  const user = {
    id: local_id,
    role: 'owner',
    name: fields.name.trim(),
    email: email,
    authUid: local_id,
    createdAt: now,
    updatedAt: now,
  };
  await patchNode('', { ['users/' + user.id]: user, ['authLinks/' + local_id]: user.id });
  return fromDbUser(user);
}

// fields: invite_code (already cleaned), email, name (optional, the name on the invite is used when it's blank)
// local_id is the new Firebase account's id, it's the tenant's user id and goes in authLinks in the same write
export async function createTenantProfile(local_id, fields) {
  const invite = await findInviteByCode(fields.invite_code);
  if (!invite || inviteState(invite, new Date()) !== 'pending') {
    throw codeError(400, 'INVITE_INVALID');
  }
  const email = fields.email.trim().toLowerCase();
  await checkEmailFree(email, local_id);
  const properties = await getNode('properties');
  const property = properties[invite.propertyId];
  if (!property || property.deleted) {
    throw codeError(400, 'INVITE_INVALID');
  }
  const owners = await getNode('users');
  const owner = owners[invite.ownerId];
  const now = nowIso();
  const name = (fields.name || '').trim() || invite.tenantName || 'Tenant';
  const user_id = local_id;
  const tenancy_id = generatePushId();
  const conversation_id = generatePushId();
  const user = {
    id: user_id,
    role: 'tenant',
    name: name,
    email: email,
    ownerId: invite.ownerId,
    authUid: local_id,
    createdAt: now,
    updatedAt: now,
  };
  const patch = {
    ['users/' + user_id]: user,
    ['authLinks/' + local_id]: user_id,
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

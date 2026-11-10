// invites/{inviteId}: creating, resending, and revoking go through the tenant bundle (util/data/tenants.js)
// this file finds an invite by its code for the tenant sign up
import { getNode } from '../http';
import { recordsToList } from './records';

// codes are saved upper case with no spaces, the same way normalizeInviteCode cleans what the tenant typed
export async function findInviteByCode(code) {
  const all = recordsToList(await getNode('invites'));
  return all.find((invite) => invite.code === code) || null;
}

// the same order the server checked it in: used, revoked, expired, then pending
export function inviteState(invite, now) {
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

// an invite is still waiting when nobody has used it and it hasn't run out
export function isPending(invite, now) {
  const current = now || new Date();
  return invite.usedAt === null && Date.parse(invite.expiresAt) > current.getTime();
}

export function pendingInvites(invites, now) {
  return invites.filter((invite) => isPending(invite, now));
}

// shows K7M2QX9P as K7M2-QX9P so it's easier to read out loud, the dash is ignored at signup
export function formatInviteCode(code) {
  return code.length === 8 ? code.slice(0, 4) + '-' + code.slice(4) : code;
}

// the text that goes in the share sheet
export function inviteShareText(invite, property_name) {
  return (
    'You have been invited to Rent Well' +
    (property_name ? ' for ' + property_name : '') +
    (invite.unitLabel ? ', ' + invite.unitLabel : '') +
    '. Download the app, tap Login, then "I have an invite code" and enter: ' +
    formatInviteCode(invite.code) +
    '. The code works once and expires on ' +
    invite.expiresAt.slice(0, 10) +
    '.'
  );
}

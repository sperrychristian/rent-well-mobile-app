// who is signed in, for the data modules: the old server read this from the token, here AuthContext sets it
// a landlord's records are scoped by their own id, a tenant's by their id and their landlord's (ownerId)
let current_user = null;

export function setSessionUser(user) {
  current_user = user || null;
}

export function sessionUser() {
  return current_user;
}

// the landlord whose records this session reads: the landlord themselves, or a tenant's landlord
export function sessionOwnerId() {
  if (!current_user) {
    return null;
  }
  return current_user.role === 'tenant' ? current_user.ownerId || null : current_user.id;
}

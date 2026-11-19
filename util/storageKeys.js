// in real mode each account gets its own saved data, so two people sharing a phone never see each other's
// no user (demo mode, or nobody signed in) keeps the original keys, so data saved before accounts existed stays where it was
export function storageKey(base_key, user_id) {
  return user_id ? base_key + '_' + user_id : base_key;
}

// assignment 12: the signed-in session (tokens, the Firebase localId, when the token runs out, and a copy of the
// user record) lives under this one key, in SecureStore on a phone (util/sessionStorage.js)
// only letters and underscores, since SecureStore keys can't have much else
export const auth_session_key = 'rent_well_auth_session';

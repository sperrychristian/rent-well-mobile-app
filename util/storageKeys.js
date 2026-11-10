// in real mode each account gets its own saved data, so two people sharing a phone never see each other's
// no user (demo mode, or nobody signed in) keeps the original keys, so data saved before accounts existed stays where it was
export function storageKey(base_key, user_id) {
  return user_id ? base_key + '_' + user_id : base_key;
}

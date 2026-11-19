// assignment 12: the token util/http.js puts on every database request (?auth=TOKEN)
// AuthContext sets it here when someone signs in and clears it on log out, and it hands over its refresh
// function, so util/http.js can get a fresh token without importing AuthContext (no import cycle)
import { createSingleFlight } from './apiHelpers';

// refresh when the token is this close to running out (Firebase tokens last an hour)
export const refresh_margin_ms = 5 * 60 * 1000;

let current = { token: null, expires_at: 0 };
let refresher = null;

// step 1: AuthContext calls these when the session changes
export function setAuthToken(token, expires_at) {
  current = { token: token || null, expires_at: Number(expires_at) || 0 };
}

export function clearAuthToken() {
  current = { token: null, expires_at: 0 };
}

export function currentAuthToken() {
  return current.token;
}

// refresh is an async function that gets a new token, saves it, calls setAuthToken, and gives back the new
// token, or throws (a rejected refresh token signs the person out inside it before it throws)
export function setTokenRefresher(refresh) {
  refresher = refresh || null;
}

export function needsRefresh(expires_at, now) {
  return !expires_at || expires_at - (now === undefined ? Date.now() : now) <= refresh_margin_ms;
}

// two requests that both need a refresh at the same moment share one refresh call
const shared_refresh = createSingleFlight(async () => {
  if (!refresher) {
    throw new Error('No refresh available');
  }
  return refresher();
});

// step 2: always refresh, used after the database says 401 or 403
export function forceRefresh() {
  return shared_refresh();
}

// step 3: before a request, the token to send: refreshed first if it's about to run out
// if the refresh only failed because of the network, the old token goes out anyway and the next request tries again
export async function freshAuthToken() {
  if (!current.token) {
    return null;
  }
  if (refresher && needsRefresh(current.expires_at)) {
    try {
      return await shared_refresh();
    } catch (error) {
      if (!current.token) {
        // the refresh was turned down and AuthContext already signed out
        throw error;
      }
      return current.token;
    }
  }
  return current.token;
}

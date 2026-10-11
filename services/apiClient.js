import {
  parseApiError,
  networkError,
  createSingleFlight,
  buildQuery,
  ApiError,
} from './apiHelpers';

// builds the api client, fetch and the token storage get passed in so the tests can use fakes
// options: base_url, fetch_fn, token_store ({ load, save, clear })
// the token store saves { access_token, refresh_token, user }
export function createApiClient(options) {
  let access_token = null;
  let refresh_token = null;
  // screens and the socket listen for 'session' (new tokens or user) and 'expired' (has to log in again)
  const listeners = new Set();

  function emit(event_name, payload) {
    listeners.forEach((listener) => listener(event_name, payload));
  }

  function onSessionEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // one network call with no refresh logic, every other request goes through this
  async function rawRequest(method, path, request_options) {
    const settings = request_options || {};
    const headers = { Accept: 'application/json' };
    if (settings.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (settings.token) {
      headers.Authorization = 'Bearer ' + settings.token;
    }

    let response;
    try {
      response = await options.fetch_fn(options.base_url + path + buildQuery(settings.query), {
        method: method,
        headers: headers,
        body: settings.body !== undefined ? JSON.stringify(settings.body) : undefined,
      });
    } catch {
      throw networkError();
    }

    // 204 has no body, and a broken server might send something that isn't JSON
    let data = null;
    if (response.status !== 204) {
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw parseApiError(response.status, data);
    }
    return data;
  }

  // the new refresh token gets saved before anything uses it, since the old one stops working right away
  async function saveSession(session) {
    access_token = session.tokens.accessToken;
    refresh_token = session.tokens.refreshToken;
    await options.token_store.save({
      access_token: access_token,
      refresh_token: refresh_token,
      user: session.user,
    });
    emit('session', { user: session.user, access_token: access_token });
    return session;
  }

  async function clearSession() {
    access_token = null;
    refresh_token = null;
    await options.token_store.clear();
  }

  async function runRefresh() {
    if (!refresh_token) {
      const stored = await options.token_store.load();
      refresh_token = stored ? stored.refresh_token : null;
    }
    if (!refresh_token) {
      throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Your session ended. Please log in again.');
    }
    try {
      const session = await rawRequest('POST', '/auth/refresh', {
        body: { refreshToken: refresh_token },
      });
      return await saveSession(session);
    } catch (error) {
      // a dead refresh token means logging in again, a network problem doesn't, so I keep the tokens for that
      if (error.code === 'REFRESH_TOKEN_INVALID') {
        await clearSession();
        emit('expired', error);
      }
      throw error;
    }
  }

  // only one refresh can be in flight, everyone else waits on the same one
  const refreshSession = createSingleFlight(runRefresh);

  // a request that needs the user signed in, on a TOKEN_INVALID 401 it refreshes once and tries again
  async function request(method, path, request_options) {
    const settings = request_options || {};
    if (settings.auth === false) {
      return rawRequest(method, path, settings);
    }
    const token_used = access_token;
    try {
      return await rawRequest(method, path, { ...settings, token: token_used });
    } catch (error) {
      if (error.status !== 401 || error.code !== 'TOKEN_INVALID') {
        throw error;
      }
      // if another request already refreshed while this one was out, I just use the new token
      if (!access_token || access_token === token_used) {
        await refreshSession();
      }
      return rawRequest(method, path, { ...settings, token: access_token });
    }
  }

  // loads the saved tokens and user without a network call, null when nobody is signed in
  async function loadStoredSession() {
    const stored = await options.token_store.load();
    if (!stored || !stored.refresh_token) {
      return null;
    }
    access_token = stored.access_token;
    refresh_token = stored.refresh_token;
    return stored;
  }

  return {
    request: request,
    rawRequest: rawRequest,
    saveSession: saveSession,
    clearSession: clearSession,
    refreshSession: refreshSession,
    loadStoredSession: loadStoredSession,
    onSessionEvent: onSessionEvent,
    getAccessToken: () => access_token,
    getRefreshToken: () => refresh_token,
  };
}

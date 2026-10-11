import { createApiClient } from './apiClient';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

function session(number) {
  return {
    user: { id: 'u1', name: 'Olivia', role: 'owner' },
    tokens: { accessToken: 'access-' + number, refreshToken: 'refresh-' + number },
  };
}

const token_invalid = { error: { code: 'TOKEN_INVALID', message: 'Token expired' } };

// a fake server where access-1 has expired and the refresh hands out access-2
function makeClient(overrides) {
  const calls = { refresh: 0, saved: [], requests: [] };
  const store = {
    data: { access_token: 'access-1', refresh_token: 'refresh-1', user: session(1).user },
    load: async () => store.data,
    save: async (data) => {
      calls.saved.push(data.refresh_token);
      store.data = data;
    },
    clear: async () => {
      store.data = null;
    },
  };
  const fetch_fn = async (url, init) => {
    calls.requests.push({ url: url, auth: init.headers.Authorization });
    if (url.endsWith('/auth/refresh')) {
      calls.refresh++;
      if (overrides && overrides.refresh) {
        return overrides.refresh(init);
      }
      // a slow refresh so the parallel requests really overlap
      await new Promise((resolve) => setTimeout(resolve, 5));
      return jsonResponse(200, session(2));
    }
    if (init.headers.Authorization === 'Bearer access-2') {
      return jsonResponse(200, { ok: true, url: url });
    }
    return jsonResponse(401, token_invalid);
  };
  const client = createApiClient({
    base_url: 'http://api',
    fetch_fn: fetch_fn,
    token_store: store,
  });
  return { client, calls, store };
}

describe('createApiClient', () => {
  test('parallel 401s share one refresh and every request is retried with the new token', async () => {
    const { client, calls, store } = makeClient();
    await client.loadStoredSession();
    const results = await Promise.all([
      client.request('GET', '/conversations'),
      client.request('GET', '/me'),
      client.request('GET', '/invites'),
    ]);
    expect(calls.refresh).toBe(1);
    expect(results.map((result) => result.ok)).toEqual([true, true, true]);
    expect(client.getAccessToken()).toBe('access-2');
    expect(store.data.refresh_token).toBe('refresh-2');
    // the refresh request itself never sends an access token
    const refresh_request = calls.requests.find((item) => item.url.endsWith('/auth/refresh'));
    expect(refresh_request.auth).toBeUndefined();
  });

  test('the new refresh token is saved before the retry goes out', async () => {
    const { client, calls } = makeClient();
    await client.loadStoredSession();
    await client.request('GET', '/me');
    expect(calls.saved).toEqual(['refresh-2']);
    const retry_index = calls.requests.findIndex((item) => item.auth === 'Bearer access-2');
    const refresh_index = calls.requests.findIndex((item) => item.url.endsWith('/auth/refresh'));
    expect(retry_index).toBeGreaterThan(refresh_index);
  });

  test('a dead refresh token clears the session and tells listeners to log in again', async () => {
    const { client, store } = makeClient({
      refresh: () =>
        jsonResponse(401, { error: { code: 'REFRESH_TOKEN_INVALID', message: 'Invalid' } }),
    });
    const events = [];
    client.onSessionEvent((name) => events.push(name));
    await client.loadStoredSession();
    await expect(client.request('GET', '/me')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
    expect(events).toEqual(['expired']);
    expect(store.data).toBeNull();
    expect(client.getAccessToken()).toBeNull();
  });

  test('a network failure during refresh keeps the tokens', async () => {
    const { client, store } = makeClient({
      refresh: () => {
        throw new TypeError('Network request failed');
      },
    });
    await client.loadStoredSession();
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(store.data.refresh_token).toBe('refresh-1');
  });

  test('other errors are not retried', async () => {
    let count = 0;
    const client = createApiClient({
      base_url: 'http://api',
      fetch_fn: async () => {
        count++;
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
      },
      token_store: { load: async () => null, save: async () => {}, clear: async () => {} },
    });
    await expect(client.request('GET', '/conversations/x/messages')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(count).toBe(1);
  });

  test('204 responses come back as null', async () => {
    const client = createApiClient({
      base_url: 'http://api',
      fetch_fn: async () => jsonResponse(204),
      token_store: { load: async () => null, save: async () => {}, clear: async () => {} },
    });
    await expect(client.request('POST', '/auth/logout', { auth: false, body: {} })).resolves.toBe(
      null,
    );
  });
});

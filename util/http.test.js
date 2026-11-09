import {
  nodeUrl,
  getNode,
  putNode,
  patchNode,
  pushNode,
  deleteNode,
  createIfAbsent,
  isFirebaseConfigured,
  request_timeout_ms,
} from './http';
import {
  installFakeFirebase,
  uninstallFakeFirebase,
  test_db_url,
} from '../scripts/testing/fakeFirebase';
import { generatePushId } from './data/pushId';
import { buildPatch, listToKeyed, keyedToList } from './data/records';

afterEach(() => {
  uninstallFakeFirebase();
  jest.useRealTimers();
});

describe('urls', () => {
  test('builds the node url with .json and encodes each piece', () => {
    installFakeFirebase();
    expect(nodeUrl('workOrders/abc')).toBe(test_db_url + '/workOrders/abc.json');
    expect(nodeUrl('')).toBe(test_db_url + '/.json');
    expect(nodeUrl('users/a b#c')).toBe(test_db_url + '/users/a%20b%23c.json');
  });

  test('a trailing slash in .env is trimmed', () => {
    installFakeFirebase();
    process.env.EXPO_PUBLIC_FIREBASE_DB_URL = test_db_url + '/';
    expect(nodeUrl('x')).toBe(test_db_url + '/x.json');
  });

  test('with no url every call says how to set it up instead of crashing', async () => {
    const saved = process.env.EXPO_PUBLIC_FIREBASE_DB_URL;
    delete process.env.EXPO_PUBLIC_FIREBASE_DB_URL;
    expect(isFirebaseConfigured()).toBe(false);
    await expect(getNode('users')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    if (saved !== undefined) {
      process.env.EXPO_PUBLIC_FIREBASE_DB_URL = saved;
    }
  });
});

describe('primitives against the fake database', () => {
  test('GET of a missing node gives the empty value the caller wants', async () => {
    installFakeFirebase();
    expect(await getNode('nothing')).toEqual({});
    expect(await getNode('nothing', null)).toBeNull();
    expect(await getNode('nothing', [])).toEqual([]);
  });

  test('PUT, then GET, then DELETE', async () => {
    const firebase = installFakeFirebase();
    await putNode('mileage/t1', { miles: 3, ownerId: 'o' });
    expect(await getNode('mileage/t1')).toEqual({ miles: 3, ownerId: 'o' });
    const put_call = firebase.fetch.calls[0];
    expect(put_call.method).toBe('PUT');
    expect(put_call.headers['Content-Type']).toBe('application/json');
    await deleteNode('mileage/t1');
    expect(await getNode('mileage', null)).toBeNull();
    expect(firebase.fetch.calls[2].method).toBe('DELETE');
    expect(firebase.fetch.calls[2].body).toBeUndefined();
  });

  test('POST gives back the new push id', async () => {
    installFakeFirebase();
    const id = await pushNode('messages/c1', { body: 'hi' });
    expect(typeof id).toBe('string');
    expect(await getNode('messages/c1/' + id)).toEqual({ body: 'hi' });
  });

  test('multi-path PATCH writes several records at once and null deletes', async () => {
    const firebase = installFakeFirebase({ a: { x: 1 }, b: { y: 2 } });
    await patchNode('', { 'a/x': 5, 'b/y': null, 'c/z': 'new' });
    expect(firebase.database.dump()).toEqual({ a: { x: 5 }, c: { z: 'new' } });
    expect(firebase.fetch.calls).toHaveLength(1);
  });

  test('createIfAbsent never overwrites an existing record', async () => {
    const firebase = installFakeFirebase({ charges: { 'rent-t-2026-11': { amountCents: 100 } } });
    expect(await createIfAbsent('charges/rent-t-2026-11', { amountCents: 999 })).toBe(false);
    expect(await createIfAbsent('charges/rent-t-2026-12', { amountCents: 100 })).toBe(true);
    expect(firebase.database.dump().charges).toEqual({
      'rent-t-2026-11': { amountCents: 100 },
      'rent-t-2026-12': { amountCents: 100 },
    });
    const conditional = firebase.fetch.calls[0];
    expect(conditional.headers['if-match']).toBe('null_etag');
  });
});

describe('errors', () => {
  test('offline, permission denied, not found, and server errors each get one friendly message', async () => {
    const firebase = installFakeFirebase();
    firebase.fetch.offline = true;
    await expect(getNode('x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
    firebase.fetch.offline = false;
    firebase.fetch.fail_status = 401;
    await expect(getNode('x')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    firebase.fetch.fail_status = 404;
    await expect(getNode('x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    firebase.fetch.fail_status = 503;
    const error = await getNode('x').catch((caught) => caught);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.message).toMatch(/Try again/);
    firebase.fetch.fail_status = 400;
    await expect(putNode('x', 1)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('a call that hangs stops after 10 seconds with a timeout error', async () => {
    installFakeFirebase();
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const pending = getNode('slow');
    jest.advanceTimersByTime(request_timeout_ms);
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('record helpers', () => {
  test('push ids sort in the order they were made, even in the same millisecond', () => {
    const ids = [
      generatePushId(1000),
      generatePushId(1000),
      generatePushId(1000),
      generatePushId(2000),
    ];
    expect([...ids].sort()).toEqual(ids);
    expect(ids[0]).toHaveLength(20);
  });

  test('lists go in as keyed objects and come back in order', () => {
    const keyed = listToKeyed(['a', 'b', 'c']);
    expect(Object.keys(keyed)).toEqual(['i000', 'i001', 'i002']);
    expect(keyedToList(keyed)).toEqual(['a', 'b', 'c']);
    expect(keyedToList(null)).toEqual([]);
  });

  test('buildPatch writes new records whole, changed fields only, and nulls for removed ones', () => {
    const patch = buildPatch(
      'mileage',
      { t1: { miles: 1, purpose: 'a' }, t2: { miles: 2 } },
      { t1: { miles: 5, purpose: 'a' }, t3: { miles: 3 } },
    );
    expect(patch).toEqual({
      'mileage/t1/miles': 5,
      'mileage/t3': { miles: 3 },
      'mileage/t2': null,
    });
  });

  test('stamp adds updatedAt to a changed record', () => {
    const patch = buildPatch('m', { a: { x: 1 } }, { a: { x: 2 } }, true);
    expect(Object.keys(patch).sort()).toEqual(['m/a/updatedAt', 'm/a/x']);
  });
});

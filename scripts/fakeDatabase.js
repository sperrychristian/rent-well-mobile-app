// an in-memory copy of the Realtime Database REST rules I use, shared by the local server
// (scripts/fakeFirebase.mjs, npm run firebase:fake) and the tests (a fake fetch on top of handle)
// it covers GET, PUT, PATCH (multi-path too), POST (push ids), DELETE, the .json suffix, nested paths,
// null for a missing node, empty objects disappearing, and the if-match null_etag condition

const push_chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let last_push_time = 0;
let push_count = 0;

// push ids sort by time, the counter keeps two in the same millisecond in order
function makePushId() {
  let time = Date.now();
  if (time === last_push_time) {
    push_count++;
  } else {
    last_push_time = time;
    push_count = 0;
  }
  let id = '';
  for (let index = 0; index < 8; index++) {
    id = push_chars.charAt(time % 64) + id;
    time = Math.floor(time / 64);
  }
  let count = push_count;
  let tail = '';
  for (let index = 0; index < 4; index++) {
    tail = push_chars.charAt(count % 64) + tail;
    count = Math.floor(count / 64);
  }
  for (let index = 0; index < 8; index++) {
    tail += push_chars.charAt(Math.floor(Math.random() * 64));
  }
  return id + tail;
}

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// Firebase drops nulls and empty objects, so a value is cleaned the same way before it's stored
function prune(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    // a real database stores an array as an object with numbered keys
    const keyed = {};
    value.forEach((item, index) => {
      const clean = prune(item);
      if (clean !== null) {
        keyed[String(index)] = clean;
      }
    });
    return Object.keys(keyed).length > 0 ? keyed : null;
  }
  if (typeof value === 'object') {
    const clean = {};
    Object.keys(value).forEach((key) => {
      const child = prune(value[key]);
      if (child !== null) {
        clean[key] = child;
      }
    });
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return value;
}

function partsOf(path) {
  return String(path || '')
    .split('/')
    .filter((part) => part !== '')
    .map((part) => decodeURIComponent(part));
}

const bad_key = /[.#$[\]]/;

export function createFakeDatabase(initial) {
  let root = prune(copy(initial || null));

  function read(parts) {
    let node = root;
    for (const part of parts) {
      if (node === null || typeof node !== 'object' || !(part in node)) {
        return null;
      }
      node = node[part];
    }
    return node === undefined ? null : node;
  }

  function write(parts, value) {
    const clean = prune(copy(value));
    if (parts.length === 0) {
      root = clean;
      return;
    }
    if (root === null || typeof root !== 'object') {
      root = {};
    }
    const trail = [root];
    let node = root;
    for (let index = 0; index < parts.length - 1; index++) {
      const part = parts[index];
      if (node[part] === null || typeof node[part] !== 'object') {
        node[part] = {};
      }
      node = node[part];
      trail.push(node);
    }
    const last = parts[parts.length - 1];
    if (clean === null) {
      delete node[last];
    } else {
      node[last] = clean;
    }
    // a parent left empty disappears too
    for (let index = trail.length - 1; index >= 1; index--) {
      if (Object.keys(trail[index]).length === 0) {
        delete trail[index - 1][parts[index - 1]];
      }
    }
    root = prune(root);
  }

  // a stable stand-in for Firebase's ETag, it only has to change when the value changes
  function etagOf(value) {
    if (value === null) {
      return 'null_etag';
    }
    const text = JSON.stringify(value);
    let hash = 0;
    for (let index = 0; index < text.length; index++) {
      hash = (hash * 31 + text.charCodeAt(index)) | 0;
    }
    return 'etag-' + (hash >>> 0).toString(16) + '-' + text.length;
  }

  function header(headers, name) {
    if (!headers) {
      return undefined;
    }
    const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
    return key ? headers[key] : undefined;
  }

  // method, path (no .json), body (already parsed), headers, gives back { status, body, headers }
  function handle(method, path, body, headers) {
    const parts = partsOf(path);
    if (parts.some((part) => bad_key.test(part))) {
      return { status: 400, body: { error: 'Invalid path.' } };
    }
    const if_match = header(headers, 'if-match');
    if (if_match !== undefined && (method === 'PUT' || method === 'DELETE')) {
      const current = read(parts);
      if (etagOf(current) !== if_match) {
        return { status: 412, body: current, headers: { ETag: etagOf(current) } };
      }
    }
    if (method === 'GET') {
      const value = read(parts);
      const out = {};
      if (header(headers, 'x-firebase-etag') === 'true') {
        out.ETag = etagOf(value);
      }
      return { status: 200, body: copy(value), headers: out };
    }
    if (method === 'PUT') {
      write(parts, body);
      return { status: 200, body: copy(body) };
    }
    if (method === 'POST') {
      const id = makePushId();
      write([...parts, id], body);
      return { status: 200, body: { name: id } };
    }
    if (method === 'DELETE') {
      write(parts, null);
      return { status: 200, body: null };
    }
    if (method === 'PATCH') {
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { status: 400, body: { error: 'Invalid data; could not parse JSON object.' } };
      }
      const keys = Object.keys(body);
      // a real database turns away a multi-path update where one path sits inside another
      for (const a of keys) {
        for (const b of keys) {
          if (a !== b && (b + '/').startsWith(a.replace(/\/+$/, '') + '/')) {
            return { status: 400, body: { error: 'Invalid data; ancestor paths overlap.' } };
          }
        }
      }
      keys.forEach((key) => write([...parts, ...partsOf(key)], body[key]));
      return { status: 200, body: copy(body) };
    }
    return { status: 405, body: { error: 'Method not allowed.' } };
  }

  return {
    handle,
    dump: () => copy(root),
    reset: (value) => {
      root = prune(copy(value || null));
    },
  };
}

// a fetch for the tests: same url shape as the real one, answers from a fake database
// base is the database url the test set in EXPO_PUBLIC_FIREBASE_DB_URL
export function createFakeFetch(database, base) {
  const calls = [];
  async function fakeFetch(url, init) {
    const settings = init || {};
    const method = (settings.method || 'GET').toUpperCase();
    calls.push({ url, method, body: settings.body, headers: settings.headers || {} });
    if (fakeFetch.offline) {
      throw new TypeError('Network request failed');
    }
    if (fakeFetch.fail_status) {
      return response(fakeFetch.fail_status, { error: 'Forced failure' }, {});
    }
    const prefix = base.replace(/\/+$/, '') + '/';
    const without_query = url.split('?')[0];
    const path = without_query.slice(prefix.length).replace(/\.json$/, '');
    const body = settings.body ? JSON.parse(settings.body) : undefined;
    const result = database.handle(method, path, body, settings.headers);
    return response(result.status, result.body, result.headers || {});
  }
  fakeFetch.calls = calls;
  fakeFetch.offline = false;
  fakeFetch.fail_status = 0;
  return fakeFetch;
}

function response(status, body, headers) {
  const text = body === undefined ? 'null' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: { get: (name) => headers[name] || headers[name.toLowerCase()] || null },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

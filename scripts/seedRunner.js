// the seed's real work, kept out of seedFirebase.mjs so the tests can run it against the fake (twice in a row)
// assignment 12: every seeded user gets a real Firebase Auth account first (Auth isn't covered by the database
// rules), then everything is written with one of those accounts' ID tokens as ?auth=, so it works whether the
// rules are still open or already say "auth != null". it never prints a password, a token, or the API key
import { buildSeedData } from './seedData';

const call_timeout_ms = 15000;

async function withTimeout(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call_timeout_ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// the email an account gets: the seeded one, or a clearly fake one made from the name
export function seedEmailFor(record) {
  if (record.email) {
    return record.email.toLowerCase();
  }
  const name = (record.name || record.id || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '.');
  return name.replace(/^\.+|\.+$/g, '') + '@example.com';
}

// step 1: one Auth call, the error comes back as just the Firebase code (never the body or the key)
async function authCall(settings, mode, email, password) {
  const url =
    settings.auth_url.replace(/\/+$/, '') +
    '/v1/accounts:' +
    mode +
    '?key=' +
    encodeURIComponent(settings.api_key);
  const response = await withTimeout((signal) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
      signal: signal,
    }),
  );
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data && data.error && data.error.message ? String(data.error.message) : '';
    const code = message.startsWith('API key not valid')
      ? 'INVALID_API_KEY'
      : message.split(':')[0].trim().split(' ')[0] || 'HTTP_' + response.status;
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return data;
}

// step 2: an account for every seeded user, made with signUp, or signed in to when it's already there
// gives back one row per user: who, which email, the localId, made or already there, and the ID token (kept in memory)
export async function createSeedAccounts(settings, users) {
  const rows = [];
  for (const user_id of Object.keys(users)) {
    const record = users[user_id];
    const email = seedEmailFor({ ...record, id: user_id });
    let answer;
    let made = true;
    try {
      answer = await authCall(settings, 'signUp', email, settings.password);
    } catch (error) {
      if (error.code !== 'EMAIL_EXISTS') {
        throw new Error('Could not make the account for ' + email + ' (' + error.code + ')');
      }
      made = false;
      try {
        answer = await authCall(settings, 'signInWithPassword', email, settings.password);
      } catch (sign_in_error) {
        throw new Error(
          'The account for ' +
            email +
            ' already exists with a different password (' +
            sign_in_error.code +
            '). Use the same SEED_ACCOUNT_PASSWORD as before, or delete that user in the Firebase console.',
        );
      }
    }
    rows.push({
      user_id: user_id,
      name: record.name || '',
      role: record.role,
      email: email,
      local_id: answer.localId,
      made: made,
      id_token: answer.idToken,
    });
  }
  return rows;
}

// step 3: one database call, with the token on the url when there is one
export async function dbCall(base, method, node_path, body, token) {
  const url =
    base.replace(/\/+$/, '') +
    '/' +
    node_path +
    '.json' +
    (token ? '?auth=' + encodeURIComponent(token) : '');
  const response = await withTimeout((signal) =>
    fetch(url, {
      method: method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal,
    }),
  );
  if (!response.ok) {
    // only the method, the node, and the status, never the url (it has the token on it)
    throw new Error(method + ' ' + (node_path || '/') + ' answered ' + response.status);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Firebase drops empty objects, so the check compares against the seed cleaned the same way
export function prune(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    const clean = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const child = prune(value[key]);
        if (child !== null) {
          clean[key] = child;
        }
      });
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return value;
}

// the seed tree with the accounts linked in: authUid on each user and an authLinks node
export function linkAccounts(tree, rows) {
  const linked = { ...tree, users: { ...tree.users }, authLinks: {} };
  rows.forEach((row) => {
    linked.users[row.user_id] = { ...linked.users[row.user_id], authUid: row.local_id };
    linked.authLinks[row.local_id] = row.user_id;
  });
  return linked;
}

// the seeded reminder's id comes from its send time, which moves every run, so that node is still written whole
// (PUT, the way the seed always wrote every node) or each run would add one more
const whole_nodes = ['reminders'];

// step 4: every seeded record, one multi-path PATCH per node, so records people made in the app stay put
// (a second run writes the same records again, so it gives the same data), --reset wipes everything first
export async function seedTree(base, tree, options) {
  const settings = options || {};
  const log = settings.log || (() => {});
  if (settings.reset) {
    await dbCall(base, 'DELETE', '', undefined, settings.token);
    log('Wiped the database.');
  }
  for (const node of Object.keys(tree)) {
    if (whole_nodes.includes(node)) {
      await dbCall(base, 'PUT', node, tree[node], settings.token);
      log('Seeded ' + node + ' (' + Object.keys(tree[node]).length + ')');
      continue;
    }
    const patch = {};
    Object.keys(tree[node]).forEach((key) => {
      patch[node + '/' + key] = tree[node][key];
    });
    await dbCall(base, 'PATCH', '', patch, settings.token);
    log('Seeded ' + node + ' (' + Object.keys(tree[node]).length + ')');
  }
}

// step 5: read every node back and compare each seeded record, gives back how many nodes failed
export async function checkTree(base, tree, options) {
  const settings = options || {};
  const log = settings.log || (() => {});
  let failures = 0;
  for (const node of Object.keys(tree)) {
    const saved = (await dbCall(base, 'GET', node, undefined, settings.token)) || {};
    const keys = Object.keys(tree[node]);
    const same = keys.every(
      (key) => JSON.stringify(prune(saved[key])) === JSON.stringify(prune(tree[node][key])),
    );
    const total = Object.keys(saved).length;
    const extra = total > keys.length ? ', ' + (total - keys.length) + ' more from the app' : '';
    log((same ? 'PASS ' : 'FAIL ') + node + ' (' + keys.length + ' seeded' + extra + ')');
    if (!same) {
      failures++;
    }
  }
  return failures;
}

// the whole run: accounts, then the data with a token, then the check if asked
// settings: db_url, auth_url, api_key, password, reset, check, now, log
export async function runSeed(settings) {
  const log = settings.log || (() => {});
  if (!settings.password || settings.password.length < 8) {
    throw new Error('SEED_ACCOUNT_PASSWORD is missing or shorter than 8 characters.');
  }
  const tree = buildSeedData(settings.now || new Date());
  const rows = await createSeedAccounts(settings, tree.users);
  log(
    'Accounts: ' +
      rows.filter((row) => row.made).length +
      ' made, ' +
      rows.filter((row) => !row.made).length +
      ' already there.',
  );
  // the first landlord's token does the writing, the rules only ask for a signed-in user
  const token = rows[0].id_token;
  const linked = linkAccounts(tree, rows);
  await seedTree(settings.db_url, linked, { reset: settings.reset, token: token, log: log });
  let failures = 0;
  if (settings.check) {
    failures = await checkTree(settings.db_url, linked, { token: token, log: log });
  }
  // the rows go back without the tokens
  return {
    tree: linked,
    accounts: rows.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      role: row.role,
      email: row.email,
      local_id: row.local_id,
      made: row.made,
    })),
    failures: failures,
  };
}

// the table printed at the end: emails only, never the password or a token
export function accountTable(accounts) {
  const lines = ['Role      Name             Email'];
  accounts.forEach((row) => {
    lines.push(
      (row.role === 'tenant' ? 'tenant' : 'landlord').padEnd(10) + row.name.padEnd(17) + row.email,
    );
  });
  return lines.join('\n');
}

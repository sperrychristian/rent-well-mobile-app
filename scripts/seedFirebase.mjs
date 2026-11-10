// fills a Firebase Realtime Database with the Rent Well sample data, through the REST endpoints
//   npm run firebase:seed                      the database in .env (EXPO_PUBLIC_FIREBASE_DB_URL)
//   npm run firebase:seed -- --reset           wipes the whole database first
//   npm run firebase:seed -- --url=http://localhost:9000    the local fake (npm run firebase:fake)
//   npm run firebase:check                     seeds, then reads every node back and says pass or fail
// it only writes to the database in .env or to a local address, anything else is turned away,
// and it never prints the database address or the API key
// running it again is safe: each node is written whole with PUT, so a second run gives the same data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeedData } from './seedData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// step 1: read .env myself (no package needed), only the one line I want
function envDatabaseUrl() {
  const env_path = path.join(root, '.env');
  if (!fs.existsSync(env_path)) {
    return '';
  }
  const line = fs
    .readFileSync(env_path, 'utf8')
    .split('\n')
    .find((item) => item.trim().startsWith('EXPO_PUBLIC_FIREBASE_DB_URL='));
  return line ? line.split('=').slice(1).join('=').trim().replace(/\/+$/, '') : '';
}

function argValue(name) {
  const found = process.argv.find((arg) => arg.startsWith('--' + name + '='));
  return found ? found.split('=').slice(1).join('=') : null;
}

function isLocal(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(url);
}

// step 2: pick the database, and refuse one I didn't configure
export function pickDatabase(arg_url, env_url) {
  const wanted = (arg_url || env_url || '').replace(/\/+$/, '');
  if (!wanted) {
    return {
      error:
        'No database. Put EXPO_PUBLIC_FIREBASE_DB_URL in .env, or pass --url=http://localhost:9000.',
    };
  }
  if (wanted === env_url || isLocal(wanted)) {
    return {
      url: wanted,
      label: isLocal(wanted) ? 'the local fake at ' + wanted : 'the database in .env',
    };
  }
  return { error: 'That address is not the one in .env or a local one, so nothing was written.' };
}

async function call(base, method, node_path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(base + '/' + node_path + '.json', {
      method: method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(method + ' ' + node_path + ' answered ' + response.status);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

// Firebase drops empty objects, so the check compares against the seed cleaned the same way
function prune(value) {
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

export async function seed(base, options) {
  const tree = buildSeedData(new Date());
  if (options.reset) {
    await call(base, 'DELETE', '');
    console.log('Wiped the database.');
  }
  for (const node of Object.keys(tree)) {
    await call(base, 'PUT', node, tree[node]);
    console.log('Seeded ' + node + ' (' + Object.keys(tree[node]).length + ')');
  }
  return tree;
}

export async function check(base, tree) {
  let failures = 0;
  for (const node of Object.keys(tree)) {
    const saved = await call(base, 'GET', node);
    const same = JSON.stringify(prune(saved)) === JSON.stringify(prune(tree[node]));
    const count = saved ? Object.keys(saved).length : 0;
    console.log((same ? 'PASS ' : 'FAIL ') + node + ' (' + count + ' records)');
    if (!same) {
      failures++;
    }
  }
  return failures;
}

if (process.argv[1] && process.argv[1].endsWith('seedFirebase.mjs')) {
  const picked = pickDatabase(argValue('url'), envDatabaseUrl());
  if (picked.error) {
    console.error(picked.error);
    process.exit(1);
  }
  console.log('Seeding ' + picked.label + '.');
  try {
    const tree = await seed(picked.url, { reset: process.argv.includes('--reset') });
    if (process.argv.includes('--check')) {
      const failures = await check(picked.url, tree);
      console.log(failures === 0 ? 'Every node checked out.' : failures + ' node(s) failed.');
      process.exit(failures === 0 ? 0 : 1);
    }
    console.log('Done. Test accounts: Taylor Brooks (landlord), Sam Rivera (tenant), and more.');
  } catch (error) {
    console.error('Seeding stopped: ' + error.message);
    process.exit(1);
  }
}

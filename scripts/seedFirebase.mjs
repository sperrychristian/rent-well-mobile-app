// fills a Firebase Realtime Database with the Rent Well sample data, through the REST endpoints
//   npm run firebase:seed                      the database in .env (EXPO_PUBLIC_FIREBASE_DB_URL)
//   npm run firebase:seed -- --reset           wipes the whole database first
//   npm run firebase:seed -- --url=http://localhost:9000    the local fake (npm run firebase:fake)
//   npm run firebase:check                     seeds, then reads every node back and says pass or fail
// it only writes to the database in .env or to a local address, anything else is turned away,
// and it never prints the database address or the API key
// assignment 12: it makes a Firebase Auth account for every seeded user first (password from
// SEED_ACCOUNT_PASSWORD in .env, it won't run without one), links them (authLinks and authUid), and writes
// with one account's token, so it works before and after the new rules are published
//   (with --url=http://localhost:9000 the accounts are made on the same local fake, --auth-url= picks another)
// running it again is safe: each seeded record is written whole again (one multi-path PATCH per node),
// so a second run gives the same data and accounts made in the app are left alone
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeed, accountTable } from './seedRunner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// step 1: read .env myself (no package needed), only the one line I want
// (now any one line, the seed needs the address, the API key, the Auth url, and the seed password)
function envValue(name) {
  const env_path = path.join(root, '.env');
  if (!fs.existsSync(env_path)) {
    return '';
  }
  const line = fs
    .readFileSync(env_path, 'utf8')
    .split('\n')
    .find((item) => item.trim().startsWith(name + '='));
  return line ? line.split('=').slice(1).join('=').trim() : '';
}

function envDatabaseUrl() {
  return envValue('EXPO_PUBLIC_FIREBASE_DB_URL').replace(/\/+$/, '');
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

// the Auth server for a run: --auth-url when given, the local fake for a local database, else Google's
// (a local Auth url left in .env never gets used against the real database by accident)
export function pickAuthUrl(arg_url, db_url) {
  if (arg_url) {
    return arg_url;
  }
  if (isLocal(db_url)) {
    return db_url;
  }
  return 'https://identitytoolkit.googleapis.com';
}

if (process.argv[1] && process.argv[1].endsWith('seedFirebase.mjs')) {
  const picked = pickDatabase(argValue('url'), envDatabaseUrl());
  if (picked.error) {
    console.error(picked.error);
    process.exit(1);
  }
  const password = process.env.SEED_ACCOUNT_PASSWORD || envValue('SEED_ACCOUNT_PASSWORD');
  if (!password || password.length < 8) {
    console.error(
      'No SEED_ACCOUNT_PASSWORD in .env (8 characters or more). Add one, it is the password every seeded account gets.',
    );
    process.exit(1);
  }
  const api_key = envValue('EXPO_PUBLIC_FIREBASE_API_KEY') || (isLocal(picked.url) ? 'fake' : '');
  if (!api_key) {
    console.error('No EXPO_PUBLIC_FIREBASE_API_KEY in .env, the accounts need it.');
    process.exit(1);
  }
  const auth_url = pickAuthUrl(argValue('auth-url'), picked.url);
  const checking = process.argv.includes('--check');
  console.log('Seeding ' + picked.label + '.');
  try {
    const result = await runSeed({
      db_url: picked.url,
      auth_url: auth_url,
      api_key: api_key,
      password: password,
      reset: process.argv.includes('--reset'),
      check: checking,
      log: (line) => console.log(line),
    });
    console.log('');
    console.log('Seeded accounts (the password is SEED_ACCOUNT_PASSWORD in .env):');
    console.log(accountTable(result.accounts));
    if (checking) {
      console.log(
        result.failures === 0 ? 'Every node checked out.' : result.failures + ' node(s) failed.',
      );
      process.exit(result.failures === 0 ? 0 : 1);
    }
    console.log('Done. Log in as Taylor Brooks (landlord) or Sam Rivera (tenant), and more.');
  } catch (error) {
    console.error('Seeding stopped: ' + error.message);
    process.exit(1);
  }
}

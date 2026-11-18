// the one place the app talks to Firebase: the Realtime Database through its REST endpoints, with plain fetch
// every node is at `${database url}/${path}.json`, JSON goes in and comes out, and every call has a 10 second limit
// the resource modules in util/data/ build on these primitives, and this file hands them out too,
// so screens and providers only ever import from util/http.js
import { ApiError } from './apiHelpers';
import { firebaseDbUrl } from '../constants/config';
import { freshAuthToken, forceRefresh, currentAuthToken } from './authToken';

export const request_timeout_ms = 10000;

// what a screen shows for each way a call can fail, short and plain
const http_messages = {
  NOT_CONFIGURED:
    'The database address is missing. Add EXPO_PUBLIC_FIREBASE_DB_URL to .env, then restart Expo with npx expo start -c.',
  NETWORK_ERROR: "Can't reach the database. Check your connection and try again.",
  TIMEOUT: 'The database took too long to answer. Check your connection and try again.',
  PERMISSION_DENIED:
    'The database turned this away. Check that the rules in database.rules.json are published in the Firebase console.',
  NOT_FOUND: "That couldn't be found. It may have been removed.",
  BAD_REQUEST: "The database couldn't save that. Check the form and try again.",
  PRECONDITION_FAILED: 'That record already exists, so it was left as it was.',
  SERVER_ERROR: 'The database had a problem. Try again in a moment.',
};

export function httpError(status, code) {
  return new ApiError(status, code, http_messages[code] || http_messages.SERVER_ERROR);
}

// true once .env has the database url, the app shows a setup screen in Firebase mode until then
export function isFirebaseConfigured() {
  return firebaseDbUrl() !== '';
}

// step 1: build the url for the node I want, a blank path is the root of the database
// each piece of the path gets encoded on its own so an id with a space or a # can't break the url
export function nodeUrl(path) {
  const base = firebaseDbUrl();
  if (!base) {
    throw httpError(0, 'NOT_CONFIGURED');
  }
  const clean = String(path || '')
    .split('/')
    .filter((part) => part !== '')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return base + '/' + clean + '.json';
}

// step 2: turn a failed response into one error the screens can show
function errorForStatus(status) {
  if (status === 401 || status === 403) {
    return httpError(status, 'PERMISSION_DENIED');
  }
  if (status === 404) {
    return httpError(status, 'NOT_FOUND');
  }
  if (status === 412) {
    return httpError(status, 'PRECONDITION_FAILED');
  }
  if (status >= 500) {
    return httpError(status, 'SERVER_ERROR');
  }
  return httpError(status, 'BAD_REQUEST');
}

// assignment 12: the signed-in token goes on the url as ?auth=TOKEN, the way the Realtime Database REST API
// takes it. the url already ends in .json, so the token is added after it (with & if there's already a ?),
// and it's encoded so a token can't break the url. the url with the token is never logged or put in an error
export function withAuth(url, token) {
  if (!token) {
    return url;
  }
  return url + (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(token);
}

// one try with the time limit, request() below calls it once, or twice after a refresh
async function send(method, url, body, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request_timeout_ms);
  try {
    const init = { method: method, headers: { ...(headers || {}) }, signal: controller.signal };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return await fetch(url, init);
  } catch (error) {
    // an abort means my own timer ran out, anything else means the phone couldn't reach the database
    if (controller.signal.aborted || (error && error.name === 'AbortError')) {
      throw httpError(0, 'TIMEOUT');
    }
    throw httpError(0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

// the token for this request, refreshed first when it's about to run out
// a refresh that was turned down already signed the person out, so the request stops with the permission message
async function tokenForRequest() {
  try {
    return await freshAuthToken();
  } catch {
    throw httpError(401, 'PERMISSION_DENIED');
  }
}

// step 3: one request with the time limit, every primitive below goes through here
// headers is for the conditional write, body is any JSON value (left out for GET and DELETE)
// a 401 or 403 with a token gets exactly one more try after a refresh, in case the token had just run out
export async function request(method, path, body, headers) {
  const url = nodeUrl(path);
  // signed out (or the demo) has no token, so the request goes straight out
  const token = currentAuthToken() ? await tokenForRequest() : null;
  let response = await send(method, withAuth(url, token), body, headers);
  if ((response.status === 401 || response.status === 403) && token) {
    let fresh = null;
    try {
      fresh = await forceRefresh();
    } catch {
      // no network for the refresh, or it was turned down (AuthContext signed out), either way it stops here
      throw errorForStatus(response.status);
    }
    response = await send(method, withAuth(url, fresh), body, headers);
  }
  if (!response.ok) {
    throw errorForStatus(response.status);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ----- the primitives -----

// null from Firebase means "nothing here", so the caller says what empty looks like (an object by default)
export async function getNode(path, empty) {
  const data = await request('GET', path);
  if (data === null || data === undefined) {
    return empty === undefined ? {} : empty;
  }
  return data;
}

// replaces whatever is at the path
export function putNode(path, data) {
  return request('PUT', path, data);
}

// changes only the keys I send, and at a parent a key can be a whole path ("workOrders/abc/status"),
// which writes several records in one atomic step (all of them land or none do), a null value deletes
export function patchNode(path, data) {
  return request('PATCH', path, data);
}

// adds a record under a new push id and gives back that id
export async function pushNode(path, data) {
  const result = await request('POST', path, data);
  return result.name;
}

export async function deleteNode(path) {
  await request('DELETE', path);
}

// writes the record only if nothing is there yet (the "null_etag" condition), so a repeat can never overwrite one
// gives back true when it made the record and false when one was already there
export async function createIfAbsent(path, data) {
  try {
    await request('PUT', path, data, { 'if-match': 'null_etag' });
    return true;
  } catch (error) {
    if (error.code === 'PRECONDITION_FAILED') {
      return false;
    }
    throw error;
  }
}

// ----- the resource modules, one per kind of record -----

export * from './data/session';
export * from './data/users';
export * from './data/properties';
export * from './data/tenants';
export * from './data/invites';
export * from './data/workOrders';
export * from './data/expenses';
export * from './data/mileage';
export * from './data/ledger';
export * from './data/leases';
export * from './data/messages';
export * from './data/reminders';
export * from './data/checklists';
export * from './data/documents';
export * from './data/settings';

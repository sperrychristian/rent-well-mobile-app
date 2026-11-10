// small pure helpers every resource module uses: timestamps, keyed objects instead of arrays,
// and working out the smallest multi-path PATCH between what was saved and what's on screen now
import { patchNode } from '../http';

export function nowIso() {
  return new Date().toISOString();
}

// Firebase keys can't have these, so an id with one of them gets a safe key instead
const bad_key = /[.#$[\]/]/;

export function isSafeKey(key) {
  return typeof key === 'string' && key !== '' && !bad_key.test(key);
}

// Firebase turns arrays into objects with numbered keys (and drops empty ones), so lists are saved as
// keyed objects: i000, i001, ... keeps the order, since Firebase hands keys back sorted
export function listToKeyed(list) {
  const keyed = {};
  (list || []).forEach((item, index) => {
    keyed['i' + String(index).padStart(3, '0')] = item;
  });
  return keyed;
}

// and back: the values in key order, an empty or missing one is an empty list
export function keyedToList(keyed) {
  if (!keyed || typeof keyed !== 'object') {
    return [];
  }
  if (Array.isArray(keyed)) {
    return keyed.filter((item) => item !== null && item !== undefined);
  }
  return Object.keys(keyed)
    .sort()
    .map((key) => keyed[key]);
}

// a node's records as a list, each with its id (a record saved without one gets its key)
export function recordsToList(node_value) {
  if (!node_value || typeof node_value !== 'object') {
    return [];
  }
  return Object.keys(node_value)
    .filter((key) => node_value[key] && typeof node_value[key] === 'object')
    .map((key) => ({ ...node_value[key], id: node_value[key].id || key }));
}

// JSON drops undefined, and Firebase drops null, so I take both out before comparing or saving
export function cleanRecord(record) {
  const clean = {};
  Object.keys(record).forEach((key) => {
    if (record[key] !== undefined && record[key] !== null) {
      clean[key] = record[key];
    }
  });
  return clean;
}

function sameValue(a, b) {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

// step 1: compare the saved records with the new ones, both as { id: record } in the database's shape
// step 2: a new record is written whole, a removed one is set to null (that deletes it in Firebase),
// and a changed one only gets the fields that changed, so two phones changing different fields don't clash
// gives back the paths for one multi-path PATCH at the root, like { 'mileage/abc/miles': 12 }
// stamp adds updatedAt to a changed record (and createdAt and updatedAt to a new one), for nodes that keep them
export function buildPatch(node, before_records, after_records, stamp) {
  const patch = {};
  const stamp_time = nowIso();
  const before = before_records || {};
  const after = after_records || {};
  Object.keys(after).forEach((id) => {
    const next = cleanRecord(after[id]);
    if (!before[id]) {
      patch[node + '/' + id] = stamp
        ? { createdAt: stamp_time, updatedAt: stamp_time, ...next }
        : next;
      return;
    }
    const previous = cleanRecord(before[id]);
    const fields = new Set([...Object.keys(previous), ...Object.keys(next)]);
    let changed = false;
    fields.forEach((field) => {
      if (!sameValue(previous[field], next[field])) {
        patch[node + '/' + id + '/' + field] = next[field] === undefined ? null : next[field];
        changed = true;
      }
    });
    if (changed && stamp && !(node + '/' + id + '/updatedAt' in patch)) {
      patch[node + '/' + id + '/updatedAt'] = stamp_time;
    }
  });
  Object.keys(before).forEach((id) => {
    if (!after[id]) {
      patch[node + '/' + id] = null;
    }
  });
  return patch;
}

// a list of the app's records to { id: database record }, toDb turns one into the database's shape
export function byId(list, toDb) {
  const records = {};
  (list || []).forEach((item) => {
    records[item.id] = toDb(item);
  });
  return records;
}

// writes the patch in one request, an empty one sends nothing
export async function savePatch(patch) {
  if (Object.keys(patch).length === 0) {
    return false;
  }
  await patchNode('', patch);
  return true;
}

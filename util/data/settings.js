// ownerSettings/{ownerId}: the landlord's mileage rate and budgets, one small record per landlord
// appearance, Face ID, and the demo tour stay on the phone, they belong to the device and not the account
import { getNode, patchNode } from '../http';
import { nowIso } from './records';

// gives back null when the landlord hasn't saved any yet, so the screen keeps its starting values
export async function getOwnerSettings(owner_id) {
  const record = await getNode('ownerSettings/' + owner_id, null);
  if (!record) {
    return null;
  }
  return {
    mileage_rate: typeof record.mileageRate === 'number' ? record.mileageRate : null,
    budgets: budgetsFromDb(record.budgets),
  };
}

// budgets are keyed by property name, which can have a period or a slash, so the names get encoded as keys
export function budgetsToDb(budgets) {
  const keyed = {};
  Object.keys(budgets || {}).forEach((name) => {
    keyed[encodeURIComponent(name).replace(/\./g, '%2E')] = budgets[name];
  });
  return keyed;
}

export function budgetsFromDb(keyed) {
  const budgets = {};
  Object.keys(keyed || {}).forEach((key) => {
    budgets[decodeURIComponent(key)] = keyed[key];
  });
  return budgets;
}

export function saveOwnerSettings(owner_id, settings) {
  return patchNode('ownerSettings/' + owner_id, {
    mileageRate: settings.mileage_rate,
    budgets: budgetsToDb(settings.budgets),
    updatedAt: nowIso(),
  });
}

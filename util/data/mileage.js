// mileage/{tripId}: a landlord's business trips, the Mileage screen and the Year-End Report read them
import { getNode } from '../http';
import { recordsToList, buildPatch, byId, savePatch } from './records';

// the database's trip in the app's shape (the app's trips never had timestamps, so they ride along as _iso fields)
export function fromDbTrip(record) {
  return {
    id: record.id,
    date: record.date || '',
    property: record.property || '',
    miles: typeof record.miles === 'number' ? record.miles : 0,
    purpose: record.purpose || '',
    created_at_iso: record.createdAt || null,
    updated_at_iso: record.updatedAt || null,
  };
}

export function toDbTrip(trip, owner_id) {
  return {
    id: trip.id,
    ownerId: owner_id,
    date: trip.date,
    property: trip.property || '',
    miles: Number(trip.miles) || 0,
    purpose: trip.purpose || '',
    createdAt: trip.created_at_iso || undefined,
    updatedAt: trip.updated_at_iso || undefined,
  };
}

// every trip for this landlord, oldest first like the local list
export async function getTrips(owner_id) {
  const all = recordsToList(await getNode('mileage'));
  return all
    .filter((record) => record.ownerId === owner_id)
    .map(fromDbTrip)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// saves whatever changed between the last saved list and the new one, in one multi-path write
export function saveTripChanges(before_list, after_list, owner_id) {
  const toDb = (trip) => toDbTrip(trip, owner_id);
  return savePatch(buildPatch('mileage', byId(before_list, toDb), byId(after_list, toDb), true));
}

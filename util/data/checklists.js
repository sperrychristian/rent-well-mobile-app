// checklists/{checklistId}: move-in and move-out inspections, rooms and items are keyed objects (no arrays)
// photos stay on the phone in demo mode only, the database keeps every other field of an item
import { getNode } from '../http';
import { recordsToList, listToKeyed, keyedToList, buildPatch, byId, savePatch } from './records';

function fromDbItem(item) {
  return {
    id: item.id,
    name: item.name || '',
    done: !!item.done,
    condition: item.condition || null,
    note: item.note || '',
    photos: [],
    ...(item.moveInCondition !== undefined ? { move_in_condition: item.moveInCondition } : {}),
    ...(item.moveInNote !== undefined ? { move_in_note: item.moveInNote } : {}),
  };
}

function toDbItem(item) {
  return {
    id: item.id,
    name: item.name || '',
    done: !!item.done,
    condition: item.condition || undefined,
    note: item.note || '',
    moveInCondition: item.move_in_condition === undefined ? undefined : item.move_in_condition,
    moveInNote: item.move_in_note === undefined ? undefined : item.move_in_note,
  };
}

export function fromDbChecklist(record) {
  return {
    id: record.id,
    property: record.property || '',
    type: record.type || 'Move-In',
    tenant: record.tenant || '',
    created_at: record.createdAt || '',
    move_in_id: record.moveInId || null,
    completed: !!record.completed,
    signed_by: record.signedBy || '',
    signed_on: record.signedOn || null,
    rooms: keyedToList(record.rooms).map((room) => ({
      id: room.id,
      name: room.name || '',
      items: keyedToList(room.items).map(fromDbItem),
    })),
    updated_at_iso: record.updatedAt || null,
  };
}

export function toDbChecklist(checklist, owner_id) {
  return {
    id: checklist.id,
    ownerId: owner_id,
    property: checklist.property || '',
    type: checklist.type,
    tenant: checklist.tenant || '',
    createdAt: checklist.created_at || '',
    moveInId: checklist.move_in_id || undefined,
    completed: !!checklist.completed,
    signedBy: checklist.signed_by || '',
    signedOn: checklist.signed_on || undefined,
    rooms: listToKeyed(
      (checklist.rooms || []).map((room) => ({
        id: room.id,
        name: room.name,
        items: listToKeyed((room.items || []).map(toDbItem)),
      })),
    ),
    updatedAt: checklist.updated_at_iso || undefined,
  };
}

export async function getChecklists(owner_id) {
  const all = recordsToList(await getNode('checklists'));
  return all.filter((record) => record.ownerId === owner_id).map(fromDbChecklist);
}

export function saveChecklistChanges(before_list, after_list, owner_id) {
  const toDb = (checklist) => toDbChecklist(checklist, owner_id);
  return savePatch(buildPatch('checklists', byId(before_list, toDb), byId(after_list, toDb), true));
}

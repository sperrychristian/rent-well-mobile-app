// documents/{documentId}: document records only, the Realtime Database can't hold the file itself,
// so stored_name stays empty until Firebase Storage is added (the Documents screen shows these as records)
import { getNode } from '../http';
import { recordsToList, buildPatch, byId, savePatch } from './records';

export function fromDbDocument(record) {
  return {
    id: record.id,
    name: record.name || '',
    category: record.category || 'Other',
    property: record.property || '',
    tenant: record.tenant || '',
    stored_name: null,
    file_name: record.fileName || '',
    mime_type: record.mimeType || '',
    size: typeof record.size === 'number' ? record.size : 0,
    added_at: record.addedAt || '',
    expires_on: record.expiresOn || null,
    notes: record.notes || '',
    shared_with_tenant: !!record.sharedWithTenant,
    // a record with no file reads like the samples did, opening it says there's no file
    sample: true,
    record_only: true,
    created_at_iso: record.createdAt || null,
    updated_at_iso: record.updatedAt || null,
  };
}

export function toDbDocument(document, owner_id) {
  return {
    id: document.id,
    ownerId: owner_id,
    name: document.name || '',
    category: document.category || 'Other',
    property: document.property || '',
    tenant: document.tenant || '',
    fileName: document.file_name || '',
    mimeType: document.mime_type || '',
    size: typeof document.size === 'number' ? document.size : 0,
    addedAt: document.added_at || '',
    expiresOn: document.expires_on || undefined,
    notes: document.notes || '',
    sharedWithTenant: !!document.shared_with_tenant,
    createdAt: document.created_at_iso || undefined,
    updatedAt: document.updated_at_iso || undefined,
  };
}

export async function getDocuments(owner_id) {
  const all = recordsToList(await getNode('documents'));
  return all.filter((record) => record.ownerId === owner_id).map(fromDbDocument);
}

export function saveDocumentChanges(before_list, after_list, owner_id) {
  const toDb = (document) => toDbDocument(document, owner_id);
  return savePatch(buildPatch('documents', byId(before_list, toDb), byId(after_list, toDb), true));
}

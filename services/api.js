import { File } from 'expo-file-system';
import { createApiClient } from './apiClient';
import { api_base_url } from './config';
import { loadTokens, saveTokens, clearTokens } from './tokenStorage';
import { ApiError, networkError } from './apiHelpers';

// the one api client the whole app shares, so there's only ever one refresh going at a time
export const api_client = createApiClient({
  base_url: api_base_url,
  fetch_fn: (url, init) => fetch(url, init),
  token_store: { load: loadTokens, save: saveTokens, clear: clearTokens },
});

// ----- health -----

export function checkHealth() {
  return api_client.rawRequest('GET', '/health');
}

// ----- auth -----

export async function registerOwner(fields) {
  const session = await api_client.request('POST', '/auth/register-owner', {
    auth: false,
    body: { email: fields.email, password: fields.password, name: fields.name },
  });
  return api_client.saveSession(session);
}

export async function registerTenant(fields) {
  const body = { inviteCode: fields.invite_code, email: fields.email, password: fields.password };
  // name is optional, the server uses the name on the invite when it's left out
  if (fields.name) {
    body.name = fields.name;
  }
  const session = await api_client.request('POST', '/auth/register-tenant', {
    auth: false,
    body: body,
  });
  return api_client.saveSession(session);
}

export async function login(email, password) {
  const session = await api_client.request('POST', '/auth/login', {
    auth: false,
    body: { email: email, password: password },
  });
  return api_client.saveSession(session);
}

// always safe to call, the server answers 204 even for a token it doesn't know
export async function logoutSession() {
  const refresh_token = api_client.getRefreshToken();
  if (refresh_token) {
    await api_client.request('POST', '/auth/logout', {
      auth: false,
      body: { refreshToken: refresh_token },
    });
  }
}

export async function getMe() {
  const data = await api_client.request('GET', '/me');
  return data.user;
}

// ----- properties and invites (owner only) -----

export async function getProperties() {
  const data = await api_client.request('GET', '/properties');
  return data.properties;
}

export async function createProperty(name, address) {
  const data = await api_client.request('POST', '/properties', {
    body: { name: name, address: address },
  });
  return data.property;
}

export async function getInvites() {
  const data = await api_client.request('GET', '/invites');
  return data.invites;
}

export async function createInvite(fields) {
  const body = { propertyId: fields.property_id, tenantName: fields.tenant_name };
  // unit is optional, and an empty one would fail the 1 to 50 character rule
  if (fields.unit_label) {
    body.unitLabel = fields.unit_label;
  }
  const data = await api_client.request('POST', '/invites', { body: body });
  return data.invite;
}

// ----- conversations and messages -----

export async function getConversations() {
  const data = await api_client.request('GET', '/conversations');
  return data.conversations;
}

// newest first, next_cursor is null when there's nothing older
export async function getMessages(conversation_id, cursor) {
  const data = await api_client.request(
    'GET',
    '/conversations/' + encodeURIComponent(conversation_id) + '/messages',
    { query: { limit: 30, cursor: cursor } },
  );
  return { messages: data.messages, next_cursor: data.nextCursor };
}

export async function sendMessage(conversation_id, body, attachment_key) {
  const request_body = { body: body };
  if (attachment_key) {
    request_body.attachmentKey = attachment_key;
  }
  const data = await api_client.request(
    'POST',
    '/conversations/' + encodeURIComponent(conversation_id) + '/messages',
    { body: request_body },
  );
  return data.message;
}

export function markConversationRead(conversation_id) {
  return api_client.request(
    'POST',
    '/conversations/' + encodeURIComponent(conversation_id) + '/read',
  );
}

// ----- work orders -----

// one page, newest first, filters is { status, property_id, cursor, limit }
// status can be one status or a list, the server takes them comma separated
export async function getWorkOrders(filters) {
  const settings = filters || {};
  const status = Array.isArray(settings.status) ? settings.status.join(',') : settings.status;
  const data = await api_client.request('GET', '/work-orders', {
    query: {
      status: status,
      propertyId: settings.property_id,
      cursor: settings.cursor,
      limit: settings.limit || 100,
    },
  });
  return { work_orders: data.workOrders, next_cursor: data.nextCursor };
}

// a small landlord has a handful of orders, so I just follow the cursor to the end (with a cap so it can't run forever)
export async function getAllWorkOrders(filters) {
  const all = [];
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const result = await getWorkOrders({ ...filters, cursor: cursor });
    all.push(...result.work_orders);
    cursor = result.next_cursor;
    if (!cursor) {
      break;
    }
  }
  return all;
}

export async function getWorkOrder(work_order_id) {
  const data = await api_client.request('GET', '/work-orders/' + encodeURIComponent(work_order_id));
  return data.workOrder;
}

// the tenant version, property, unit, and name come from the tenancy so they're never sent
// fields: title, description, priority, photo_keys, tenancy_id (only when the tenant has more than one)
export async function createTenantWorkOrder(fields) {
  const body = { title: fields.title, description: fields.description, priority: fields.priority };
  if (fields.photo_keys && fields.photo_keys.length > 0) {
    body.photoKeys = fields.photo_keys;
  }
  if (fields.tenancy_id) {
    body.tenancyId = fields.tenancy_id;
  }
  const data = await api_client.request('POST', '/work-orders', { body: body });
  return data.workOrder;
}

// changes is already in the server's shape, only the fields being changed get sent
async function patchWorkOrder(work_order_id, changes) {
  const data = await api_client.request(
    'PATCH',
    '/work-orders/' + encodeURIComponent(work_order_id),
    { body: changes },
  );
  return data.workOrder;
}

// owner only, the server fills in the started and resolved dates
export function updateWorkOrderStatus(work_order_id, status) {
  return patchWorkOrder(work_order_id, { status: status });
}

export function updateWorkOrderPriority(work_order_id, priority) {
  return patchWorkOrder(work_order_id, { priority: priority });
}

export function updateWorkOrderNotes(work_order_id, notes) {
  return patchWorkOrder(work_order_id, { ownerNotes: notes });
}

// estimate is a number or null, the server turns away strings
export function updateWorkOrderContractor(work_order_id, contractor, estimate) {
  return patchWorkOrder(work_order_id, { contractor: contractor, estimate: estimate });
}

// owner or tenant, the keys come from uploadImage and get added after the photos already there
export function addWorkOrderPhotos(work_order_id, photo_keys) {
  return patchWorkOrder(work_order_id, { addPhotoKeys: photo_keys });
}

// ----- uploads -----

const allowed_image_types = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// sign, then PUT the raw bytes with exactly the signed headers, and hand back the key for the message
export async function uploadImage(uri, mime_type) {
  const content_type = allowed_image_types.includes(mime_type) ? mime_type : 'image/jpeg';
  const file = new File(uri);
  // the size has to be the exact byte count or the upload gets turned away
  const size_bytes = file.size;
  if (!size_bytes) {
    throw new ApiError(0, 'UPLOAD_FAILED', "The photo couldn't be read. Try picking it again.");
  }
  const signed = await api_client.request('POST', '/uploads/sign', {
    body: { contentType: content_type, sizeBytes: size_bytes },
  });

  let result;
  try {
    // no Authorization header here, the url is already signed
    result = await file.upload(signed.uploadUrl, {
      httpMethod: signed.method || 'PUT',
      headers: signed.headers,
    });
  } catch {
    throw networkError();
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      result.status,
      'UPLOAD_FAILED',
      "The photo didn't upload. Try sending it again.",
    );
  }
  return signed.key;
}

// download urls run out after 5 minutes, so callers ask again instead of saving them
export async function getAttachmentUrl(key) {
  const data = await api_client.request('GET', '/uploads/url', { query: { key: key } });
  return { url: data.url, expires_at: data.expiresAt };
}

// ----- push tokens -----

export function registerPushToken(token, platform) {
  return api_client.request('POST', '/push-tokens', {
    body: { token: token, platform: platform },
  });
}

export function unregisterPushToken(token) {
  return api_client.request('DELETE', '/push-tokens', { body: { token: token } });
}

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

import { getAttachmentUrl } from './api';

// download urls run out after 5 minutes, so I keep each one until just before that and then ask again
const cached_urls = new Map();

export async function cachedAttachmentUrl(key) {
  const cached = cached_urls.get(key);
  if (cached && Date.parse(cached.expires_at) - Date.now() > 30000) {
    return cached.url;
  }
  const fresh = await getAttachmentUrl(key);
  cached_urls.set(key, fresh);
  return fresh.url;
}

export function forgetAttachmentUrl(key) {
  cached_urls.delete(key);
}

// logging out shouldn't leave the last account's links around
export function clearAttachmentUrls() {
  cached_urls.clear();
}

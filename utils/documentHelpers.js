import { expiring_soon_days } from '../data/documentOptions';

// .pdf from lease.pdf, or nothing if the name has no extension
export function extensionOf(file_name) {
  const match = /\.[a-z0-9]+$/i.exec(file_name || '');
  return match ? match[0].toLowerCase() : '';
}

// lease.pdf turns into lease, used as the default document name
export function nameFromFile(file_name) {
  return (file_name || '').replace(/\.[a-z0-9]+$/i, '');
}

// a backup for when the picker doesn't say what kind of file it is
export function guessMimeType(file_name) {
  const types = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[extensionOf(file_name)] || 'application/octet-stream';
}

export function isImage(mime_type) {
  return (mime_type || '').startsWith('image/');
}

// one icon per kind of file so the list is easy to scan
export function iconFor(mime_type) {
  if (mime_type === 'application/pdf') {
    return 'document-text-outline';
  }
  if (isImage(mime_type)) {
    return 'image-outline';
  }
  if ((mime_type || '').includes('word')) {
    return 'document-outline';
  }
  return 'document-attach-outline';
}

// whole days from today to the date, negative once it has passed
// today is optional date text like 2026-10-08, tests pass it so they don't depend on the real clock
export function daysUntil(date_string, today) {
  const parts = date_string.split('-').map(Number);
  const target = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  let today_utc;
  if (today) {
    const today_parts = today.split('-').map(Number);
    today_utc = Date.UTC(today_parts[0], today_parts[1] - 1, today_parts[2]);
  } else {
    const now = new Date();
    today_utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return Math.round((target - today_utc) / 86400000);
}

// the tag text for an end date, null when there's no end date or it's still far off
export function expiryTag(expires_on, today) {
  if (!expires_on) {
    return null;
  }
  const days = daysUntil(expires_on, today);
  if (days < 0) {
    return { text: 'Expired', expired: true };
  }
  if (days <= expiring_soon_days) {
    return { text: days === 0 ? 'Expires today' : 'Expires in ' + days + (days === 1 ? ' day' : ' days'), expired: false };
  }
  return null;
}

// turns a byte count into something like 2.4 MB
export function formatSize(bytes) {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

import { COLORS } from '../../theme';

// pure helpers for the ui pieces, nothing here draws anything so the tests can check them

// the fill, text color, and icon for each status or tag, the pill always shows the words too so it's never color only
// the meanings match the colors the app already used (Open is red, In Progress orange, Resolved green)
const tones = {
  // work orders
  'Open': { fill: COLORS.danger, text: COLORS.text_light, icon: 'alert-circle' },
  'In Progress': { fill: COLORS.warning, text: COLORS.on_light, icon: 'time' },
  'Resolved': { fill: COLORS.success, text: COLORS.text_light, icon: 'checkmark-circle' },
  // priority
  'Emergency': { fill: COLORS.priority_emergency, text: COLORS.text_light, icon: 'flash' },
  'Normal': { fill: COLORS.secondary, text: COLORS.text_light, icon: 'remove-circle' },
  'Low': { fill: COLORS.priority_low, text: COLORS.text_light, icon: 'arrow-down-circle' },
  // tenants and invites
  'Active': { fill: COLORS.success, text: COLORS.text_light, icon: 'home' },
  'Ended': { fill: COLORS.secondary, text: COLORS.text_light, icon: 'exit' },
  'Pending': { fill: COLORS.warning, text: COLORS.on_light, icon: 'hourglass' },
  'Accepted': { fill: COLORS.success, text: COLORS.text_light, icon: 'checkmark-circle' },
  'Revoked': { fill: COLORS.secondary, text: COLORS.text_light, icon: 'close-circle' },
  'Expired': { fill: COLORS.secondary, text: COLORS.text_light, icon: 'time' },
  // checklists
  'Signed': { fill: COLORS.success, text: COLORS.text_light, icon: 'create' },
  'In progress': { fill: COLORS.warning, text: COLORS.on_light, icon: 'time' },
  'Move-In': { fill: COLORS.info, text: COLORS.text_light, icon: 'enter' },
  'Good': { fill: COLORS.success, text: COLORS.text_light, icon: 'happy' },
  'Fair': { fill: COLORS.warning, text: COLORS.on_light, icon: 'remove-circle' },
  'Poor': { fill: COLORS.danger, text: COLORS.text_light, icon: 'sad' },
  'Move-Out': { fill: COLORS.accent, text: COLORS.text_light, icon: 'exit' },
  // money and documents
  'Paid': { fill: COLORS.success, text: COLORS.text_light, icon: 'checkmark-circle' },
  'Due': { fill: COLORS.warning, text: COLORS.on_light, icon: 'calendar' },
  'Late': { fill: COLORS.danger, text: COLORS.text_light, icon: 'alert-circle' },
  'Billed': { fill: COLORS.tag_billed, text: COLORS.text_light, icon: 'receipt' },
  'Recurring': { fill: COLORS.tag_recurring, text: COLORS.text_light, icon: 'repeat' },
  'No receipt': { fill: COLORS.tag_missing_receipt, text: COLORS.text_light, icon: 'alert' },
  'Capital': { fill: COLORS.accent, text: COLORS.text_light, icon: 'trending-up' },
  'Demo': { fill: COLORS.warning, text: COLORS.on_light, icon: 'play-circle' },
};

const neutral_tone = { fill: COLORS.surface_raised, text: COLORS.text, icon: null };

// gives back { fill, text, icon } for a status, anything unknown gets the neutral grey look
export function statusTone(label) {
  return tones[label] || neutral_tone;
}

// the list of statuses the pill knows, the tests use it to check every one is readable
export const known_statuses = Object.keys(tones);

// "Sam Rivera" into "SR", one word gives one letter, blank gives "?"
export function initialsFor(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// the same name always gets the same avatar color, picked from a few theme fills
const avatar_fills = [
  COLORS.primary,
  COLORS.accent,
  COLORS.success,
  COLORS.info,
  COLORS.priority_low,
];

export function avatarFill(name) {
  const text = String(name || '');
  let total = 0;
  for (let index = 0; index < text.length; index++) {
    total = (total + text.charCodeAt(index)) % 997;
  }
  return avatar_fills[total % avatar_fills.length];
}

// unread counts past 99 show as 99+ so the badge stays small
export function badgeLabel(count) {
  if (!count || count < 0) {
    return '';
  }
  return count > 99 ? '99+' : String(count);
}

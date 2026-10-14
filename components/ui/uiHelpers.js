import { COLORS } from '../../theme';

// pure helpers for the ui pieces, nothing here draws anything so the tests can check them

// the soft tint and the text color for each tone, icon circles, pills, banners, and avatars all use these
// the fintech pass moved everything to tinted backgrounds with the matching dark text instead of solid fills
export const tone_colors = {
  brand: { tint: COLORS.brand_tint, text: COLORS.cta },
  success: { tint: COLORS.success_tint, text: COLORS.success_text },
  info: { tint: COLORS.info_tint, text: COLORS.info_text },
  accent: { tint: COLORS.accent_tint, text: COLORS.accent_text },
  warning: { tint: COLORS.warning_tint, text: COLORS.warning_text },
  danger: { tint: COLORS.danger_tint, text: COLORS.danger_text },
  neutral: { tint: COLORS.neutral_tint, text: COLORS.text_muted },
};

// the tone for a name, anything unknown is neutral
export function toneColors(tone) {
  return tone_colors[tone] || tone_colors.neutral;
}

function tinted(tone, icon) {
  const colors = toneColors(tone);
  return { fill: colors.tint, text: colors.text, icon: icon };
}

// the fill, text color, and icon for each status or tag, the pill always shows the words too so it's never color only
// the meanings match the colors the app already used (Open is red, In Progress orange, Resolved green)
const tones = {
  // work orders
  'Open': tinted('danger', 'alert-circle'),
  'In Progress': tinted('warning', 'time'),
  'Resolved': tinted('success', 'checkmark-circle'),
  // priority, an emergency stays a solid red so it can't be missed
  // (the Hearth pass has no fills, so label_color is the terracotta the words use on the paper)
  'Emergency': {
    fill: COLORS.priority_emergency,
    text: COLORS.text_light,
    icon: 'flash',
    label_color: COLORS.danger_text,
  },
  'Normal': tinted('neutral', 'remove-circle'),
  'Low': tinted('info', 'arrow-down-circle'),
  // tenants and invites
  'Active': tinted('success', 'home'),
  'Ended': tinted('neutral', 'exit'),
  'Pending': tinted('warning', 'hourglass'),
  'Accepted': tinted('success', 'checkmark-circle'),
  'Revoked': tinted('neutral', 'close-circle'),
  'Expired': tinted('neutral', 'time'),
  // checklists
  'Signed': tinted('success', 'create'),
  'In progress': tinted('warning', 'time'),
  'Move-In': tinted('info', 'enter'),
  'Move-Out': tinted('accent', 'exit'),
  'Good': tinted('success', 'happy'),
  'Fair': tinted('warning', 'remove-circle'),
  'Poor': tinted('danger', 'sad'),
  // money and documents
  'Paid': tinted('success', 'checkmark-circle'),
  'Due': tinted('warning', 'calendar'),
  'Late': tinted('danger', 'alert-circle'),
  'Billed': tinted('info', 'receipt'),
  'Recurring': tinted('neutral', 'repeat'),
  'No receipt': tinted('warning', 'alert'),
  'Capital': tinted('accent', 'trending-up'),
  'Demo': tinted('brand', 'play-circle'),
};

const neutral_tone = { fill: COLORS.neutral_tint, text: COLORS.text, icon: null };

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
// (the fintech pass made those soft tints with their dark text for the initials)
const avatar_tones = ['brand', 'accent', 'success', 'info', 'warning'];

export function avatarTone(name) {
  const text = String(name || '');
  let total = 0;
  for (let index = 0; index < text.length; index++) {
    total = (total + text.charCodeAt(index)) % 997;
  }
  return toneColors(avatar_tones[total % avatar_tones.length]);
}

// kept for anything that still wants a single color, it's the tint
export function avatarFill(name) {
  return avatarTone(name).tint;
}

// unread counts past 99 show as 99+ so the badge stays small
export function badgeLabel(count) {
  if (!count || count < 0) {
    return '';
  }
  return count > 99 ? '99+' : String(count);
}

// turns a list of numbers into points for a little trend line that fills width by height
// the lowest value sits on the bottom edge and the highest on the top, a flat line sits in the middle,
// and inset keeps the line's stroke from getting cut off at the edges
export function sparklinePoints(values, width, height, inset) {
  const list = (values || []).filter((value) => Number.isFinite(value));
  if (list.length === 0 || width <= 0 || height <= 0) {
    return [];
  }
  const pad = inset || 0;
  const low = Math.min(...list);
  const high = Math.max(...list);
  const usable_height = Math.max(height - pad * 2, 0);
  const step = list.length > 1 ? (width - pad * 2) / (list.length - 1) : 0;
  return list.map((value, index) => {
    const share = high === low ? 0.5 : (value - low) / (high - low);
    return {
      x: Math.round((pad + (list.length > 1 ? step * index : (width - pad * 2) / 2)) * 100) / 100,
      y: Math.round((pad + usable_height * (1 - share)) * 100) / 100,
    };
  });
}

import {
  statusTone,
  known_statuses,
  initialsFor,
  avatarFill,
  avatarTone,
  badgeLabel,
  toneColors,
  tone_colors,
} from './uiHelpers';
import { COLORS } from '../../theme';
import { meetsAA } from '../../utils/contrast';

describe('statusTone', () => {
  test('keeps the meanings the app already used for work orders, as soft tints', () => {
    expect(statusTone('Open').fill).toBe(COLORS.danger_tint);
    expect(statusTone('Open').text).toBe(COLORS.danger_text);
    expect(statusTone('In Progress').fill).toBe(COLORS.warning_tint);
    expect(statusTone('Resolved').fill).toBe(COLORS.success_tint);
    // an emergency stays solid so it can't be missed
    expect(statusTone('Emergency').fill).toBe(COLORS.priority_emergency);
    expect(statusTone('Normal').fill).toBe(COLORS.neutral_tint);
    expect(statusTone('Low').fill).toBe(COLORS.info_tint);
  });

  test('every known status has readable text on its fill and an icon, so it is never color only', () => {
    known_statuses.forEach((label) => {
      const tone = statusTone(label);
      expect({ label, readable: meetsAA(tone.text, tone.fill) }).toEqual({ label, readable: true });
      expect({ label, has_icon: !!tone.icon }).toEqual({ label, has_icon: true });
    });
  });

  test('an unknown status gets the neutral look', () => {
    const tone = statusTone('Something new');
    expect(tone.fill).toBe(COLORS.neutral_tint);
    expect(meetsAA(tone.text, tone.fill)).toBe(true);
  });
});

describe('initialsFor', () => {
  test('first and last initials, upper case', () => {
    expect(initialsFor('Sam Rivera')).toBe('SR');
    expect(initialsFor('mary jo de la cruz')).toBe('MC');
    expect(initialsFor('  Priya  ')).toBe('P');
  });

  test('a blank or missing name gives a question mark', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor(null)).toBe('?');
    expect(initialsFor(undefined)).toBe('?');
  });
});

describe('avatarTone', () => {
  test('the same name always gets the same tint, and its initials are readable on it', () => {
    expect(avatarTone('Sam Rivera')).toEqual(avatarTone('Sam Rivera'));
    expect(avatarFill('Sam Rivera')).toBe(avatarTone('Sam Rivera').tint);
    ['Sam Rivera', 'Jordan Lee', 'Alex Chen', 'Priya Shah', '', null].forEach((name) => {
      const tone = avatarTone(name);
      expect(meetsAA(tone.text, tone.tint)).toBe(true);
    });
  });
});

describe('toneColors', () => {
  test('every tone has readable text on its tint, and unknown tones are neutral', () => {
    Object.entries(tone_colors).forEach(([name, tone]) => {
      expect({ name, ok: meetsAA(tone.text, tone.tint) }).toEqual({ name, ok: true });
    });
    expect(toneColors('nope')).toBe(tone_colors.neutral);
  });
});

describe('badgeLabel', () => {
  test('shows the count, caps at 99+, and is empty at zero', () => {
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(99)).toBe('99');
    expect(badgeLabel(100)).toBe('99+');
    expect(badgeLabel(0)).toBe('');
    expect(badgeLabel(undefined)).toBe('');
    expect(badgeLabel(-2)).toBe('');
  });
});

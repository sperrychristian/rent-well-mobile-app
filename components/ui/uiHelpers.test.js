import { statusTone, known_statuses, initialsFor, avatarFill, badgeLabel } from './uiHelpers';
import { COLORS } from '../../theme';
import { meetsAA } from '../../utils/contrast';

describe('statusTone', () => {
  test('keeps the colors the app already used for work orders', () => {
    expect(statusTone('Open').fill).toBe(COLORS.danger);
    expect(statusTone('In Progress').fill).toBe(COLORS.warning);
    expect(statusTone('Resolved').fill).toBe(COLORS.success);
    expect(statusTone('Emergency').fill).toBe(COLORS.priority_emergency);
    expect(statusTone('Normal').fill).toBe(COLORS.secondary);
    expect(statusTone('Low').fill).toBe(COLORS.priority_low);
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
    expect(tone.fill).toBe(COLORS.surface_raised);
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

describe('avatarFill', () => {
  test('the same name always gets the same color, and white initials are readable on it', () => {
    expect(avatarFill('Sam Rivera')).toBe(avatarFill('Sam Rivera'));
    ['Sam Rivera', 'Jordan Lee', 'Alex Chen', 'Priya Shah', '', null].forEach((name) => {
      expect(meetsAA(COLORS.text_light, avatarFill(name))).toBe(true);
    });
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

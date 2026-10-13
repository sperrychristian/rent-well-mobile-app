import { COLORS, TYPE, SPACING, RADIUS, SHADOWS, SIZES } from './theme';
import { contrastRatio, meetsAA } from './utils/contrast';

// every text color the screens put on every surface it can land on, AA is 4.5 for normal text
const surfaces = ['background', 'surface', 'surface_raised', 'muted'];
const text_tokens = [
  'text',
  'title',
  'text_muted',
  'success_text',
  'info_text',
  'accent_text',
  'warning_text',
  'danger_text',
  'cta',
];

// label text on each filled button or pill
const fills_with_light_text = [
  'primary',
  'success',
  'action',
  'info',
  'accent',
  'danger',
  'secondary',
  'priority_emergency',
  'priority_low',
  'tag_billed',
  'tag_recurring',
  'tag_missing_receipt',
  'toast_background',
];
const fills_with_dark_text = ['cta', 'cta_pressed', 'highlight', 'warning'];

describe('theme contrast', () => {
  test('every text color is AA on every surface', () => {
    const failing = [];
    text_tokens.forEach((text) => {
      surfaces.forEach((surface) => {
        if (!meetsAA(COLORS[text], COLORS[surface])) {
          failing.push(
            text + ' on ' + surface + ' = ' + contrastRatio(COLORS[text], COLORS[surface]),
          );
        }
      });
    });
    expect(failing).toEqual([]);
  });

  test('white text is AA on every dark fill', () => {
    fills_with_light_text.forEach((fill) => {
      expect({ fill, ok: meetsAA(COLORS.text_light, COLORS[fill]) }).toEqual({ fill, ok: true });
    });
  });

  // a plain PrimaryButton that a screen recolors keeps the off-white text color, so that has to pass too
  test('the off-white text color is AA on every dark fill', () => {
    fills_with_light_text.forEach((fill) => {
      expect({ fill, ok: meetsAA(COLORS.text, COLORS[fill]) }).toEqual({ fill, ok: true });
    });
  });

  test('dark text is AA on every light fill', () => {
    fills_with_dark_text.forEach((fill) => {
      expect({ fill, ok: meetsAA(COLORS.on_cta, COLORS[fill]) }).toEqual({ fill, ok: true });
      expect({ fill, ok: meetsAA(COLORS.text_dark, COLORS[fill]) }).toEqual({ fill, ok: true });
    });
  });

  test('borders and the focus ring are visible (3 to 1 for non-text)', () => {
    expect(contrastRatio(COLORS.border_strong, COLORS.background)).toBeGreaterThanOrEqual(2);
    expect(meetsAA(COLORS.focus, COLORS.surface, true)).toBe(true);
    expect(meetsAA(COLORS.focus, COLORS.background, true)).toBe(true);
  });
});

describe('theme tokens', () => {
  test('every color is a hex color or an rgba or keyword overlay', () => {
    Object.entries(COLORS).forEach(([name, value]) => {
      const ok = /^#[0-9a-f]{6}$/i.test(value) || /^rgba\(/.test(value) || value === 'black';
      expect({ name, ok }).toEqual({ name, ok: true });
    });
  });

  test('the type scale has a line height bigger than the size so larger fonts do not clip', () => {
    Object.entries(TYPE)
      .filter(([name]) => name !== 'input')
      .forEach(([name, style]) => {
        expect({ name, ok: style.lineHeight > style.fontSize }).toEqual({ name, ok: true });
      });
    // text boxes leave it out on purpose (iOS centers single-line input text badly with one)
    expect(TYPE.input.lineHeight).toBeUndefined();
  });

  test('the spacing and radius steps go up in order', () => {
    const ascending = (values) =>
      values.every((value, index) => index === 0 || value > values[index - 1]);
    expect(ascending(Object.values(SPACING))).toBe(true);
    expect(ascending(Object.values(RADIUS))).toBe(true);
  });

  test('every shadow works on Android too and the touch size is at least 44', () => {
    Object.values(SHADOWS).forEach((shadow) => expect(shadow.elevation).toBeDefined());
    expect(SIZES.touch).toBeGreaterThanOrEqual(44);
    expect(SIZES.button_medium).toBeGreaterThanOrEqual(44);
  });
});

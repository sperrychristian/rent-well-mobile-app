import { COLORS, TYPE, SPACING, RADIUS, SHADOWS, SIZES, NUMBERS } from './theme';
import { contrastRatio, meetsAA } from './utils/contrast';

// every text color the screens put on every surface it can land on, AA is 4.5 for normal text
const surfaces = ['background', 'surface', 'surface_raised', 'surface_sunken', 'muted'];
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
  'primary',
];

// each state's text color sits on its own tint in pills and banners
const tint_pairs = [
  ['success_text', 'success_tint'],
  ['info_text', 'info_tint'],
  ['accent_text', 'accent_tint'],
  ['warning_text', 'warning_tint'],
  ['danger_text', 'danger_tint'],
  ['text_muted', 'neutral_tint'],
  ['cta', 'brand_tint'],
  ['text', 'neutral_tint'],
];

// label text on each filled button or pill
const fills_with_light_text = [
  'primary',
  'cta',
  'cta_pressed',
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
const fills_with_dark_text = ['highlight', 'warning'];

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

  test('each state text color is AA on its own tint', () => {
    tint_pairs.forEach(([text, tint]) => {
      expect({ text, tint, ok: meetsAA(COLORS[text], COLORS[tint]) }).toEqual({
        text,
        tint,
        ok: true,
      });
    });
  });

  test('white text is AA on every dark fill', () => {
    fills_with_light_text.forEach((fill) => {
      expect({ fill, ok: meetsAA(COLORS.text_light, COLORS[fill]) }).toEqual({ fill, ok: true });
    });
  });

  test('ink text is AA on every light fill', () => {
    fills_with_dark_text.forEach((fill) => {
      expect({ fill, ok: meetsAA(COLORS.on_light, COLORS[fill]) }).toEqual({ fill, ok: true });
      expect({ fill, ok: meetsAA(COLORS.text_dark, COLORS[fill]) }).toEqual({ fill, ok: true });
    });
  });

  test('the brand button keeps white text AA even while pressed', () => {
    expect(meetsAA(COLORS.on_cta, COLORS.cta)).toBe(true);
    expect(meetsAA(COLORS.on_brand_muted, COLORS.cta)).toBe(true);
    expect(meetsAA(COLORS.on_cta, COLORS.cta_pressed)).toBe(true);
  });

  test('the focus ring is visible on the fields (3 to 1 for non-text)', () => {
    expect(meetsAA(COLORS.focus, COLORS.surface, true)).toBe(true);
    expect(meetsAA(COLORS.focus, COLORS.surface_sunken, true)).toBe(true);
    expect(contrastRatio(COLORS.border_strong, COLORS.surface)).toBeGreaterThan(1.5);
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

  test('numbers use tabular figures', () => {
    expect(NUMBERS.fontVariant).toContain('tabular-nums');
  });

  test('the spacing and radius steps go up in order, and cards use 12 to 16 corners', () => {
    const ascending = (values) =>
      values.every((value, index) => index === 0 || value > values[index - 1]);
    expect(ascending(Object.values(SPACING))).toBe(true);
    expect(ascending(Object.values(RADIUS))).toBe(true);
    expect(RADIUS.md).toBe(12);
    expect(RADIUS.lg).toBe(16);
  });

  test('every spacing step is on the 4 point grid (except the 2 point hairline step)', () => {
    Object.entries(SPACING)
      .filter(([name]) => name !== 'xxs')
      .forEach(([name, value]) =>
        expect({ name, ok: value % 4 === 0 }).toEqual({ name, ok: true }),
      );
  });

  test('every shadow works on Android too, they stay soft, and the touch size is at least 44', () => {
    Object.values(SHADOWS).forEach((shadow) => expect(shadow.elevation).toBeDefined());
    Object.values(SHADOWS).forEach((shadow) =>
      expect(shadow.shadowOpacity).toBeLessThanOrEqual(0.15),
    );
    expect(SIZES.touch).toBeGreaterThanOrEqual(44);
    expect(SIZES.button_medium).toBeGreaterThanOrEqual(44);
  });
});

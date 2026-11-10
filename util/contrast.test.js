import { hexToRgb, relativeLuminance, contrastRatio, meetsAA } from './contrast';

describe('contrast helpers', () => {
  test('hexToRgb reads long and short hex and turns away anything else', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#0E1726')).toEqual([14, 23, 38]);
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
    expect(hexToRgb('white')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });

  test('luminance is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(relativeLuminance('nope')).toBeNull();
  });

  test('contrast matches the known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    // the order doesn't matter
    expect(contrastRatio('#767676', '#ffffff')).toBe(contrastRatio('#ffffff', '#767676'));
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('bad', '#ffffff')).toBeNull();
  });

  test('meetsAA uses 4.5 for normal text and 3 for large text', () => {
    // about 3.95, so large only
    expect(meetsAA('#888888', '#ffffff')).toBe(false);
    expect(meetsAA('#888888', '#ffffff', true)).toBe(true);
    expect(meetsAA('#000000', '#ffffff')).toBe(true);
    expect(meetsAA('bad', '#ffffff', true)).toBe(false);
  });
});

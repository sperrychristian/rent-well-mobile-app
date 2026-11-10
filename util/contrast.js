// pure color math for checking text contrast, the theme test uses it so a token change can't sneak in unreadable text
// it follows the WCAG 2 formula: relative luminance of each color, then (lighter + 0.05) / (darker + 0.05)

// '#1a2b3c' or '#abc' into [r, g, b] from 0 to 255, gives back null for anything that isn't a hex color
export function hexToRgb(hex) {
  if (typeof hex !== 'string') {
    return null;
  }
  const match = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  const digits =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : match[1];
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
}

// how bright a color looks to the eye, 0 for black and 1 for white
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// 1 when the colors match, 21 for black on white, rounded to 2 places so reports read cleanly
export function contrastRatio(first_hex, second_hex) {
  const first = relativeLuminance(first_hex);
  const second = relativeLuminance(second_hex);
  if (first === null || second === null) {
    return null;
  }
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

// AA needs 4.5 for normal text, and 3 for large text (24px, or 18.66px bold) and for icons and borders
export function meetsAA(first_hex, second_hex, is_large) {
  const ratio = contrastRatio(first_hex, second_hex);
  return ratio !== null && ratio >= (is_large ? 3 : 4.5);
}
